import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readStyleFile(name: string) {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/styles', name),
    'utf8'
  );
}

function normalizeLineEndings(value: string) {
  return value.replace(/\r\n/g, '\n');
}

function readCommonMarkdownSurfaceStyle() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/common/markdown/markdownSurface.css'),
    'utf8'
  );
}

function readCodeBlockThemeSource() {
  return readFileSync(
    resolve(
      process.cwd(),
      'src/components/Notes/features/Editor/plugins/code/codemirror/codeBlockEditorTheme.ts'
    ),
    'utf8'
  );
}

function readPreviewStylesSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/floating-toolbar', 'previewStyles.ts'),
    'utf8'
  );
}

function readAppliedPreviewSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/floating-toolbar', 'appliedPreviewState.ts'),
    'utf8'
  );
}

function readFloatingToolbarPluginViewSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/floating-toolbar', 'floatingToolbarPluginView.ts'),
    'utf8'
  );
}

function readBlankAreaDragBoxSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/cursor', 'blankAreaDragBoxPlugin.ts'),
    'utf8'
  );
}

function readBlockSelectionLineFillOverlaySource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/cursor', 'blockSelectionLineFillOverlay.ts'),
    'utf8'
  );
}

function readFloatingToolbarSourceFiles() {
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

function readEditorStyleSourceFiles() {
  const root = resolve(process.cwd(), 'src/components/Notes/features/Editor/styles');
  return readdirSync(root)
    .filter((entry) => entry.endsWith('.css'))
    .map((entry) => {
      const path = resolve(root, entry);
      return { path, source: readFileSync(path, 'utf8') };
    });
}

function extractCssRule(source: string, selector: string) {
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

function readTextSelectionOverlaySource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/selection', 'textSelectionOverlayPlugin.ts'),
    'utf8'
  );
}

function readSharedBlockNodeTypesSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/shared', 'blockNodeTypes.ts'),
    'utf8'
  );
}

function readAiReviewSelectionSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/floating-toolbar/ai', 'reviewSelection.ts'),
    'utf8'
  );
}

function readLinkTooltipSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/links/tooltip', 'linkTooltipPlugin.tsx'),
    'utf8'
  );
}

function readLinkTooltipEditorSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/links/tooltip/components', 'LinkEditor.tsx'),
    'utf8'
  );
}

function readUrlRailEditorSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/floating-toolbar/components', 'UrlRailEditor.ts'),
    'utf8'
  );
}

function readMilkdownLinkTooltipThemeSource() {
  return readFileSync(
    resolve(process.cwd(), 'vendor/milkdown/packages/crepe/src/theme/common', 'link-tooltip.css'),
    'utf8'
  );
}

