import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import { scopeImportedMarkdownThemeCss } from '../src/lib/markdown/theme-compatibility/cssScoping';
import { detectMarkdownThemePlatform } from '../src/lib/markdown/theme-compatibility/platformDetection';
import {
  selectorTargetsImportedPageChrome,
  selectorTargetsKnownExternalExtension,
} from '../src/lib/markdown/theme-compatibility/selectorClassification';
import { codeBlockLanguages } from '../src/components/Notes/features/Editor/plugins/code/codeBlockLanguageLoader';
import { buildImportedAppThemeCss } from '../src/lib/markdown/theme-compatibility/appThemeBridge';

const typoraReferenceRoot = '.reference/typora-theme-phycat';
const referenceRoots = [typoraReferenceRoot, '.reference/ob'];
const sourceRoots = ['src/components/Notes/features/Editor', 'src/lib/markdown/theme-compatibility'];
const rootScope = '[data-markdown-theme-root="true"][data-markdown-imported-theme="audit"]';

function walkFiles(dir: string, predicate: (file: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(full, predicate));
    if (entry.isFile() && predicate(full)) files.push(full);
  }
  return files;
}

function splitSelectorList(selectorList: string): string[] {
  const selectors: string[] = [];
  let start = 0;
  let quote: string | null = null;
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let index = 0; index < selectorList.length; index += 1) {
    const char = selectorList[index];
    const previous = selectorList[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(') parenDepth += 1;
    if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (char === '[') bracketDepth += 1;
    if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    if (char === ',' && parenDepth === 0 && bracketDepth === 0) {
      selectors.push(selectorList.slice(start, index).trim());
      start = index + 1;
    }
  }

  selectors.push(selectorList.slice(start).trim());
  return selectors.filter(Boolean);
}

function collectCssStats(css: string) {
  const root = postcss.parse(css, { from: undefined });
  let ruleCount = 0;
  let selectorCount = 0;
  const selectors: string[] = [];
  const customProperties = new Set<string>();
  const classNames = new Map<string, number>();

  root.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
    ruleCount += 1;
    const parts = splitSelectorList(rule.selector);
    selectorCount += parts.length;
    selectors.push(...parts);
    rule.walkDecls((declaration) => {
      if (declaration.prop.startsWith('--')) customProperties.add(declaration.prop);
    });
  });

  for (const selector of selectors) {
    for (const match of selector.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)) {
      classNames.set(match[1], (classNames.get(match[1]) ?? 0) + 1);
    }
  }

  return { ruleCount, selectorCount, selectors, customProperties, classNames };
}

function isTestOrFixture(file: string): boolean {
  return /(?:^|\/)[^/]+\.(?:test|spec|fixtures?)\.[^/]+$/.test(file) || file.includes('.fixtures.');
}

