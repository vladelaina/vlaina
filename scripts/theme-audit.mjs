import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, 'src');

const toPosix = (filePath) => path.relative(repoRoot, filePath).split(path.sep).join('/');

const sourceExtensions = new Set(['.ts', '.tsx', '.css']);
const scriptExtensions = new Set(['.ts', '.tsx']);
const cssExtensions = new Set(['.css']);

function walkFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === 'build' || entry === 'vendor') continue;
      walkFiles(fullPath, files);
      continue;
    }
    if (sourceExtensions.has(path.extname(entry))) files.push(fullPath);
  }
  return files;
}

const files = walkFiles(srcRoot);

function isTestOrFixture(file) {
  return /(?:^|\/)[^/]+\.(?:test|spec|fixtures?)\.[^/]+$/.test(file) || file.includes('.fixtures.');
}

function lineNumber(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function collectMatches({ name, fileFilter, pattern, ignoreMatch }) {
  const findings = [];
  for (const filePath of files) {
    const file = toPosix(filePath);
    if (!fileFilter(file)) continue;

    const source = readFileSync(filePath, 'utf8');
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const index = match.index ?? 0;
      if (ignoreMatch?.({ file, source, match, index })) continue;
      const line = lineNumber(source, index);
      const preview = source.slice(index, source.indexOf('\n', index) === -1 ? undefined : source.indexOf('\n', index)).trim();
      findings.push({ name, file, line, preview });
    }
  }
  return findings;
}

function collectDefinedCssVariables() {
  const defined = new Set();

  for (const filePath of files) {
    const file = toPosix(filePath);
    if (!isCss(file)) continue;

    const source = readFileSync(filePath, 'utf8');
    const pattern = /^\s*(--vlaina-[A-Za-z0-9_-]+)\s*:/gm;
    for (const match of source.matchAll(pattern)) {
      defined.add(match[1]);
    }
  }

  return defined;
}