describe('editor embedded CodeMirror selection styles', () => {
  it('scopes body line number gutter styles behind the markdown body line number class', () => {
    const coreCss = readStyleFile('core.css');

    expect(coreCss).toContain(
      '.milkdown-editor.vlaina-markdown-body-line-numbers .vlaina-body-line-number-gutter'
    );
    expect(coreCss).toContain(
      '.milkdown-editor.vlaina-markdown-body-line-numbers .vlaina-body-line-number'
    );
    expect(coreCss).not.toContain('.milkdown-editor .vlaina-body-line-number-gutter');
    expect(coreCss).not.toContain('.milkdown-editor .vlaina-body-line-number {');
  });

  it('keeps nested list block selection overlays from stacking darker backgrounds', () => {
    const css = readStyleFile('core.css');

    expect(css).toContain('.milkdown .ProseMirror li.vlaina-block-selected .vlaina-block-selected {');
    expect(css).toContain('background-color: transparent;');
    expect(css).toContain('box-shadow: none;');
    expect(css).toContain('transition: none !important;');
  });

  it('does not replace native list markers during block selection', () => {
    const css = readStyleFile('core.css');

    expect(css).not.toContain('li.vlaina-block-selected::marker');
    expect(css).not.toContain('content: attr(data-label)');
    expect(css).not.toContain('li.vlaina-block-selected:not([data-item-type="task"])::before');
  });

  it('tints native list markers when only a paragraph child carries selection', () => {
    const css = readStyleFile('core.css');

    expect(css).toContain('.milkdown .ProseMirror li:has(> p.vlaina-block-selected)::marker {');
    expect(css).toContain('color: var(--vlaina-editor-block-selection-fg, #fefbf9);');
    expect(css).not.toContain('li:has(> .code-block-container.vlaina-block-selected)::marker');
  });

  it('tints task checkboxes with the selected block foreground', () => {
    const css = readStyleFile('core.css');
    const markdownCss = readStyleFile('markdown.css');

    expect(css).toContain('.milkdown .ProseMirror li[data-item-type="task"].vlaina-block-selected::before,');
    expect(css).toContain('.milkdown .ProseMirror li[data-item-type="task"]:has(> p.vlaina-block-selected)::before,');
    expect(css).toContain('.milkdown .ProseMirror .vlaina-block-selected li[data-item-type="task"]::before {');
    expect(css).toContain('border-color: var(--vlaina-editor-block-selection-fg, #fefbf9) !important;');
    expect(css).toContain('background-color: transparent !important;');
    expect(markdownCss).toContain('.milkdown .ProseMirror li[data-item-type="task"][data-checked="true"] > .vlaina-block-selected {');
    expect(markdownCss).toContain('color: var(--vlaina-editor-block-selection-fg, #fefbf9) !important;');
    expect(markdownCss).toContain('-webkit-text-fill-color: var(--vlaina-editor-block-selection-fg, #fefbf9) !important;');
  });

  it('hides editable list gap placeholder text while keeping the caret visible', () => {
    const css = readStyleFile('markdown.css');
    const itemRule = extractCssRule(css, '.milkdown .ProseMirror li.vlaina-list-gap-placeholder-item');
    const rule = extractCssRule(css, '.milkdown .ProseMirror li.vlaina-list-gap-placeholder-item > p');

    expect(itemRule).toContain('margin-left: calc(-1 * var(--vlaina-list-gap-placeholder-outdent));');
    expect(itemRule).toContain('width: calc(100% + var(--vlaina-list-gap-placeholder-outdent));');
    expect(rule).toContain('color: transparent;');
    expect(rule).toContain('-webkit-text-fill-color: transparent;');
    expect(rule).toContain('caret-color: transparent;');
  });

  it('keeps list gap placeholder block selection from extending farther left than normal list rows', () => {
    const css = readStyleFile('markdown.css');
    const rule = extractCssRule(
      css,
      '.milkdown .ProseMirror li.vlaina-list-gap-placeholder-item.vlaina-block-selected,'
    );

    expect(rule).toContain('.milkdown .ProseMirror li.vlaina-list-gap-placeholder-item > .vlaina-block-selected');
    expect(rule).toContain('var(--vlaina-list-row-selection-bleed-x-start, 72px)');
    expect(rule).toContain('var(--vlaina-list-gap-placeholder-outdent)');
  });

  it('tints blockquote rails with the selected block foreground', () => {
    const css = readStyleFile('core.css');

    expect(css).toContain('.milkdown .ProseMirror blockquote.vlaina-block-selected::before,');
    expect(css).toContain('.milkdown .ProseMirror blockquote:has(> .vlaina-block-selected)::before,');
    expect(css).toContain('.milkdown .ProseMirror .vlaina-block-selected blockquote::before {');
    expect(css).toContain('background: var(--vlaina-editor-block-selection-fg, #fefbf9) !important;');
  });

  it('keeps selected paragraph overlays from being taller than todo rows', () => {
    const css = readStyleFile('core.css');

    expect(css).toContain('.milkdown .ProseMirror p.vlaina-block-selected {');
    expect(css).toContain('--vlaina-block-selection-bleed-y: 0px;');
  });

  it('keeps list selection overlays wide enough to cover native markers', () => {
    const css = readStyleFile('core.css');

    expect(css).toContain('--vlaina-block-selection-bleed-x-start: 48px;');
    expect(css).toContain('.milkdown .ProseMirror li.vlaina-block-selected,');
    expect(css).toContain('--vlaina-list-row-selection-bleed-x-start: 48px;');
    expect(css).toContain('--vlaina-block-selection-bleed-x-start: var(--vlaina-list-row-selection-bleed-x-start);');
    expect(css).toContain('--vlaina-block-selection-bleed-x-end: 48px;');
    expect(css).toContain('.milkdown .ProseMirror :is(ul, ol) > li.vlaina-block-selected,');
    expect(css).toContain('--vlaina-list-row-selection-bleed-x-start: 48px;');
    expect(css).toContain('.milkdown .ProseMirror ul > li.vlaina-block-selected,');
    expect(css).toContain('.milkdown .ProseMirror li[data-item-type="task"].vlaina-block-selected,');
    expect(css).toContain('--vlaina-list-row-selection-bleed-x-start: 72px;');
    expect(css).toContain('.milkdown .ProseMirror ol > li.vlaina-block-selected,');
    expect(css).toContain('--vlaina-list-row-selection-bleed-x-start: 72px;');
    expect(css).toContain('.milkdown .ProseMirror :is(ul, ol) :is(ul, ol) > li.vlaina-block-selected,');
    expect(css).toContain('--vlaina-list-row-selection-bleed-x-start: 72px;');
    expect(css).toContain('.milkdown .ProseMirror :is(ul, ol) ol > li.vlaina-block-selected,');
    expect(css).toContain('--vlaina-list-row-selection-bleed-x-start: 96px;');
    expect(css).toContain('.milkdown .ProseMirror :is(ul, ol) :is(ul, ol) :is(ul, ol) > li.vlaina-block-selected,');
    expect(css).toContain('--vlaina-list-row-selection-bleed-x-start: 104px;');
    expect(css).toContain('.milkdown .ProseMirror :is(ul, ol) :is(ul, ol) ol > li.vlaina-block-selected,');
    expect(css).toContain('--vlaina-list-row-selection-bleed-x-start: 128px;');
    expect(css).not.toContain('margin-left: calc(-1 * var(--vlaina-block-selection-offset-x));');
  });

  it('keeps code block vertical selection bleed when selected inside a list item', () => {
    const css = readStyleFile('core.css');

    expect(css).toContain('.milkdown .ProseMirror li :is(');
    expect(css).toContain('  .code-block-container,');
    expect(css).toContain(').vlaina-block-selected {');
    expect(css).toContain('--vlaina-block-selection-bleed-y: 4px;');
  });

  it('disables vertical bleed for image block selection overlays', () => {
    const css = readStyleFile('core.css');

    expect(css).toContain('.milkdown .ProseMirror .image-block-container.vlaina-block-selected {');
    expect(css).toContain('--vlaina-block-selection-bleed-y: 0px;');
    expect(css).toContain('.milkdown .ProseMirror p.vlaina-block-selected:has(> .image-block-container) {');
  });

  it('collapses paragraph line box around standalone image blocks', () => {
    const css = readStyleFile('markdown.css');

    expect(css).toContain('.milkdown p:has(> .image-block-container) {');
    expect(css).toContain('font-size: 0;');
    expect(css).toContain('line-height: 0;');
    expect(css).toContain('margin-top: 1rem;');
    expect(css).toContain('margin-bottom: 1rem;');
    expect(css).toContain('.milkdown p:has(> .image-block-container) > .image-block-container {');
    expect(css).toContain('display: block;');
    expect(css).toContain('width: 100%;');
    expect(css).toContain('margin-top: 0;');
    expect(css).toContain('margin-bottom: 0;');
    expect(css).toContain('.milkdown .image-block-container {');
    expect(css).toContain('margin: 0;');
  });

  it('keeps embedded floating toolbars readable inside selected blocks', () => {
    const css = readStyleFile('floating-toolbar.css');

    expect(css).toContain('.milkdown .ProseMirror .vlaina-block-selected :is(');
    expect(css).toContain('.floating-toolbar-inner,');
    expect(css).toContain('.toolbar-tooltip');
    expect(css).toContain('color: var(--vlaina-text-primary, #18181b) !important;');
    expect(css).toContain('-webkit-text-fill-color: currentColor !important;');
    expect(css).toContain(') .toolbar-btn.active {');
    expect(css).toContain('color: var(--vlaina-accent, #2783de) !important;');
    expect(css).toContain(') .toolbar-btn:hover[class*="text-red-"] {');
    expect(css).toContain('color: #ef4444 !important;');
    expect(css).toContain(') .toolbar-btn[data-action="copy"].active {');
    expect(css).toContain('color: var(--vlaina-accent, #3b82f6) !important;');
  });

  it('keeps raw HTML tables compact instead of using editable markdown table sizing', () => {
    const css = readStyleFile('markdown.css');

    expect(css).toContain(".milkdown [data-type='html-block'] table {");
    expect(css).toContain(".milkdown [data-type='html-block'] th,");
    expect(css).toContain('min-width: 0;');
    expect(css).toContain('text-align: inherit;');
    expect(css).toContain(".milkdown [data-type='html-block'] img {");
    expect(css).toContain('border-radius: 0;');
    expect(css).toContain(".milkdown [data-type='html-block'] sub,");
    expect(css).toContain('line-height: 0;');
    expect(css).toContain('bottom: -0.25em;');
  });

  it('lets autolinks inherit the shared markdown link appearance', () => {
    const css = readStyleFile('extended.css');

    expect(css).not.toContain('.milkdown .autolink {');
    expect(css).not.toContain('text-underline-offset: 4px;');
  });

  it('keeps table-of-contents links from underlining on hover', () => {
    const css = readStyleFile('extended.css');

    expect(css).toContain('.milkdown .toc-link {');
    expect(css).toContain('text-decoration: none;');
    expect(css).not.toContain('text-underline-offset: 3px;');
    expect(css).not.toContain('text-decoration: underline;');
  });

  it('keeps notes editor links from drawing shared markdown hover borders', () => {
    const commonCss = readCommonMarkdownSurfaceStyle();
    const notesCss = readStyleFile('markdown.css');

    expect(commonCss).toContain('border-bottom: 1px solid transparent;');
    expect(commonCss).toContain('border-bottom-color: var(--vlaina-accent);');
    expect(notesCss).toContain('.vlaina-markdown-surface .milkdown a,');
    expect(notesCss).toContain('.vlaina-markdown-surface .milkdown a:hover {');
    expect(notesCss).toContain('border-bottom: none;');
    expect(notesCss).toContain('transition: none;');
  });

  it('renders footnote references as smaller inline-code chips with a capsule hover value', () => {
    const css = readStyleFile('extended.css');

    expect(css).toContain('.milkdown .footnote-ref {');
    expect(css).toContain('vertical-align: super;');
    expect(css).toContain('font-size: 0.68em;');
    expect(css).toContain('cursor: pointer;');
    expect(css).toContain('user-select: none;');
    expect(css).toContain('-webkit-user-select: none;');
    expect(css).toContain('.milkdown .footnote-ref-label {');
    expect(css).toContain('var(--crepe-color-inline-area, var(--vlaina-code-block-background, #f5f5f5))');
    expect(css).toContain('color: var(--sidebar-row-selected-text, var(--vlaina-accent));');
    expect(css).toContain('font-family: var(--crepe-font-code');
    expect(css).toContain('.milkdown .footnote-ref::after {');
    expect(css).toContain('content: attr(data-footnote-value);');
    expect(css).toContain('border-radius: 9999px;');
    expect(css).toContain('box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.7);');
    expect(css).toContain('transition: none;');
    expect(css).toContain('.milkdown .footnote-ref:hover::after,');
    expect(css).toContain('.milkdown .footnote-ref:focus-within::after {');
    expect(css).toContain('visibility: visible;');
    expect(css).toContain('.milkdown .footnote-def-label {');
    expect(css).toContain('user-select: none;');
    expect(css).toContain('-webkit-user-select: none;');
  });

  it('keeps block drag previews transparent and lightens preview text', () => {
    const css = readStyleFile('core.css');

    expect(css).toContain('.vlaina-block-drag-preview {');
    expect(css).toContain('background: transparent;');
    expect(css).toContain('border: 0;');
    expect(css).toContain('box-shadow: none;');
    expect(css).toContain('--vlaina-block-drag-preview-fg: color-mix(in srgb, var(--vlaina-text-primary, currentColor) 40%, white 60%);');
    expect(css).toContain('.vlaina-block-drag-preview-layer * {');
    expect(css).toContain('.vlaina-block-drag-preview-layer :is(ol, ul) {');
    expect(css).toContain('padding-inline-start: 1.75rem;');
    expect(css).toContain('.vlaina-block-drag-preview-layer li::marker {');
  });

  it('keeps block handle dragging on a grabbing cursor', () => {
    const css = readStyleFile('core.css');

    expect(css).toContain('body.vlaina-block-drag-active,');
    expect(css).toContain('body.vlaina-block-drag-active .milkdown,');
    expect(css).toContain('body.vlaina-block-drag-active .milkdown *,');
    expect(css).toContain('body.vlaina-block-drag-active .vlaina-block-drag-preview-layer,');
    expect(css).toContain('cursor: grabbing !important;');
  });

  it('keeps editor block selection color independent from global gray text tokens', () => {
    const css = readStyleFile('core.css');
    const source = readBlankAreaDragBoxSource();
    const lineFillSource = readBlockSelectionLineFillOverlaySource();

    expect(css).toContain('--vlaina-editor-block-selection-base: var(--vlaina-color-editor-block-selection, var(--vlaina-color-accent, #1e96eb));');
    expect(css).toContain('--vlaina-editor-block-selection-bg: var(--vlaina-color-editor-block-selection-bg, #bedffe);');
    expect(css).toContain('--vlaina-editor-block-selection-fg: var(--vlaina-color-editor-block-selection-fg, #fefbf9);');
    expect(css).toContain('--vlaina-editor-block-selection-handle: var(--vlaina-color-editor-block-selection-handle, var(--vlaina-text-primary, #2c2c2b));');
    expect(css).toContain('--vlaina-block-selection-color: var(--vlaina-editor-block-selection-bg, #bedffe);');
    expect(css).toContain('--vlaina-block-selection-bleed-x-start: 48px;');
    expect(css).toContain('--vlaina-block-selection-bleed-x-end: 48px;');
    expect(css).toContain('border-radius: 8px;');
    expect(css).toContain('box-decoration-break: clone;');
    expect(css).toContain('-webkit-box-decoration-break: clone;');
    expect(css).toContain('.milkdown .ProseMirror {');
    expect(css).toContain('position: relative;');
    expect(css).toContain('.milkdown.vlaina-block-selection-line-fill-host,');
    expect(css).toContain('.milkdown .vlaina-block-selection-line-fill-host {');
    expect(css).toContain('.milkdown .vlaina-block-selection-line-fill-layer {');
    expect(css).toContain('.milkdown .vlaina-block-selection-line-fill {');
    expect(css).toContain('.milkdown .ProseMirror .vlaina-block-selected-inline-line {');
    expect(css).toContain('background-color: transparent;');
    expect(css).toContain('box-shadow: none;');
    expect(css).toContain('color: var(--vlaina-editor-block-selection-fg, #fefbf9);');
    expect(source).toContain("const DRAG_BOX_COLOR = 'var(--vlaina-color-editor-block-selection-drag-box, rgb(190 223 254 / 0.42))';");
    expect(lineFillSource).toContain('function resolveLineFillLeft(paragraph: HTMLElement): number {');
    expect(lineFillSource).toContain('function resolveLineFillRight(view: EditorView, paragraph: HTMLElement): number {');
    expect(lineFillSource).toContain('const selectedBlockRight = editorRect.width > 0 ? editorRect.right : paragraphRect.right;');
    expect(lineFillSource).toContain('return Math.max(paragraphRect.right, selectedBlockRight) + resolveBlockSelectionBleedXEnd(paragraph);');
    expect(lineFillSource).toContain('const FALLBACK_BLOCK_SELECTION_BLEED_X_PX = 48;');
  });

  it('lets block selection and drag gestures pass over video embeds', () => {
    const css = readStyleFile('extended.css');

    expect(css).toContain('contain-intrinsic-size: auto 315px;');
    expect(css).toContain('.milkdown .video-block::after {');
    expect(css).toContain('.milkdown .video-block.ProseMirror-selectednode::after,');
    expect(css).toContain('.milkdown .video-block.vlaina-block-selected::after {');
    expect(css).toContain('.milkdown .video-block.ProseMirror-selectednode,');
    expect(css).toContain('.milkdown .video-block.vlaina-block-selected {');
    expect(css).toContain('--vlaina-block-selection-bleed-x-start: 48px;');
    expect(css).toContain('--vlaina-block-selection-bleed-x-end: 48px;');
    expect(css).toContain('background-color: var(--vlaina-block-selection-color);');
    expect(css).toContain('.vlaina-block-drag-preview .video-drag-preview-surface {');
    expect(css).toContain('background: transparent;');
    expect(css).toContain('.milkdown .ProseMirror.vlaina-block-selection-pending .video-block iframe,');
    expect(css).toContain('body.vlaina-block-drag-active .milkdown .video-block iframe,');
    expect(css).toContain('pointer-events: none;');
  });

  it('suppresses editor icon hover affordances while dragging a block selection', () => {
    const css = readStyleFile('core.css');

    expect(css).toContain('.milkdown .ProseMirror.vlaina-block-selection-pending :is(');
    expect(css).toContain('.heading-toggle-btn,');
    expect(css).toContain('.vlaina-block-control-btn,');
    expect(css).toContain('.vlaina-collapse-btn,');
    expect(css).toContain('.callout-icon-button,');
    expect(css).toContain('.milkdown-table-block .column-header-drag-control,');
    expect(css).toContain('pointer-events: none !important;');
    expect(css).toContain('opacity: 0 !important;');
    expect(css).toContain('background: transparent !important;');
    expect(css).toContain('transform: none !important;');
  });

  it('uses the editor block handle token for the visible drag handle', () => {
    const css = readStyleFile('core.css');

    expect(css).toContain('.vlaina-block-controls.visible,\n.vlaina-block-controls.dragging {');
    expect(css).toContain('pointer-events: auto;');
    expect(css).toContain('.vlaina-block-controls.visible .vlaina-block-control-handle,');
    expect(css).toContain('.vlaina-block-controls.dragging .vlaina-block-control-handle {');
    expect(css).toContain('color: var(--vlaina-editor-block-selection-handle, var(--vlaina-text-primary, #2c2c2b));');
    expect(css).toContain('.vlaina-block-controls.visible .vlaina-block-control-handle:hover {');
  });

  it('keeps list collapse toggles clear of wide ordered-list markers', () => {
    const css = readStyleFile('extended.css');

    expect(css).toContain('left: calc(var(--collapse-pos-list) - var(--vlaina-list-marker-extra, 0px));');
    expect(css).not.toContain('left: var(--collapse-pos-list);');
  });

  it('shrinks plain top-level paragraph line boxes so multiline text selections fit content width', () => {
    const css = readStyleFile('selection-width.css');

    expect(css).toContain(
      '.milkdown .ProseMirror > p:not([data-text-align]):not(.is-editor-empty):not(.vlaina-block-selected):not(:has(> br.ProseMirror-trailingBreak:only-child)):not(:has(> .image-block-container)) {'
    );
    expect(css).toContain('width: fit-content;');
    expect(css).toContain('max-width: 100%;');
  });

  it('keeps temporary tail empty paragraphs at the default block width for bottom typing', () => {
    const css = readStyleFile('selection-width.css');

    expect(css).toContain(':not(:has(> br.ProseMirror-trailingBreak:only-child))');
  });

  it('uses tabular numeric glyphs so digit-only line selections have equal width', () => {
    const css = readStyleFile('selection-width.css');

    expect(css).toContain('font-variant-numeric: tabular-nums;');
    expect(css).toContain('font-feature-settings: "tnum";');
  });

  it('renders editor text selections with inline overlays instead of block line boxes', () => {
    const css = normalizeLineEndings(readStyleFile('selection-width.css'));
    const source = readTextSelectionOverlaySource();
    const sharedSource = readSharedBlockNodeTypesSource();

    expect(css).toContain('.milkdown .ProseMirror.vlaina-text-selection-overlay-active *::selection {');
    expect(css).toContain('background-color: transparent !important;');
    expect(css).toContain('.milkdown .ProseMirror.vlaina-keyboard-selection-pending::selection,');
    expect(css).toContain('.milkdown .ProseMirror.vlaina-keyboard-selection-pending *::selection,');
    expect(css).toContain('.milkdown .ProseMirror.vlaina-pointer-native-selection *::selection {');
    expect(source).toContain("const KEYBOARD_SELECTION_PENDING_CLASS = 'vlaina-keyboard-selection-pending'");
    expect(source).toContain('view.dom.classList.add(KEYBOARD_SELECTION_PENDING_CLASS)');
    expect(css).toContain([
      '.milkdown .ProseMirror.vlaina-keyboard-selection-pending::selection,',
      '.milkdown .ProseMirror.vlaina-keyboard-selection-pending *::selection,',
      '.milkdown .ProseMirror.vlaina-pointer-native-selection::selection,',
      '.milkdown .ProseMirror.vlaina-pointer-native-selection *::selection {',
      '  background-color: transparent !important;',
      '  color: inherit !important;',
      '  -webkit-text-fill-color: inherit !important;',
      '}',
    ].join('\n'));
    expect(css).toContain('.milkdown .ProseMirror .vlaina-text-selection-overlay {');
    expect(css).toContain('box-shadow: none;');
    expect(css).toContain('border-radius: 3px;');
    expect(css).toContain('line-height: inherit;');
    expect(css).not.toContain('vlaina-ai-review-selection');
    expect(css).not.toContain('vlaina-link-selection-visible');
    expect(source).toContain("export const TEXT_SELECTION_OVERLAY_CLASS = 'vlaina-text-selection-overlay'");
    expect(source).toContain("const EDITOR_ONLY_TEXT_SELECTION_PLACEHOLDERS = new Set(['\\u200B', '\\u200C', '\\u2800']);");
    expect(source).toContain('EDITOR_ONLY_TEXT_SELECTION_PLACEHOLDERS.has(char)');
    expect(source).toContain('export function addTextSelectionOverlayDecorations(');
    expect(source).toContain('Decoration.inline(rangeFrom, rangeTo, {');
    expect(source).toContain('ATOMIC_TEXT_SELECTION_OVERLAY_NODE_NAMES.has(node.type.name)');
    expect(sharedSource).toContain('ATOMIC_TEXT_SELECTION_OVERLAY_NODE_NAMES');
    expect(sharedSource).toContain("'video'");
    expect(sharedSource).toContain("'toc'");
    expect(source).toContain('Decoration.node(pos, pos + node.nodeSize, {');
    expect(source).toContain("class: 'vlaina-block-selected vlaina-atomic-selected'");
    expect(source).toContain("class: TEXT_SELECTION_OVERLAY_CLASS");
    expect(source).toContain('node.isText');
    expect(source).toContain('selection instanceof TextSelection');
    expect(source).toContain('selection instanceof AllSelection');
    expect(source).toContain('hasSelectedBlocks(state)');
    expect(source).toContain('isTextSelectionOverlayEligible(view.state)');
  });

  it('keeps atomic select-all overlays visible when native selections are hidden', () => {
    const coreCss = readStyleFile('core.css');
    const selectionCss = readStyleFile('selection-width.css');

    expect(coreCss).toContain('.milkdown .ProseMirror .vlaina-block-selected:not(.code-block-container):not(.mermaid-block),');
    expect(coreCss).toContain(".milkdown .ProseMirror .vlaina-block-selected *:not(.code-block-container):not(.code-block-container *):not(.mermaid-block):not(.mermaid-block *) {");
    expect(coreCss).toContain('-webkit-text-fill-color: var(--vlaina-editor-block-selection-fg, #fefbf9);');
    expect(selectionCss).toContain(
      '.milkdown .ProseMirror.vlaina-text-selection-overlay-active .vlaina-atomic-selected,'
    );
    expect(selectionCss).toContain(
      '.milkdown .ProseMirror.vlaina-text-selection-overlay-active .vlaina-atomic-selected * {'
    );
    expect(selectionCss).toContain('user-select: none;');
    expect(selectionCss).toContain('-webkit-user-select: none;');
    expect(selectionCss).toContain('-webkit-text-fill-color: currentColor !important;');
    expect(selectionCss).toContain(
      '.milkdown .ProseMirror.vlaina-text-selection-overlay-active .vlaina-atomic-selected::selection,'
    );
    expect(selectionCss).toContain(
      '.milkdown .ProseMirror.vlaina-text-selection-overlay-active .vlaina-atomic-selected *::selection {'
    );
  });

  it('hides carets inside inline content while block selection is active', () => {
    const coreCss = readStyleFile('core.css');

    expect(coreCss).toContain('.milkdown .ProseMirror.vlaina-block-selection-active {');
    expect(coreCss).toContain('caret-color: transparent !important;');
  });

  it('keeps mermaid drag previews from inheriting generic preview text color', () => {
    const css = readStyleFile('extended.css');

    expect(css).toContain('.vlaina-block-drag-preview .mermaid-block,');
    expect(css).toContain('.vlaina-block-drag-preview .mermaid-block * {');
    expect(css).toContain('color: initial !important;');
    expect(css).toContain('-webkit-text-fill-color: initial !important;');
    expect(css).toContain('.vlaina-block-drag-preview .mermaid-drag-preview-surface {');
    expect(css).toContain('.vlaina-block-drag-preview .mermaid-drag-preview-image {');
  });

  it('reuses the standard text selection overlay for AI review ranges', () => {
    const css = readStyleFile('core.css');
    const source = readAiReviewSelectionSource();

    expect(source).toContain("import { addTextSelectionOverlayDecorations }");
    expect(source).toContain("from '../../selection/textSelectionOverlayPlugin'");
    expect(source).toContain('addTextSelectionOverlayDecorations(');
    expect(source).toContain('node.isText');
    expect(source).not.toContain('vlaina-ai-review-selection');
    expect(css).not.toContain('vlaina-ai-review-selection');
  });

  it('keeps link tooltip editing from drawing a persistent editor selection overlay', () => {
    const css = readStyleFile('core.css');
    const source = readLinkTooltipSource();
    const stateSource = readFileSync(
      resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/links/tooltip', 'linkTooltipState.ts'),
      'utf8'
    );

    expect(source).not.toContain("import { TEXT_SELECTION_OVERLAY_CLASS }");
    expect(source).not.toContain("class: TEXT_SELECTION_OVERLAY_CLASS");
    expect(stateSource).not.toContain('visibleSelectionFrom');
    expect(stateSource).not.toContain('visibleSelectionTo');
    expect(source).not.toContain('vlaina-link-selection-visible');
    expect(css).not.toContain('data-link-selection-visible');
    expect(css).not.toContain('vlaina-link-selection-visible');
  });

  it('keeps the link tooltip editor from drawing an animated accent underline', () => {
    const source = readLinkTooltipEditorSource();

    expect(source).not.toContain('scaleX');
    expect(source).not.toContain('bg-[var(--vlaina-accent)] origin-left');
  });

  it('keeps Milkdown link tooltip preview links from underlining on hover', () => {
    const source = readMilkdownLinkTooltipThemeSource();

    expect(source).toContain('& > .link-display {');
    expect(source).not.toContain('text-decoration: underline;');
  });

  it('keeps code block selection rendering on the CodeMirror selection layer', () => {
    const css = readStyleFile('code-block.css');

    expect(css).toContain('.milkdown .code-block-container > .code-block-container {');
    expect(css).toContain('margin-top: 0 !important;');
    expect(css).toContain('margin-bottom: 0 !important;');
    expect(css).toContain('border-radius: inherit;');
    expect(css).toContain('.milkdown .code-block-container .code-block-editable {');
    expect(css).toContain('padding: 0.25rem 0 1rem;');
    expect(css).toContain('.milkdown .code-block-container .cm-editor {');
    expect(css).toContain('background: transparent !important;');
    expect(css).toContain('.milkdown .code-block-container .cm-content {');
    expect(css).toContain('padding: 0 !important;');
    expect(css).toContain('color: var(--vlaina-code-syntax-foreground, #24292e);');
    expect(css).toContain('.milkdown .code-block-container .cm-line {');
    expect(css).toContain('padding: 0 1rem !important;');
    expect(css).toContain(
      '.milkdown .code-block-container .cm-editor.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {'
    );
    expect(css).toContain(
      ".milkdown .code-block-container:not(.ProseMirror-selectednode):not(.vlaina-block-selected):not([data-pm-selected='true']) .cm-editor:not(.cm-focused) > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {"
    );
    expect(css).toContain(
      ".milkdown .code-block-container[data-pm-selected='true'] .cm-editor:not(.cm-focused) > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {"
    );
    expect(css).toContain(
      ".milkdown .ProseMirror.vlaina-toolbar-copy-feedback-active .code-block-container[data-pm-selected='true'] .cm-editor:not(.cm-focused) > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {"
    );
    expect(css).toContain('.milkdown .code-block-container.ProseMirror-selectednode .cm-editor > .cm-scroller > .cm-selectionLayer .cm-selectionBackground,');
    expect(css).toContain('.milkdown .code-block-container.vlaina-block-selected .cm-editor > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {');
    expect(css).not.toContain(".milkdown .code-block-container[data-pm-selected='true'] .cm-editor > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {");
    expect(css).toContain('.milkdown .code-block-container.vlaina-block-selected .cm-editor,');
    expect(css).toContain('.milkdown .code-block-container.vlaina-block-selected .cm-scroller,');
    expect(css).toContain('.milkdown .code-block-container.vlaina-block-selected .cm-content,');
    expect(css).toContain('.milkdown .code-block-container.vlaina-block-selected .cm-line,');
    expect(css).toContain('.milkdown .code-block-container.vlaina-block-selected .cm-activeLine,');
    expect(css).not.toContain(".milkdown .code-block-container[data-pm-selected='true'] .cm-gutter-filler");
    expect(css).toContain('.milkdown .code-block-container.ProseMirror-selectednode .vlaina-code-block-header,');
    expect(css).toContain('.milkdown .code-block-container.ProseMirror-selectednode .code-block-editable,');
    expect(css).toContain('.milkdown .code-block-container.vlaina-block-selected .code-block-lazy-preview,');
    expect(css).not.toContain(".milkdown .code-block-container[data-pm-selected='true'] .code-block-lazy-line-numbers");
    expect(css).toContain('.milkdown .code-block-container.vlaina-block-selected-contained {');
    expect(css).not.toContain('.milkdown .ProseMirror li.vlaina-block-selected > .code-block-container {');
    expect(css).not.toContain('.milkdown .ProseMirror li.vlaina-block-selected > .code-block-container::before {');
    expect(css).toContain('.milkdown .ProseMirror .vlaina-block-selected .code-block-container {');
    expect(css).toContain('background: var(--vlaina-code-block-background);');
    expect(css).toContain('background-color: var(--vlaina-code-block-background);');
    expect(css).toContain('color: var(--vlaina-code-syntax-foreground, #24292e);');
    expect(css).toContain('.milkdown .ProseMirror .vlaina-block-selected .code-block-container * {');
    expect(css).toContain('.milkdown .ProseMirror .vlaina-block-selected .code-block-container .vlaina-code-block-language,');
    expect(css).toContain('.milkdown .ProseMirror .vlaina-block-selected .code-block-container .vlaina-code-block-language-label,');
    expect(css).toContain('color: var(--vlaina-code-syntax-muted, #6a737d);');
    expect(css).toContain('.milkdown .ProseMirror .vlaina-block-selected .code-block-container .cm-gutters,');
    expect(css).toContain('.milkdown .ProseMirror .vlaina-block-selected .code-block-container .cm-gutterElement,');
    expect(css).toContain('.milkdown .ProseMirror .vlaina-block-selected .code-block-container .cm-lineNumbers,');
    expect(css).not.toContain('.milkdown .ProseMirror li .code-block-container.vlaina-block-selected {');
    expect(css).not.toContain('.milkdown .ProseMirror li .code-block-container.vlaina-block-selected .cm-gutters,');
    expect(css).not.toContain('background-color: color-mix(in srgb, var(--vlaina-code-block-background), var(--vlaina-block-selection-color)) !important;');
    expect(css).toContain('background: var(--vlaina-code-block-background) !important;');
    expect(css).toContain('background-color: var(--vlaina-code-block-background) !important;');
    expect(css).toContain('--vlaina-block-selection-color: var(--vlaina-editor-block-selection-bg, #bedffe);');
    expect(css).toContain('background-color: var(--vlaina-block-selection-color);');
    expect(css).toContain('transition: none;');
    expect(css).toContain('.milkdown .code-block-container {');
    expect(css).toContain('transition: none;');
    expect(css).toContain('transition: none !important;');
    expect(css).toContain('border-radius: 1rem;');
    expect(css).toContain('0 var(--vlaina-block-selection-bleed-y) 0 0 var(--vlaina-block-selection-color),');
    expect(css).toContain('0 calc(-1 * var(--vlaina-block-selection-bleed-y)) 0 0 var(--vlaina-block-selection-color),');
    expect(css).toContain('.milkdown .code-block-container.vlaina-block-selected *,');
    expect(css).toContain('-webkit-text-fill-color: currentColor;');
    expect(css).not.toContain('.cm-editor.cm-focused .cm-content ::selection');
    expect(css).not.toContain('.cm-editor.cm-focused .cm-line ::selection');
  });

  it('extends selected list items below direct code blocks without changing code block layout', () => {
    const coreCss = readStyleFile('core.css');
    const codeCss = readStyleFile('code-block.css');

    expect(coreCss).toContain('.milkdown .ProseMirror li.vlaina-block-selected:has(> .code-block-container) {');
    expect(coreCss).toContain('--vlaina-list-contained-block-selection-bleed-y: 8px;');
    expect(coreCss).toContain('.milkdown .ProseMirror li.vlaina-block-selected:has(> .code-block-container)::after {');
    expect(coreCss).toContain('right: calc(-1 * var(--vlaina-block-selection-bleed-x-end));');
    expect(coreCss).toContain('left: calc(-1 * var(--vlaina-block-selection-bleed-x-start));');
    expect(coreCss).toContain('bottom: calc(-1 * var(--vlaina-list-contained-block-selection-bleed-y));');
    expect(coreCss).toContain('height: calc(var(--vlaina-list-contained-block-selection-bleed-y) + 8px);');
    expect(coreCss).toContain('border-bottom-right-radius: 8px;');
    expect(coreCss).toContain('border-bottom-left-radius: 8px;');
    expect(coreCss).toContain('.milkdown .ProseMirror li.vlaina-block-selected:has(> .code-block-container) > * {');
    expect(codeCss).not.toContain('display: flow-root;');
    expect(codeCss).not.toContain('overflow: visible;');
  });

  it('keeps rich child blocks at their original colors during block selection', () => {
    const coreCss = readStyleFile('core.css');
    const mathCss = readStyleFile('math-editor.css');

    expect(coreCss).not.toContain('.milkdown .ProseMirror .vlaina-block-selected:is(');
    expect(coreCss).toContain('.milkdown .ProseMirror .vlaina-block-selected :is(');
    expect(coreCss).toContain('.milkdown .ProseMirror .vlaina-block-selected-contained:is(');
    expect(coreCss).toContain('.milkdown .ProseMirror li :is(');
    expect(coreCss).toContain('.image-block-container,');
    expect(coreCss).toContain('.video-block,');
    expect(coreCss).toContain("[data-type='math-block'],");
    expect(coreCss).toContain("[data-type='math-inline'],");
    expect(coreCss).toContain('.milkdown-table-block,');
    expect(coreCss).toContain('table');
    expect(coreCss).toContain('background: transparent !important;');
    expect(coreCss).toContain('box-shadow: none !important;');
    expect(coreCss).not.toContain('background-color: inherit;');
    expect(mathCss).not.toContain('.milkdown .ProseMirror .vlaina-block-selected:is(');
    expect(mathCss).toContain('.milkdown .ProseMirror .vlaina-block-selected :is(');
    expect(mathCss).toContain('.milkdown .ProseMirror .vlaina-block-selected-contained:is(');
    expect(mathCss).toContain('.milkdown .ProseMirror li :is(');
    expect(mathCss).toContain('.mermaid-block');
    expect(coreCss).toContain('.milkdown .ProseMirror .vlaina-block-selected:not(.code-block-container):not(.mermaid-block),');
    expect(coreCss).toContain(':not(.code-block-container *):not(.mermaid-block):not(.mermaid-block *) {');
    expect(coreCss).not.toContain('.milkdown .ProseMirror .mermaid-block.vlaina-block-selected * {');
    expect(mathCss).not.toContain('.milkdown .ProseMirror .mermaid-block.vlaina-block-selected,\n.milkdown .ProseMirror.vlaina-block-selection-pending');
    expect(mathCss).toContain('.milkdown .ProseMirror.vlaina-block-selection-pending .mermaid-block.vlaina-block-selected:is(:hover, :focus-visible) {');
    expect(mathCss).toContain('background: var(--vlaina-block-selection-color, var(--vlaina-editor-block-selection-bg, #bedffe)) !important;');
  });

  it('paints selected tables with the standard block selection frame', () => {
    const coreCss = readStyleFile('core.css');

    expect(coreCss).toContain('.milkdown .milkdown-table-block {');
    expect(coreCss).toContain('margin: 8px 0 0;');
    expect(coreCss).toContain('.milkdown .milkdown-table-block:first-child {');
    expect(coreCss).toContain('margin-top: 0;');
    expect(coreCss).toContain('.milkdown .ProseMirror .milkdown-table-block.vlaina-block-selected .table-content-host,');
    expect(coreCss).toContain('.milkdown .ProseMirror .milkdown-table-block.ProseMirror-selectednode .table-content-host {');
    expect(coreCss).toContain('background: transparent !important;');
    expect(coreCss).toContain('box-shadow: none !important;');
    expect(coreCss).toContain('align-items: flex-start;');
    expect(coreCss).toContain('.milkdown .ProseMirror .milkdown-table-block.vlaina-block-selected,');
    expect(coreCss).toContain('.milkdown .ProseMirror .milkdown-table-block.ProseMirror-selectednode {');
    expect(coreCss).toContain('--vlaina-block-selection-bleed-y: 4px;');
    expect(coreCss).toContain('--vlaina-block-selection-bleed-x-start: 48px;');
    expect(coreCss).toContain('--vlaina-block-selection-bleed-x-end: 48px;');
    expect(coreCss).toContain('--vlaina-block-selection-top-reserve: 0px;');
    expect(coreCss).toContain('--vlaina-block-selection-scrollbar-reserve: 0px;');
    expect(coreCss).toContain('background: transparent !important;');
    expect(coreCss).toContain('border-radius: 8px;');
    expect(coreCss).toContain('.milkdown .ProseMirror .milkdown-table-block.vlaina-block-selected:has(.table-wrapper[style*="--table-block-table-min-width: 0px"]),');
    expect(coreCss).toContain('--vlaina-block-selection-top-reserve: var(--vlaina-block-selection-bleed-y);');
    expect(coreCss).toContain('--vlaina-block-selection-scrollbar-reserve: var(--table-block-scrollbar-reserve, 14px);');
    expect(coreCss).toContain('.milkdown .ProseMirror .milkdown-table-block.vlaina-block-selected::before,');
    expect(coreCss).toContain('.milkdown .ProseMirror .milkdown-table-block.ProseMirror-selectednode::before {');
    expect(coreCss).toContain('top: calc(var(--vlaina-block-selection-top-reserve, 0px) - var(--vlaina-block-selection-bleed-y));');
    expect(coreCss).toContain('bottom: calc(var(--vlaina-block-selection-scrollbar-reserve, 0px) - var(--vlaina-block-selection-bleed-y));');
    expect(coreCss).toContain('.milkdown .ProseMirror .milkdown-table-block.vlaina-block-selected > *,');
    expect(coreCss).toContain('.milkdown .ProseMirror .milkdown-table-block.ProseMirror-selectednode > * {');
    expect(coreCss).toContain('.milkdown .ProseMirror .milkdown-table-block.vlaina-block-selected .table-wrapper[style*="--table-block-table-min-width: 0px"] .table-scroll,');
    expect(coreCss).toContain('.milkdown .ProseMirror .milkdown-table-block.ProseMirror-selectednode .table-wrapper[style*="--table-block-table-min-width: 0px"] .table-scroll {');
    expect(coreCss).toContain('margin-top: calc(-1 * var(--vlaina-block-selection-bleed-y));');
    expect(coreCss).toContain('margin-bottom: calc(-1 * var(--vlaina-block-selection-bleed-y));');
    expect(coreCss).toContain('padding-top: var(--vlaina-block-selection-bleed-y);');
    expect(coreCss).toContain('padding-bottom: var(--vlaina-block-selection-bleed-y);');
    expect(
      extractCssRule(
        coreCss,
        '.milkdown .ProseMirror .milkdown-table-block.vlaina-block-selected .table-wrapper[style*="--table-block-table-min-width: 0px"] .table-scroll,'
      )
    ).not.toContain('background: var(--vlaina-block-selection-color);');
    expect(coreCss).toContain('.milkdown .ProseMirror .milkdown-table-block.vlaina-block-selected .table-scroll-track,');
    expect(coreCss).toContain('.milkdown .ProseMirror .milkdown-table-block.ProseMirror-selectednode .table-scroll-track {');
    expect(coreCss).toContain('position: relative;');
    expect(coreCss).toContain('.milkdown .ProseMirror .milkdown-table-block.vlaina-block-selected .table-wrapper[style*="--table-block-table-min-width: 0px"] .table-content-host::before,');
    expect(coreCss).toContain('.milkdown .ProseMirror .milkdown-table-block.ProseMirror-selectednode .table-wrapper[style*="--table-block-table-min-width: 0px"] .table-content-host::before {');
    expect(coreCss).toContain("content: '';");
    expect(coreCss).toContain('top: calc(-1 * var(--vlaina-block-selection-bleed-y));');
    expect(coreCss).toContain('right: calc(-1 * var(--vlaina-block-selection-bleed-x-end));');
    expect(coreCss).toContain('bottom: calc(-1 * var(--vlaina-block-selection-bleed-y));');
    expect(coreCss).toContain('left: calc(-1 * var(--vlaina-block-selection-bleed-x-start));');
    expect(coreCss).toContain('.milkdown .ProseMirror .milkdown-table-block.vlaina-block-selected .table-scroll-spacer,');
    expect(coreCss).toContain('.milkdown .ProseMirror .milkdown-table-block.vlaina-block-selected .table-content-host > *,');
    expect(coreCss).toContain('z-index: 1;');
    expect(coreCss).toContain('.milkdown .ProseMirror .milkdown-table-block.vlaina-block-selected :is(th, td),');
    expect(coreCss).toContain('.milkdown .ProseMirror .milkdown-table-block.ProseMirror-selectednode :is(th, td) {');
    expect(coreCss).toContain('background-color: transparent !important;');
  });

  it('keeps table column drag handles dark even inside selected table blocks', () => {
    const coreCss = readStyleFile('core.css');

    expect(coreCss).toContain('.milkdown .milkdown-table-block .column-header-drag-control,');
    expect(coreCss).toContain(".milkdown .milkdown-table-block .column-header-drag-control[data-active='true'],");
    expect(coreCss).toContain('.milkdown .milkdown-table-block .column-header-drag-control__grip {');
    expect(coreCss).toContain('color: var(--vlaina-text-primary, #111827) !important;');
    expect(coreCss).toContain('-webkit-text-fill-color: var(--vlaina-text-primary, #111827) !important;');
    expect(coreCss).toContain('background: currentColor;');
    expect(coreCss).toContain('box-shadow: 6px 0 currentColor, 12px 0 currentColor;');
  });

  it('keeps table column menus readable inside selected table blocks', () => {
    const coreCss = readStyleFile('core.css');

    expect(coreCss).toContain('border-radius: 22px;');
    expect(coreCss).toContain('.milkdown .milkdown-table-block .column-header-drag-menu__item {');
    expect(coreCss).toContain('color: var(--notes-sidebar-text) !important;');
    expect(coreCss).toContain('-webkit-text-fill-color: var(--notes-sidebar-text) !important;');
    expect(coreCss).toContain('background: var(--notes-sidebar-row-hover);');
    expect(coreCss).toContain('color: #dc2626 !important;');
    expect(coreCss).toContain('-webkit-text-fill-color: #dc2626 !important;');
    expect(coreCss).toContain('background: #fef2f2;');
    expect(coreCss).toContain('color: #f87171 !important;');
    expect(coreCss).toContain('background: rgba(127, 29, 29, 0.2);');
  });

  it('keeps selected math blocks inside selected list items vertically covered', () => {
    const coreCss = readStyleFile('core.css');
    const mathCss = readStyleFile('math-editor.css');

    expect(coreCss).toContain('.milkdown .ProseMirror li.vlaina-block-selected :is(');
    expect(coreCss).toContain(').vlaina-block-selected-contained {');
    expect(coreCss).toContain('0 var(--vlaina-block-selection-bleed-y, 4px) 0 0 var(--vlaina-block-selection-color),');
    expect(mathCss).toContain('.milkdown .ProseMirror li.vlaina-block-selected :is(');
    expect(mathCss).toContain(').vlaina-block-selected-contained {');
    expect(mathCss).toContain('0 calc(-1 * var(--vlaina-block-selection-bleed-y, 4px)) 0 0 var(--vlaina-block-selection-color) !important;');
  });

  it('restores formula and mermaid text color while preserving mermaid shape colors on selected hover', () => {
    const css = readStyleFile('math-editor.css');

    expect(css).toContain('.milkdown .ProseMirror .vlaina-block-selected :is(');
    expect(css).toMatch(
      /\[data-type='math-inline'\],\s*\[data-type='math-block'\]\s*\):is\(:hover, :focus-visible, \.ProseMirror-selectednode, \.vlaina-preview-context-menu-active\) :is\(svg, svg \*, \.katex, \.katex \*, text, tspan, path, rect, circle, ellipse, line, polyline, polygon\),/
    );
    expect(css).toMatch(
      /\.mermaid-block\s*\):is\(:hover, :focus-visible, \.ProseMirror-selectednode, \.vlaina-preview-context-menu-active\) :is\(text, tspan, \.nodeLabel, \.label, \.edgeLabel\)\s*[, {]/
    );
    expect(css).not.toContain('.mermaid-block\n):is(:hover, :focus-visible, .ProseMirror-selectednode, .vlaina-preview-context-menu-active) :is(svg, svg *, .katex, .katex *, text, tspan, path, rect, circle, ellipse, line, polyline, polygon)');
    expect(css).toContain('color: var(--vlaina-text-primary, #27272A) !important;');
    expect(css).toContain('-webkit-text-fill-color: var(--vlaina-text-primary, #27272A) !important;');
    expect(css).toContain('fill: var(--vlaina-text-primary, #27272A) !important;');
    expect(css).toContain('stroke: var(--vlaina-text-primary, #27272A) !important;');
    expect(css).toContain(').vlaina-block-selected:is(:hover, :focus-visible, .ProseMirror-selectednode, .vlaina-preview-context-menu-active),');
  });

  it('keeps selected CodeMirror gutter surfaces transition-free', () => {
    const codeBlockCss = readStyleFile('code-block.css');
    const frontmatterCss = readStyleFile('frontmatter.css');

    expect(codeBlockCss).toContain('.milkdown .code-block-container .cm-gutters,');
    expect(codeBlockCss).toContain('.milkdown .code-block-container .cm-gutterElement,');
    expect(codeBlockCss).toContain('.milkdown .code-block-container .cm-lineNumbers,');
    expect(codeBlockCss).toContain('transition: none !important;');
    expect(frontmatterCss).toContain('.milkdown .frontmatter-block-container .cm-gutters,');
    expect(frontmatterCss).toContain('.milkdown .frontmatter-block-container .cm-gutterElement,');
    expect(frontmatterCss).toContain('.milkdown .frontmatter-block-container .cm-lineNumbers,');
    expect(frontmatterCss).toContain('transition: none !important;');
  });

  it('keeps toolbar previews on the applied shadow document path', () => {
    const codeBlockCss = readStyleFile('code-block.css');
    const markdownCss = readStyleFile('markdown.css');
    const source = readPreviewStylesSource();
    const appliedPreviewSource = readAppliedPreviewSource();

    expect(source).toContain('function renderAppliedPreview');
    expect(source).toContain('convertBlockType(previewView, blockType);');
    expect(source).toContain('toggleMark(previewView, markName);');
    expect(source).toContain('setLink(previewView, null);');
    expect(source).toContain('setTextColor(previewView, color);');
    expect(source).toContain('setBgColor(previewView, color);');
    expect(source).toContain('setTextAlignment(previewView, alignment);');
    expect(source).toContain('createAppliedPreviewState(view, apply)');
    expect(source).toContain('renderAppliedPreviewDocument(previewState, view.dom, view.dom.ownerDocument, undefined, view)');
    expect(appliedPreviewSource).toContain('DOMSerializer.fromSchema(state.schema)');
    expect(appliedPreviewSource).toContain('new CodeBlockNodeView(entry.node, view, () => undefined)');
    expect(source).toContain('cleanupAppliedPreviewDocument(node)');
    expect(source).not.toContain('data-preview-block-type');
    expect(codeBlockCss).not.toContain('data-preview-block-type');
    expect(markdownCss).not.toContain('data-preview-block-type');
    expect(markdownCss).not.toContain('data-preview-hide');
    expect(markdownCss).not.toContain('data-preview-restore');
    expect(source).not.toContain('renderResultSurfacePreview');
  });

  it('keeps all floating toolbar preview surfaces off the removed simulation paths', () => {
    const forbiddenPatterns = [
      'inlinePreviewPlugin',
      'blockPreviewDomAdjustments',
      'blockPreviewListLabel',
      'renderResultSurfacePreview',
      'data-preview-block-type',
      'data-preview-hide',
      'data-preview-restore',
    ];

    for (const file of [...readFloatingToolbarSourceFiles(), ...readEditorStyleSourceFiles()]) {
      for (const pattern of forbiddenPatterns) {
        expect(file.source, `${pattern} leaked into ${file.path}`).not.toContain(pattern);
      }
    }
  });

  it('keeps frontmatter selection rendering on the CodeMirror selection layer', () => {
    const css = readStyleFile('frontmatter.css');

    expect(css).toContain('.milkdown .frontmatter-block-container .frontmatter-block-editor {');
    expect(css).toContain('padding: 0.625rem 0;');
    expect(css).toContain('.milkdown .frontmatter-block-container .cm-content {');
    expect(css).toContain('padding: 0 !important;');
    expect(css).toContain('.milkdown .frontmatter-block-container .cm-line {');
    expect(css).toContain('padding: 0 0.875rem !important;');
    expect(css).toContain('transition: none !important;');
    expect(css).toContain('.milkdown .frontmatter-block-container.ProseMirror-selectednode {');
    expect(css).toContain('--vlaina-block-selection-bleed-x-start: 48px;');
    expect(css).toContain('--vlaina-block-selection-bleed-x-end: 48px;');
    expect(css).toContain('background-color: var(--vlaina-block-selection-color);');
    expect(css).toContain(
      '.milkdown .frontmatter-block-container .cm-editor.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {'
    );
    expect(css).toContain(
      ".milkdown .frontmatter-block-container:not(.ProseMirror-selectednode):not(.vlaina-block-selected):not([data-pm-selected='true']) .cm-editor:not(.cm-focused) > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {"
    );
    expect(css).toContain(
      ".milkdown .ProseMirror.vlaina-toolbar-copy-feedback-active .frontmatter-block-container[data-pm-selected='true'] .cm-editor:not(.cm-focused) > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {"
    );
    expect(css).toContain('background: transparent !important;');
    expect(css).not.toContain('.cm-editor.cm-focused .cm-content ::selection');
    expect(css).not.toContain('.cm-editor.cm-focused .cm-line ::selection');
  });

  it('does not hide unfocused embedded CodeMirror text selections', () => {
    const codeBlockCss = readStyleFile('code-block.css');
    const frontmatterCss = readStyleFile('frontmatter.css');

    expect(codeBlockCss).not.toContain(
      '.milkdown .code-block-container .cm-editor:not(.cm-focused) > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {\n  background: transparent !important;'
    );
    expect(frontmatterCss).not.toContain(
      '.milkdown .frontmatter-block-container .cm-editor:not(.cm-focused) > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {\n  background: transparent !important;'
    );
  });

  it('keeps floating toolbar hover states flat without lift transforms', () => {
    const css = readStyleFile('floating-toolbar.css');

    expect(css).toContain('.toolbar-btn:hover {');
    expect(css).toContain('background-color: var(--vlaina-hover, #f4f4f5);');
    expect(css).not.toContain('transform: translateY(-1px);');
  });

  it('keeps the floating toolbar link editor from drawing an accent rail line', () => {
    const css = readStyleFile('floating-toolbar.css');
    const source = readUrlRailEditorSource();

    expect(source).not.toContain('link-editor-rail-line');
    expect(css).not.toContain('.link-editor-rail-line');
    expect(css).not.toContain('.link-editor-rail-input:focus + .link-editor-rail-line');
    expect(css).not.toContain('transform-origin: center;');
  });

  it('keeps the floating toolbar color button hover surface transparent', () => {
    const css = readStyleFile('floating-toolbar.css');

    expect(css).toContain('.toolbar-btn[data-action="color"]:hover {');
    expect(css).toContain('background-color: transparent;');
    expect(css).toContain('.dark .toolbar-btn[data-action="color"]:hover {');
  });

  it('keeps active color swatch borders transparent', () => {
    const css = readStyleFile('floating-toolbar.css');

    expect(css).toContain('.color-picker-item.active {');
    expect(css).toContain('border-color: transparent !important;');
  });

  it('places floating toolbar shortcut tooltips below the hovered button', () => {
    const css = readStyleFile('floating-toolbar.css');
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/components/Notes/features/Editor/plugins/floating-toolbar/toolbarInteractions.ts'
      ),
      'utf8'
    );

    expect(source).toContain("tooltip.dataset.side = 'bottom';");
    expect(source).toContain('tooltip.style.top = `${rect.bottom + 8}px`;');
    expect(source).toContain("tooltip.style.transform = 'translate(-50%, 0)';");
    expect(css).toContain('transform-origin: center top;');
    expect(css).toContain('transform: translate(-50%, -4px) scale(0.95);');
    expect(css).toContain('transform: translate(-50%, 0) scale(1);');
    expect(css).toContain('top: 0;');
    expect(css).toContain('transform: translate(-50%, calc(-50% + 2px)) rotate(45deg);');
  });

  it('uses an opaque shortcut tooltip background', () => {
    const css = readStyleFile('floating-toolbar.css');

    expect(css).toContain('--toolbar-tooltip-bg: #ffffff;');
    expect(css).toContain('--toolbar-tooltip-fg: #18181b;');
    expect(css).toContain('background-color: var(--toolbar-tooltip-bg);');
    expect(css).toContain('.dark .toolbar-tooltip {');
    expect(css).toContain('--toolbar-tooltip-bg: #18181b;');
    expect(css).toContain('--toolbar-tooltip-fg: #ffffff;');
    expect(css).not.toContain('background-color: hsl(var(--foreground));');
  });

  it('keeps block dropdown icons neutral and selected items on the shared sidebar row surface', () => {
    const css = readStyleFile('floating-toolbar.css');

    expect(css).toContain('--block-dropdown-active-bg: var(--notes-sidebar-row-active');
    expect(css).toContain('--block-dropdown-active-fg: var(--sidebar-row-selected-text');
    expect(css).toContain('border-radius: 0.5rem;');
    expect(css).toContain('background-color: var(--notes-sidebar-row-hover');
    expect(css).toContain('.block-dropdown-item-icon {');
    expect(css).toContain('color: currentColor;');
    expect(css).toContain('background-color: var(--block-dropdown-active-bg);');
    expect(css).toContain('color: var(--block-dropdown-active-fg);');
  });

  it('applies block preview sizes directly without transform scaling', () => {
    const source = readPreviewStylesSource();

    expect(source).not.toContain('delete nextStyles.fontSize;');
    expect(source).not.toContain('delete nextStyles.lineHeight;');
    expect(source).not.toContain('scale(');
    expect(source).not.toContain('transformOrigin');
  });

  it('serializes inline hover previews from the applied shadow editor schema', () => {
    const source = readAppliedPreviewSource();

    expect(source).toContain("DOMSerializer");
    expect(source).toContain(".fromSchema(state.schema)");
    expect(source).toContain("serializeFragment(");
  });

  it('keeps applied preview root typography pinned to the visible editor root', () => {
    const source = readAppliedPreviewSource();

    expect(source).toContain('stabilizePreviewRootTypography');
    expect(source).toContain('window.getComputedStyle(sourceDom)');
    expect(source).toContain("'lineHeight'");
  });

  it('rerenders AI review previews when the review width changes', () => {
    const source = readFloatingToolbarPluginViewSource();

    expect(source).toContain('reviewWidth === null ?');
    expect(source).toContain('const renderState = getReviewRenderState(review, reviewWidth);');
  });

  it('clears applied toolbar previews whenever the toolbar is hidden or reset', () => {
    const source = readFloatingToolbarPluginViewSource();

    expect(source).toContain('const hideToolbarAndReset = () => {');
    expect(source).toContain('clearFormatPreview(editorView);');
  });

  it('self-heals stale applied toolbar previews on the next outside mouse down', () => {
    const source = readFloatingToolbarPluginViewSource();

    expect(source).toContain('const isToolbarEventTarget = (target: EventTarget | null) => {');
    expect(source).toContain('if (hasActiveAppliedPreview(editorView) && !isToolbarEventTarget(event.target)) {');
    expect(source).toContain('clearFormatPreview(editorView);');
  });

  it('keeps the code block theme aligned with the CSS padding model', () => {
    const source = readCodeBlockThemeSource();

    expect(source).toContain("padding: '0'");
    expect(source).toContain("minHeight: '1.75rem'");
    expect(source).toContain("'.cm-line': {");
    expect(source).toContain("padding: '0 1rem'");
    expect(source).not.toContain('.cm-content::selection');
    expect(source).not.toContain('.cm-line::selection');
  });
});
