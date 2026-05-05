import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readStyleFile(name: string) {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/styles', name),
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

function readTypographySource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/styles', 'typography.css'),
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

function readTextSelectionOverlaySource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/selection', 'textSelectionOverlayPlugin.ts'),
    'utf8'
  );
}

describe('editor embedded CodeMirror selection styles', () => {
  it('keeps nested list block selection overlays from stacking darker backgrounds', () => {
    const css = readStyleFile('core.css');

    expect(css).toContain('.milkdown .ProseMirror li.vlaina-block-selected .vlaina-block-selected {');
    expect(css).toContain('background-color: transparent;');
    expect(css).toContain('box-shadow: none;');
  });

  it('disables vertical bleed for image block selection overlays', () => {
    const css = readStyleFile('core.css');

    expect(css).toContain('.milkdown .ProseMirror .image-block-container.vlaina-block-selected {');
    expect(css).toContain('--vlaina-block-selection-bleed-y: 0px;');
    expect(css).toContain('.milkdown .ProseMirror p.vlaina-block-selected:has(> .image-block-container:only-child) {');
  });

  it('collapses paragraph line box around standalone image blocks', () => {
    const css = readTypographySource();

    expect(css).toContain('.milkdown p:has(> .image-block-container:only-child) {');
    expect(css).toContain('font-size: 0;');
    expect(css).toContain('line-height: 0;');
    expect(css).toContain('margin-top: 1rem;');
    expect(css).toContain('margin-bottom: 1rem;');
    expect(css).toContain('.milkdown p:has(> .image-block-container:only-child) > .image-block-container {');
    expect(css).toContain('margin-top: 0;');
    expect(css).toContain('margin-bottom: 0;');
  });

  it('keeps block drag previews transparent and lightens preview text', () => {
    const css = readStyleFile('core.css');

    expect(css).toContain('.vlaina-block-drag-preview {');
    expect(css).toContain('background: transparent;');
    expect(css).toContain('border: 0;');
    expect(css).toContain('box-shadow: none;');
    expect(css).toContain('--vlaina-block-drag-preview-fg: color-mix(in srgb, var(--vlaina-text-primary, currentColor) 40%, white 60%);');
    expect(css).toContain('.vlaina-block-drag-preview-layer * {');
  });

  it('keeps block handle dragging on a grabbing cursor', () => {
    const css = readStyleFile('core.css');

    expect(css).toContain('body.vlaina-block-drag-active,');
    expect(css).toContain('body.vlaina-block-drag-active * {');
    expect(css).toContain('cursor: grabbing !important;');
  });

  it('keeps editor block selection color independent from global gray text tokens', () => {
    const css = readStyleFile('core.css');
    const source = readBlankAreaDragBoxSource();

    expect(css).toContain('--vlaina-editor-block-selection-base: var(--vlaina-color-editor-block-selection, #71717a);');
    expect(css).toContain('color-mix(in srgb, var(--vlaina-editor-block-selection-base, #71717a) 14%, transparent)');
    expect(source).toContain('color-mix(in srgb, var(--vlaina-color-editor-block-selection, #71717a) 18%, transparent)');
  });

  it('lets block selection and drag gestures pass over video embeds', () => {
    const css = readStyleFile('extended.css');

    expect(css).toContain('.milkdown .video-block::after {');
    expect(css).toContain('.milkdown .video-block.ProseMirror-selectednode::after {');
    expect(css).toContain('.milkdown .video-block.vlaina-block-selected {');
    expect(css).toContain('box-shadow: none;');
    expect(css).toContain('.vlaina-block-drag-preview .video-drag-preview-surface {');
    expect(css).toContain('background: transparent;');
    expect(css).toContain('body.vlaina-block-selection-pending .milkdown .video-block iframe,');
    expect(css).toContain('body.vlaina-block-dragging-cursor .milkdown .video-block iframe,');
    expect(css).toContain('body.vlaina-block-drag-active .milkdown .video-block iframe,');
    expect(css).toContain('pointer-events: none;');
  });

  it('shrinks plain top-level paragraph line boxes so multiline text selections fit content width', () => {
    const css = readStyleFile('selection-width.css');

    expect(css).toContain(
      '.milkdown .ProseMirror > p:not([data-text-align]):not(.is-editor-empty):not(.vlaina-block-selected):not(:has(> br.ProseMirror-trailingBreak:only-child)):not(:has(> .image-block-container:only-child)) {'
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
    const css = readStyleFile('selection-width.css');
    const source = readTextSelectionOverlaySource();

    expect(css).toContain('.milkdown .ProseMirror.vlaina-text-selection-overlay-active *::selection {');
    expect(css).toContain('background-color: transparent !important;');
    expect(css).toContain('.milkdown .ProseMirror .vlaina-text-selection-overlay {');
    expect(css).toContain('line-height: normal;');
    expect(source).toContain('Decoration.inline(from, to, {');
    expect(source).toContain("class: TEXT_SELECTION_OVERLAY_CLASS");
    expect(source).toContain('node.isText');
    expect(source).toContain('selection instanceof TextSelection');
    expect(source).toContain('selection instanceof AllSelection');
    expect(source).toContain('hasSelectedBlocks(state)');
    expect(source).toContain('isTextSelectionOverlayEligible(view.state)');
  });

  it('keeps code block selection rendering on the CodeMirror selection layer', () => {
    const css = readStyleFile('code-block.css');

    expect(css).toContain('.milkdown .code-block-container .code-block-editable {');
    expect(css).toContain('padding: 0.25rem 0 1rem;');
    expect(css).toContain('.milkdown .code-block-container .cm-content {');
    expect(css).toContain('padding: 0 !important;');
    expect(css).toContain('.milkdown .code-block-container .cm-line {');
    expect(css).toContain('padding: 0 1rem !important;');
    expect(css).toContain(
      '.milkdown .code-block-container .cm-editor.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {'
    );
    expect(css).toContain(
      ".milkdown .code-block-container[data-pm-selected='true'] .cm-editor:not(.cm-focused) > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {"
    );
    expect(css).toContain('background: transparent !important;');
    expect(css).not.toContain('.cm-editor.cm-focused .cm-content ::selection');
    expect(css).not.toContain('.cm-editor.cm-focused .cm-line ::selection');
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
    expect(source).toContain('renderAppliedPreviewDocument(previewState, view.dom, view.dom.ownerDocument)');
    expect(appliedPreviewSource).toContain('DOMSerializer.fromSchema(state.schema)');
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
    expect(css).toContain(
      '.milkdown .frontmatter-block-container .cm-editor.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {'
    );
    expect(css).toContain('background: transparent !important;');
    expect(css).not.toContain('.cm-editor.cm-focused .cm-content ::selection');
    expect(css).not.toContain('.cm-editor.cm-focused .cm-line ::selection');
  });

  it('keeps floating toolbar hover states flat without lift transforms', () => {
    const css = readStyleFile('floating-toolbar.css');

    expect(css).toContain('.toolbar-btn:hover {');
    expect(css).toContain('background-color: var(--vlaina-hover, #f4f4f5);');
    expect(css).not.toContain('transform: translateY(-1px);');
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

  it('keeps block dropdown icons neutral and selected items on the requested blue surface', () => {
    const css = readStyleFile('floating-toolbar.css');

    expect(css).toContain('--block-dropdown-active-bg: #ecf6ff;');
    expect(css).toContain('--block-dropdown-active-fg: #41a8ea;');
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