function collectUndefinedThemeReferences() {
  const defined = collectDefinedCssVariables();
  const runtimeProtocolVars = new Set([
    '--vlaina-hero-icon-header-size',
    '--vlaina-math-editor-width',
    '--vlaina-toolbar-ai-review-result-predicted-height',
    '--vlaina-toolbar-ai-review-width',
  ]);
  const allowed = new Set([...runtimeProtocolVars]);
  const findings = [];
  const seen = new Set();
  const pattern = /--vlaina-[A-Za-z0-9_-]+/g;

  for (const filePath of files) {
    const file = toPosix(filePath);
    if (isTestOrFixture(file)) continue;

    const source = readFileSync(filePath, 'utf8');

    for (const match of source.matchAll(pattern)) {
      const name = match[0];
      const index = match.index ?? 0;
      const before = source.slice(Math.max(0, index - 8), index);
      if (before.endsWith('<!') && source.startsWith('>', index + name.length)) continue;
      if (before.endsWith('--')) continue;
      if (defined.has(name) || allowed.has(name)) continue;

      const key = `${file}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const line = lineNumber(source, index);
      const preview = source.slice(index, source.indexOf('\n', index) === -1 ? undefined : source.indexOf('\n', index)).trim();
      findings.push({
        name: `Undefined theme variable reference: ${name}`,
        file,
        line,
        preview,
      });
    }
  }

  return findings;
}

const isScript = (file) => scriptExtensions.has(path.extname(file)) && !isTestOrFixture(file);
const isScriptIncludingTests = (file) => scriptExtensions.has(path.extname(file));
const isCss = (file) => cssExtensions.has(path.extname(file));
const isNonThemeCss = (file) => isCss(file) && file !== 'src/styles/theme.css';

const rawColorAllowlist = new Set([
  'src/styles/themeTokens.ts',
  'src/lib/colors/index.ts',
  'src/lib/highlighter.ts',
  'src/components/Notes/features/Editor/themeSchemaUtils.ts',
  'src/components/Notes/features/Editor/utils/shiki.ts',
]);

const languageDetectorAllowlist = [
  'src/components/Notes/features/Editor/utils/languageDetection/detectors/',
];

// Standard Tailwind utilities are allowed because src/index.css maps them through
// Tailwind v4 @theme inline variables backed by the centralized --vlaina-* tokens.
const legacyVarPattern = /--(?:notes-sidebar|chat-sidebar|sidebar-row-selected|toolbar-tooltip|toolbar-submenu|block-dropdown|collapse-pos|collapse-gutter|collapse-marker|header-icon-size|track-color|slider-percentage|appearance-font-size-progress|math-editor-width|ai-review-width|ai-dropdown-panel)-[A-Za-z0-9_-]+/g;

const checks = [
  {
    name: 'Runtime CSS variable writes must use app/theme protocol names',
    fileFilter: (file) => isScript(file),
    pattern: /(?:setProperty|removeProperty)\('--(?!vlaina-|table-block-)[A-Za-z0-9_-]+/g,
  },
  {
    name: 'CSS custom property definitions outside the theme contract must be protocol/framework scoped',
    fileFilter: (file) => isCss(file),
    pattern: /^\s*--(?!vlaina-|font-|radius|shadow|blur|color-|text-|default-|spacing|background|foreground|card|popover|primary|secondary|muted|accent|destructive|border|input|ring|chart|sidebar|tw-|tracking-|leading-|ease-)[A-Za-z0-9_-]+\s*:/gm,
  },
  {
    name: 'Legacy scattered theme variable names must not return',
    fileFilter: (file) => sourceExtensions.has(path.extname(file)) && !isTestOrFixture(file),
    pattern: legacyVarPattern,
  },
  {
    name: 'Inline style string literals should use centralized tokens',
    fileFilter: (file) => isScript(file),
    pattern: /\.style\.[A-Za-z]+\s*=\s*'[^']+'|style=\{\{[^\n]*'[^']+'/g,
  },
  {
    name: 'SVG protocol constants should use theme icon/style tokens',
    fileFilter: (file) => isScript(file),
    pattern: /\b(?:fill|stroke|strokeWidth|frameBorder|scrolling|loading)="(?:none|currentColor|0|no|lazy|[0-9.]+)"|fill=\{['"]none['"]\}|stroke=\{['"]currentColor['"]\}|stroke-width="(?:2|2\.5|1\.5|2\.25|3)"|fill="currentColor"|fill="none"|viewBox="0 0 (?:24 24|256 256|20 20|16 16)"/g,
  },
  {
    name: 'Tailwind arbitrary appearance values should reference theme variables',
    fileFilter: (file) => isScript(file),
    pattern: /\b(?:w|h|min-w|min-h|max-w|max-h|size|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y|rounded|text|leading|tracking|duration|delay|z|top|left|right|bottom|inset)-\[(?!var\()[^\]]*(?:[0-9](?:px|rem|vh|vw|%|ch)|#[0-9A-Fa-f]|rgba?\()[^\]]*\]/g,
  },
  {
    name: 'Raw z-index, opacity, and scale utilities should use theme variables',
    fileFilter: (file) => isScriptIncludingTests(file),
    pattern: /(?<!vlaina-)\b(?:z|opacity|scale)-[0-9]+(?:\.5)?\b/g,
  },
  {
    name: 'Raw colors should live in themeTokens or non-theme parser/fixture code',
    fileFilter: (file) => isScript(file),
    pattern: /#[0-9A-Fa-f]{3,8}|rgba?\(|hsla?\(/g,
    ignoreMatch: ({ file }) => rawColorAllowlist.has(file) || languageDetectorAllowlist.some((prefix) => file.startsWith(prefix)),
  },
  {
    name: 'CSS appearance declarations outside theme.css should not introduce raw values',
    fileFilter: (file) => isNonThemeCss(file),
    pattern: /^\s*(?:color|background|background-color|border-color|outline-color|caret-color|fill|stroke|box-shadow|text-shadow|filter|backdrop-filter|transition|animation|border-radius|font-size|line-height|letter-spacing|z-index|width|height|min-width|min-height|max-width|max-height|padding|margin|gap|top|left|right|bottom|inset)\s*:\s*(?![^;]*var\()[^;]*(?:#[0-9A-Fa-f]{3,8}|rgba?\(|hsla?\(|[0-9](?:px|rem|em|vh|vw|ch|ms|s))[^;]*;/gm,
  },
  {
    name: 'Local CSS variables outside theme.css must derive from centralized values',
    fileFilter: (file) => isNonThemeCss(file),
    pattern: /^\s*--vlaina-[A-Za-z0-9_-]+\s*:\s*(?![^;]*var\()[^;]*(?:#[0-9A-Fa-f]{3,8}|rgba?\(|hsla?\(|[0-9](?:px|rem|em|vh|vw|ch|ms|s))[^;]*;/gm,
  },
];

const allFindings = [
  ...checks.flatMap((check) => collectMatches(check)),
  ...collectUndefinedThemeReferences(),
];

if (allFindings.length > 0) {
  console.error('[theme-audit] Found theme contract violations:\n');
  for (const finding of allFindings) {
    console.error(`${finding.file}:${finding.line}`);
    console.error(`  ${finding.name}`);
    console.error(`  ${finding.preview}\n`);
  }
  process.exitCode = 1;
} else {
  console.log('[theme-audit] Theme contract checks passed.');
}