function addClassTokens(signals: Set<string>, value: string): void {
  for (const token of value.split(/\s+/)) {
    const clean = token.replace(/^[.!#:[(]+|[)\]};,'"`]+$/g, '');
    if (/^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/.test(clean)) {
      signals.add(clean);
    }
  }
}

function stripNegativeSelectorArguments(selector: string): string {
  let result = '';
  let index = 0;

  while (index < selector.length) {
    const match = selector.slice(index).match(/^:not\(/i);
    if (!match) {
      result += selector[index];
      index += 1;
      continue;
    }

    const openParenIndex = index + match[0].length - 1;
    const closeParenIndex = findMatchingParen(selector, openParenIndex);
    if (closeParenIndex < 0) {
      result += selector[index];
      index += 1;
      continue;
    }

    index = closeParenIndex + 1;
  }

  return result;
}

function stripAttributeSelectorContents(selector: string): string {
  let result = '';
  let index = 0;
  let quote: string | null = null;

  while (index < selector.length) {
    const char = selector[index];
    const previous = selector[index - 1];

    if (char !== '[') {
      result += char;
      index += 1;
      continue;
    }

    index += 1;
    quote = null;

    while (index < selector.length) {
      const innerChar = selector[index];
      const innerPrevious = selector[index - 1];
      if (quote) {
        if (innerChar === quote && innerPrevious !== '\\') quote = null;
        index += 1;
        continue;
      }
      if (innerChar === '"' || innerChar === "'") {
        quote = innerChar;
        index += 1;
        continue;
      }
      if (innerChar === ']') {
        index += 1;
        break;
      }
      index += 1;
    }
  }

  return result;
}

function findMatchingParen(value: string, openParenIndex: number): number {
  let quote: string | null = null;
  let depth = 0;

  for (let index = openParenIndex; index < value.length; index += 1) {
    const char = value[index];
    const previous = value[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(') depth += 1;
    if (char === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function getPositiveClassAndIdNames(selector: string): string[] {
  const positiveSelector = stripAttributeSelectorContents(stripNegativeSelectorArguments(selector));
  return Array.from(positiveSelector.matchAll(/[.#](-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g), (match) => match[1]);
}

function collectCodeBlockLanguageClassSignals(): string[] {
  const languages = new Set<string>();
  for (const language of codeBlockLanguages) {
    languages.add(language.id);
    for (const alias of language.aliases) {
      languages.add(alias);
    }
  }

  return Array.from(languages)
    .filter((language) => /^[\w-]+$/.test(language))
    .map((language) => `language-${language}`);
}

function collectSeedLocalDomSignals(): Set<string> {
  return new Set([
    ...collectCodeBlockLanguageClassSignals(),
    'write',
    'ProseMirror',
    'milkdown-editor',
    'markdown-surface',
    'markdown-preview-view',
    'markdown-rendered',
    'markdown-reading-view',
    'markdown-preview-section',
    'markdown-source-view',
    'cm-s-obsidian',
    'mod-cm6',
    'is-live-preview',
    'is-readable-line-width',
    'is-phone',
    'is-mobile',
    'is-tablet',
    'is-desktop',
    'max',
    'CodeMirror',
    'CodeMirror-code',
    'cm-s-inner',
    'cm-editor',
    'cm-focused',
    'cm-scroller',
    'cm-gutters',
    'cm-lineNumbers',
    'cm-gutterElement',
    'cm-activeLine',
    'cm-activeLineGutter',
    'cm-content',
    'cm-line',
    'cm-specialChar',
    'cm-comment',
    'cm-meta',
    'cm-keyword',
    'cm-atom',
    'cm-number',
    'cm-string',
    'cm-string-2',
    'cm-property',
    'cm-attribute',
    'cm-variable',
    'cm-variable-2',
    'cm-def',
    'cm-type',
    'cm-qualifier',
    'cm-tag',
    'cm-operator',
    'cm-bracket',
    'cm-strong',
    'cm-em',
    'cm-link',
    'cm-error',
    'cm-cursor',
    'cm-inline-code',
    'cm-hashtag',
    'cm-quote',
    'cm-quote-1',
    'cm-highlight',
    'cm-header',
    'cm-header-1',
    'cm-header-2',
    'cm-header-3',
    'cm-header-4',
    'cm-header-5',
    'cm-header-6',
    'token',
    'comment',
    'prolog',
    'doctype',
    'cdata',
    'keyword',
    'constant',
    'boolean',
    'number',
    'string',
    'char',
    'attr-value',
    'regex',
    'property',
    'attr-name',
    'variable',
    'function',
    'class-name',
    'maybe-class-name',
    'namespace',
    'operator',
    'punctuation',
    'bold',
    'italic',
    'url',
    'md-fences',
    'md-math-block',
    'md-fences-math',
    'md-hr',
    'md-image',
    'md-htmlblock',
    'md-htmlblock-container',
    'md-meta-block',
    'md-br',
    'md-alert',
    'md-alert-note',
    'md-alert-tip',
    'md-alert-important',
    'md-alert-warning',
    'md-alert-caution',
    'md-task-list-item',
    'md-footnote',
    'footnote-ref',
    'footnote-ref-label',
    'footnote-def',
    'footnote-def-label',
    'footnote-def-content',
    'footnote-line',
    'footnotes',
    'footnotes-area',
    'reversefootnote',
    'md-toc',
    'md-toc-content',
    'md-toc-inner',
    'md-toc-item',
    'md-toc-empty',
    'md-toc-h1',
    'md-toc-h2',
    'md-toc-h3',
    'md-toc-h4',
    'md-toc-h5',
    'md-toc-h6',
    'toc-block',
    'toc-content',
    'toc-item',
    'toc-link',
    'toc-empty',
    'done',
    'task-list-item',
    'task-list-item-checkbox',
    'contains-task-list',
    'has-list-bullet',
    'HyperMD-codeblock',
    'HyperMD-codeblock-bg',
    'cm-hmd-codeblock',
    'HyperMD-codeblock-begin',
    'HyperMD-codeblock-begin-bg',
    'HyperMD-codeblock-end',
    'HyperMD-codeblock-end-bg',
    'HyperMD-header',
    'HyperMD-header-1',
    'HyperMD-header-2',
    'HyperMD-header-3',
    'HyperMD-header-4',
    'HyperMD-header-5',
    'HyperMD-header-6',
    'HyperMD-quote',
    'HyperMD-task-line',
    'is-checked',
    'milkdown-table-block',
    'table-wrapper',
    'code-block-container',
    'code-block-editable',
    'code-block-lazy-preview',
    'copy-code-button',
    'code-block-flair',
    'editor-code-block',
    'frontmatter-block-editor',
    'frontmatter-block-container',
    'image-block-container',
    'image-embed',
    'callout',
    'callout-title',
    'callout-icon',
    'callout-title-inner',
    'callout-content',
    'md-alert-text-container',
    'md-alert-text',
    'md-alert-text-note',
    'md-alert-text-tip',
    'md-alert-text-important',
    'md-alert-text-warning',
    'md-alert-text-caution',
    'mermaid-svg',
    'node',
    'nodeLabel',
    'label',
    'edgeLabel',
    'cluster',
    'statediagram-cluster',
    'quadrant',
    'mindmap-edges',
    'commit-bullets',
    'flowchart',
    'marker',
    'edgePaths',
    'edgePath',
    'edgeLabel',
    'edgeLabels',
    'relationshipLabelBox',
    'relationshipLabel',
    'actor',
    'messageText',
    'loopText',
    'noteText',
    'v-q',
    'v-std-code',
    'editor-tag-token',
    'tag',
    'v-actor-front',
    'v-actor-key-sys',
    'v-actor-ext-sys',
    'v-mm-hide',
    'external-link',
  ]);
}

function collectLocalDomSignals(): Set<string> {
  const signals = collectSeedLocalDomSignals();

  for (const root of sourceRoots) {
    for (const file of walkFiles(root, (candidate) => /\.(ts|tsx|css)$/.test(candidate))) {
      const text = fs.readFileSync(file, 'utf8');
      for (const match of text.matchAll(/class(?:Name)?\s*=\s*["'`]([^"'`]+)["'`]/g)) {
        addClassTokens(signals, match[1]);
      }
      for (const match of text.matchAll(/classList\.add\(([^)]+)\)/g)) {
        for (const token of match[1].matchAll(/["'`]([^"'`]+)["'`]/g)) signals.add(token[1]);
      }
      for (const match of text.matchAll(/\.([_a-zA-Z]+[_a-zA-Z0-9-]*)/g)) {
        signals.add(match[1]);
      }
      for (const match of text.matchAll(/#([_a-zA-Z]+[_a-zA-Z0-9-]*)/g)) {
        signals.add(match[1]);
      }
    }
  }

  return signals;
}

function collectStrictLocalDomSignals(): Set<string> {
  const signals = collectSeedLocalDomSignals();

  for (const root of sourceRoots) {
    for (const file of walkFiles(root, (candidate) => /\.(ts|tsx|css)$/.test(candidate) && !isTestOrFixture(candidate))) {
      const text = fs.readFileSync(file, 'utf8');

      if (file.endsWith('.css')) {
        const stats = collectCssStats(text);
        for (const selector of stats.selectors) {
          for (const match of selector.matchAll(/[.#](-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)) {
            signals.add(match[1]);
          }
        }
        continue;
      }

      for (const pattern of [
        /class(?:Name)?\s*=\s*["'`]([^"'`]+)["'`]/g,
        /\bclass(?:Name)?\s*:\s*["'`]([^"'`]+)["'`]/g,
        /\.className\s*=\s*["'`]([^"'`]+)["'`]/g,
      ]) {
        for (const match of text.matchAll(pattern)) {
          addClassTokens(signals, match[1]);
        }
      }

      for (const match of text.matchAll(/classList\.(?:add|remove|toggle|contains)\(([^)]+)\)/g)) {
        for (const token of match[1].matchAll(/["'`]([^"'`]+)["'`]/g)) {
          addClassTokens(signals, token[1]);
        }
      }

      for (const match of text.matchAll(/mergeDomClassNames\(([^)]*)\)/g)) {
        for (const token of match[1].matchAll(/["'`]([^"'`]+)["'`]/g)) {
          addClassTokens(signals, token[1]);
        }
      }

      for (const match of text.matchAll(/\bid\s*=\s*["'`]([^"'`]+)["'`]/g)) {
        const id = match[1].trim();
        if (/^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/.test(id)) {
          signals.add(id);
        }
      }
    }
  }

  return signals;
}

const MARKDOWN_CONTENT_ELEMENT_PATTERN = /\b(?:p|h[1-6]|blockquote|details|summary|table|thead|tbody|tr|th|td|ul|ol|li|pre|code|tt|a|img|hr|mark|strong|em|del|sup|sub|ruby|rp|rt|kbd|figure|figcaption|video|iframe|svg|abbr|u|progress|math|mjx-container)\b/i;

function selectorHasLocalSignal(selector: string, localSignals: Set<string>): boolean {
  const folded = selector.replaceAll(rootScope, '');
  if (MARKDOWN_CONTENT_ELEMENT_PATTERN.test(folded)) {
    return true;
  }
  const classAndIdNames = getPositiveClassAndIdNames(folded);
  for (const name of classAndIdNames) {
    if (localSignals.has(name)) return true;
  }
  return classAndIdNames.length === 0;
}

function selectorHasOnlyKnownLocalClasses(selector: string, localSignals: Set<string>): boolean {
  const folded = selector.replaceAll(rootScope, '');
  if (selectorTargetsMermaidRenderedSvg(folded)) {
    return true;
  }

  let sawClassOrId = false;

  for (const name of getPositiveClassAndIdNames(folded)) {
    sawClassOrId = true;
    if (name === 'theme-dark' || name === 'theme-light') continue;
    if (!localSignals.has(name)) return false;
  }

  return sawClassOrId || MARKDOWN_CONTENT_ELEMENT_PATTERN.test(folded) || selectorTargetsOnlyScopedRoot(folded);
}

function selectorTargetsMermaidRenderedSvg(selector: string): boolean {
  return /\bsvg\s*\[\s*aria-roledescription\b/i.test(selector);
}

function selectorTargetsOnlyScopedRoot(selectorAfterScope: string): boolean {
  const normalized = selectorAfterScope.trim();
  if (!normalized) return true;
  if (/[\s>+~]/.test(normalized)) return false;
  if (/[.#](-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/.test(normalized)) return false;
  return /^[\[:]/.test(normalized);
}

function selectorHasExternalGateAroundLocalContent(selector: string, localSignals: Set<string>): boolean {
  return selectorTargetsKnownExternalExtension(selector)
    && selectorHasLocalSignal(selector, localSignals)
    && !selectorTargetsImportedPageChrome(selector);
}

function topClassEntries(
  entries: Map<string, number>,
  predicate: (name: string) => boolean,
  limit = 10
): string {
  return Array.from(entries.entries())
    .filter(([name]) => predicate(name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => `${key}:${count}`)
    .join(', ');
}

function collectClassEntriesFromSelectors(
  selectors: string[],
  predicate: (selector: string) => boolean
): Map<string, number> {
  const classNames = new Map<string, number>();
  for (const selector of selectors) {
    if (!predicate(selector)) continue;
    for (const match of selector.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)) {
      classNames.set(match[1], (classNames.get(match[1]) ?? 0) + 1);
    }
  }
  return classNames;
}

function topEntries(entries: Map<string, number>, limit = 12): string {
  return Array.from(entries.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => `${key}:${count}`)
    .join(', ');
}

function sampleSelectors(selectors: string[], limit = 8): string {
  return selectors
    .slice(0, limit)
    .map((selector) => selector.replaceAll(/\s+/g, ' ').slice(0, 120))
    .join(' || ');
}

function formatSelectors(selectors: string[]): string {
  return selectors
    .map((selector) => selector.replaceAll(/\s+/g, ' ').trim())
    .join('\n  ');
}

function formatPercent(count: number, total: number): string {
  return `${((count / Math.max(1, total)) * 100).toFixed(1)}%`;
}

function getCssImportUrl(params: string): string | null {
  const trimmed = params.trim();
  const urlFunctionMatch = trimmed.match(/^url\(\s*(?:"([^"]+)"|'([^']+)'|([^'")\s][^)]*?))\s*\)/i);
  if (urlFunctionMatch) {
    return (urlFunctionMatch[1] ?? urlFunctionMatch[2] ?? urlFunctionMatch[3] ?? '').trim() || null;
  }

  const quotedMatch = trimmed.match(/^"([^"]+)"|^'([^']+)'/);
  return (quotedMatch?.[1] ?? quotedMatch?.[2] ?? '').trim() || null;
}

function stripCssUrlSuffix(url: string): string {
  const queryIndex = url.indexOf('?');
  const hashIndex = url.indexOf('#');
  const suffixIndex = [queryIndex, hashIndex]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  return suffixIndex === undefined ? url : url.slice(0, suffixIndex);
}

function isRelativeCssImportUrl(url: string): boolean {
  const trimmed = stripCssUrlSuffix(url.trim());
  if (!trimmed || !trimmed.toLowerCase().endsWith('.css')) return false;
  if (trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('/')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return false;
  if (path.isAbsolute(trimmed)) return false;
  return true;
}

function getRelativeCssImports(css: string): string[] {
  const root = postcss.parse(css, { from: undefined });
  const imports: string[] = [];

  root.walkAtRules((rule) => {
    if (rule.name.toLowerCase() !== 'import') return;

    const url = getCssImportUrl(rule.params);
    if (!url || !isRelativeCssImportUrl(url)) return;

    imports.push(stripCssUrlSuffix(url.trim()));
  });

  return imports;
}

function stripCssImportRules(css: string): string {
  const root = postcss.parse(css, { from: undefined });
  root.walkAtRules((rule) => {
    if (rule.name.toLowerCase() === 'import') {
      rule.remove();
    }
  });
  return root.toString();
}

function loadCssWithLocalImports(file: string, seen = new Set<string>()): string {
  const resolvedFile = path.resolve(file);
  if (seen.has(resolvedFile)) return '';

  seen.add(resolvedFile);
  const css = fs.readFileSync(resolvedFile, 'utf8');
  const importedCssBlocks: string[] = [];

  for (const imported of getRelativeCssImports(css)) {
    const importedFile = path.resolve(path.dirname(resolvedFile), imported);
    if (seen.has(importedFile) || !fs.existsSync(importedFile)) {
      continue;
    }

    importedCssBlocks.push(loadCssWithLocalImports(importedFile, seen));
  }

  const strippedCss = stripCssImportRules(css);
  return [...importedCssBlocks.filter(Boolean), strippedCss].join('\n');
}

describe('markdown theme compatibility sample audit', () => {
  it('loads and bridges the real Phycat Sky theme', () => {
    const file = path.join(typoraReferenceRoot, 'phycat-sky.css');
    const css = loadCssWithLocalImports(file);
    const platform = detectMarkdownThemePlatform(css);
    const scopedCss = scopeImportedMarkdownThemeCss(css, platform, rootScope);
    const appCss = buildImportedAppThemeCss(css, 'phycat-sky', platform);

    expect(platform).toBe('typora');
    expect(css).toContain('font-family: "LXGW WenKai"');
    expect(css).not.toContain('@import');
    expect(scopedCss).toContain(`${rootScope}#write::before`);
    expect(scopedCss).toContain(`${rootScope}#write h3:after`);
    expect(appCss).toContain('--vlaina-sidebar-surface: var(--glass-bg-color);');
    expect(appCss).toContain('--vlaina-sidebar-row-hover: var(--element-color-soo-shallow);');
    expect(appCss).toContain('--vlaina-sidebar-row-active: var(--element-color);');
    expect(appCss).toContain('--vlaina-sidebar-row-selected-text: var(--head-title-h2-color);');
    expect(appCss).toContain('--vlaina-code-inline-background: var(--element-color-linecode-background);');
  });

  it('prints utilization metrics for reference themes', () => {
    const printFullUnknown = process.env.VLAINA_THEME_COMPAT_AUDIT_FULL_UNKNOWN === '1';
    const localSignals = collectLocalDomSignals();
    const strictLocalSignals = collectStrictLocalDomSignals();
    const files = referenceRoots.flatMap((root) =>
      walkFiles(root, (file) => {
        if (!file.endsWith('.css')) return false;
        if (root !== typoraReferenceRoot) return true;
        return path.dirname(file) === typoraReferenceRoot && path.basename(file).startsWith('phycat-');
      })
    );

    console.log(`\nTheme compatibility audit (${files.length} entry CSS files)`);
    console.log(`Local DOM/style signals: ${localSignals.size}`);
    console.log(`Strict local DOM/style signals: ${strictLocalSignals.size}`);

    for (const file of files) {
      const entryCss = fs.readFileSync(file, 'utf8');
      const css = loadCssWithLocalImports(file);
      const platform = detectMarkdownThemePlatform(css);
      const entryRaw = collectCssStats(entryCss);
      const raw = collectCssStats(css);
      const scopedCss = scopeImportedMarkdownThemeCss(css, platform, rootScope);
      const scoped = collectCssStats(scopedCss);
      const locallyLikelySelectors = scoped.selectors.filter((selector) => selectorHasLocalSignal(selector, localSignals)).length;
      const strictLocallyLikelySelectors = scoped.selectors.filter((selector) => selectorHasLocalSignal(selector, strictLocalSignals)).length;
      const strictMatchedSelectors = scoped.selectors.filter((selector) => selectorHasOnlyKnownLocalClasses(selector, strictLocalSignals)).length;
      const possibleChromeSelectors = scoped.selectors.filter(selectorTargetsImportedPageChrome).length;
      const externalExtensionSelectors = scoped.selectors.filter(selectorTargetsKnownExternalExtension).length;
      const externalContentGateSelectors = scoped.selectors.filter((selector) =>
        selectorHasExternalGateAroundLocalContent(selector, strictLocalSignals)
      );
      const isActionableUnknownSelector = (selector: string) =>
        !selectorHasLocalSignal(selector, localSignals)
        && !selectorTargetsImportedPageChrome(selector)
        && !selectorTargetsKnownExternalExtension(selector);
      const isStrictActionableUnknownSelector = (selector: string) =>
        !selectorHasLocalSignal(selector, strictLocalSignals)
        && !selectorTargetsImportedPageChrome(selector)
        && !selectorTargetsKnownExternalExtension(selector);
      const isStrictUnmatchedSelector = (selector: string) =>
        !selectorHasOnlyKnownLocalClasses(selector, strictLocalSignals)
        && !selectorTargetsImportedPageChrome(selector)
        && !selectorTargetsKnownExternalExtension(selector);
      const actionableSelectors = scoped.selectors.filter(isActionableUnknownSelector).length;
      const actionableSelectorSamples = scoped.selectors.filter(isActionableUnknownSelector);
      const actionableClassNames = collectClassEntriesFromSelectors(scoped.selectors, isActionableUnknownSelector);
      const strictActionableSelectors = scoped.selectors.filter(isStrictActionableUnknownSelector).length;
      const strictActionableSelectorSamples = scoped.selectors.filter(isStrictActionableUnknownSelector);
      const strictActionableClassNames = collectClassEntriesFromSelectors(scoped.selectors, isStrictActionableUnknownSelector);
      const strictUnmatchedSelectors = scoped.selectors.filter(isStrictUnmatchedSelector).length;
      const strictUnmatchedSelectorSamples = scoped.selectors.filter(isStrictUnmatchedSelector);
      const strictUnmatchedClassNames = collectClassEntriesFromSelectors(scoped.selectors, isStrictUnmatchedSelector);
      const orphanClasses = Array.from(scoped.classNames.entries())
        .filter(([name]) => !localSignals.has(name))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => `${name}:${count}`)
        .join(', ');

      console.log([
        `\n${file}`,
        `platform=${platform}`,
        `entryRules=${entryRaw.ruleCount}`,
        `entrySelectors=${entryRaw.selectorCount}`,
        `runtimeRules ${raw.ruleCount}->${scoped.ruleCount}`,
        `runtimeSelectors ${raw.selectorCount}->${scoped.selectorCount}`,
        `selectorKeep=${formatPercent(scoped.selectorCount, raw.selectorCount)}`,
        `localLikely=${formatPercent(locallyLikelySelectors, scoped.selectorCount)}`,
        `strictLocalLikely=${formatPercent(strictLocallyLikelySelectors, scoped.selectorCount)}`,
        `strictClassMatched=${formatPercent(strictMatchedSelectors, scoped.selectorCount)}`,
        `possibleChrome=${possibleChromeSelectors}`,
        `externalExtension=${externalExtensionSelectors}`,
        `externalContentGates=${externalContentGateSelectors.length}`,
        `actionableUnknown=${actionableSelectors}`,
        `strictActionableUnknown=${strictActionableSelectors}`,
        `strictUnmatched=${strictUnmatchedSelectors}`,
        `vars=${scoped.customProperties.size}`,
        `topClasses=[${topEntries(scoped.classNames)}]`,
        `knownExternalHighFreq=[${topClassEntries(scoped.classNames, (name) => selectorTargetsKnownExternalExtension(`.${name}`))}]`,
        `actionableUnknownHighFreq=[${topEntries(actionableClassNames, 10)}]`,
        `strictActionableUnknownHighFreq=[${topEntries(strictActionableClassNames, 10)}]`,
        `strictUnmatchedHighFreq=[${topEntries(strictUnmatchedClassNames, 10)}]`,
        `actionableUnknownSamples=[${sampleSelectors(actionableSelectorSamples)}]`,
        `strictActionableUnknownSamples=[${sampleSelectors(strictActionableSelectorSamples)}]`,
        `strictUnmatchedSamples=[${sampleSelectors(strictUnmatchedSelectorSamples)}]`,
        `externalContentGateSamples=[${sampleSelectors(externalContentGateSelectors)}]`,
        `unmappedHighFreq=[${orphanClasses}]`,
      ].join(' | '));

      if (printFullUnknown && actionableSelectorSamples.length > 0) {
        console.log(`actionableUnknownFull:\n  ${formatSelectors(actionableSelectorSamples)}`);
      }
      if (printFullUnknown && strictActionableSelectorSamples.length > 0) {
        console.log(`strictActionableUnknownFull:\n  ${formatSelectors(strictActionableSelectorSamples)}`);
      }
      if (printFullUnknown && strictUnmatchedSelectorSamples.length > 0) {
        console.log(`strictUnmatchedFull:\n  ${formatSelectors(strictUnmatchedSelectorSamples)}`);
      }
    }
  });
});
