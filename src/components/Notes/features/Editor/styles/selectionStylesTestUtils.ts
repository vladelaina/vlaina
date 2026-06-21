import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { expect } from "vitest";

const EDITOR_STYLES_ROOT = resolve(
  process.cwd(),
  'src/components/Notes/features/Editor/styles'
);

export function readStyleFile(name: string) {
  return normalizeLineEndings(readFileSync(resolve(EDITOR_STYLES_ROOT, name), 'utf8'));
}

export function readBlockSelectionStyle() {
  return [
    'block-selection.css',
    'block-selection-list.css',
    'block-selection-rich.css',
    'block-selection-table.css',
    'block-selection-final.css',
    'block-selection-atomic-rich.css',
  ].map(readStyleFile).join('\n');
}

export function readThemeCompatibilityStyle() {
  return normalizeLineEndings(
    readCssFileWithImports(resolve(EDITOR_STYLES_ROOT, 'theme-compatibility.css'))
  );
}

export function readThemeStyle() {
  return normalizeLineEndings(readFileSync(resolve(process.cwd(), 'src/styles/theme.css'), 'utf8'));
}

export function normalizeLineEndings(value: string) {
  return value.replace(/\r\n/g, '\n');
}

export function readCommonMarkdownSurfaceStyle() {
  return normalizeLineEndings(
    readFileSync(
      resolve(process.cwd(), 'src/components/common/markdown/markdownSurface.css'),
      'utf8'
    )
  );
}

export function readCodeBlockThemeSource() {
  return normalizeLineEndings(
    readFileSync(
      resolve(
        process.cwd(),
        'src/components/Notes/features/Editor/plugins/code/codemirror/codeBlockEditorTheme.ts'
      ),
      'utf8'
    ),
  );
}

export function readPreviewStylesSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/floating-toolbar', 'previewStyles.ts'),
    'utf8'
  );
}

export function readAppliedPreviewSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/floating-toolbar', 'appliedPreviewState.ts'),
    'utf8'
  );
}

export function readFloatingToolbarPluginViewSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/floating-toolbar', 'floatingToolbarPluginView.ts'),
    'utf8'
  );
}

export function readBlankAreaInteractionUtilsSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/cursor', 'blankAreaInteractionUtils.ts'),
    'utf8'
  );
}

export function readBlockSelectionLineFillOverlaySource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/cursor', 'blockSelectionLineFillOverlay.ts'),
    'utf8'
  );
}

export function readFloatingToolbarSourceFiles() {
  const root = resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/floating-toolbar');
  const files: Array<{ path: string; source: string }> = [];

  const visit = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = resolve(dir, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) {
        visit(path);
        continue;
      }

      if (!/\.(ts|tsx|css)$/.test(path) || /\.test\.(ts|tsx)$/.test(path)) {
        continue;
      }

      files.push({ path, source: readFileSync(path, 'utf8') });
    }
  };

  visit(root);
  return files;
}

export function readEditorStyleSourceFiles() {
  const root = EDITOR_STYLES_ROOT;
  const files: Array<{ path: string; source: string }> = [];

  const visit = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = resolve(dir, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) {
        visit(path);
        continue;
      }

      if (entry.endsWith('.css')) {
        files.push({ path, source: readFileSync(path, 'utf8') });
      }
    }
  };

  visit(root);
  return files;
}

export function readCssFileWithImports(path: string, seen = new Set<string>()): string {
  if (seen.has(path)) return '';
  seen.add(path);

  return readFileSync(path, 'utf8').replace(
    /@import\s+(?:url\()?['"]([^'")]+)['"]\)?\s*;/g,
    (match, importPath: string) => {
      if (/^(?:[a-z]+:|\/)/i.test(importPath)) return match;
      return readCssFileWithImports(resolve(dirname(path), importPath), seen);
    }
  );
}

export function extractCssRule(source: string, selector: string) {
  const selectorIndex = source.indexOf(selector);
  expect(selectorIndex).toBeGreaterThanOrEqual(0);

  const start = source.indexOf('{', selectorIndex);
  expect(start).toBeGreaterThanOrEqual(0);

  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(selectorIndex, index + 1);
      }
    }
  }

  throw new Error(`Could not extract CSS rule for selector: ${selector}`);
}

export function extractFunctionalSelectorList(source: string, functionName: ':is' | ':where', startIndex: number) {
  const marker = `${functionName}(`;
  const markerIndex = source.indexOf(marker, startIndex);
  expect(markerIndex).toBeGreaterThanOrEqual(0);

  let depth = 1;
  const contentStart = markerIndex + marker.length;
  for (let index = contentStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') depth += 1;
    if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(contentStart, index);
      }
    }
  }

  throw new Error(`Could not extract ${functionName} selector list`);
}

export function normalizeSelectorList(source: string) {
  return source
    .split(',')
    .map((selector) => selector.trim())
    .filter(Boolean);
}

export function extractSelectorListsContaining(source: string, functionName: ':is' | ':where', marker: string) {
  const lists: string[][] = [];
  const needle = `${functionName}(`;
  let index = 0;

  while (index < source.length) {
    const markerIndex = source.indexOf(needle, index);
    if (markerIndex < 0) break;

    const list = normalizeSelectorList(extractFunctionalSelectorList(source, functionName, markerIndex));
    if (list.includes(marker)) {
      lists.push(list);
    }

    index = markerIndex + needle.length;
  }

  return lists;
}

export function readTextSelectionOverlaySource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/selection', 'textSelectionOverlayPlugin.ts'),
    'utf8'
  );
}

export function readSharedBlockNodeTypesSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/shared', 'blockNodeTypes.ts'),
    'utf8'
  );
}

export function readAiReviewSelectionSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/floating-toolbar/ai', 'reviewSelection.ts'),
    'utf8'
  );
}

export function readLinkTooltipSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/links/tooltip', 'linkTooltipPlugin.tsx'),
    'utf8'
  );
}

export function readLinkTooltipStateSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/links/tooltip', 'linkTooltipState.ts'),
    'utf8'
  );
}

export function readLinkTooltipEditorSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/links/tooltip/components', 'LinkEditor.tsx'),
    'utf8'
  );
}

export function readUrlRailEditorSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/floating-toolbar/components', 'UrlRailEditor.ts'),
    'utf8'
  );
}

export function readToolbarInteractionsSource() {
  return readFileSync(
    resolve(
      process.cwd(),
      'src/components/Notes/features/Editor/plugins/floating-toolbar/toolbarInteractions.ts'
    ),
    'utf8'
  );
}

export function readMilkdownLinkTooltipThemeSource() {
  return readFileSync(
    resolve(process.cwd(), 'vendor/milkdown/packages/crepe/src/theme/common', 'link-tooltip.css'),
    'utf8'
  );
}
