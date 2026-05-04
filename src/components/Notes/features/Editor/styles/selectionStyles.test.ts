import { readFileSync } from 'node:fs';
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

function readBlankAreaDragBoxSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/cursor', 'blankAreaDragBoxPlugin.ts'),
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

  it('renders code block hover preview with the same container surface as real code blocks', () => {
    const css = readStyleFile('code-block.css');
    const source = readPreviewStylesSource();

    expect(css).toContain('.milkdown [data-preview-block-type="codeBlock"] {');
    expect(css).toContain('background: var(--vlaina-code-block-background) !important;');
    expect(css).toContain('border-radius: 1rem !important;');
    expect(css).toContain('padding: 2.75rem 1rem 1rem !important;');
    expect(css).toContain('overflow-x: auto !important;');
    expect(css).toContain('white-space: pre !important;');
    expect(css).toContain('.milkdown [data-preview-block-type="codeBlock"]::before {');
    expect(css).toContain('content: attr(data-preview-code-language);');
    expect(css).toContain('.dark .milkdown [data-preview-block-type="codeBlock"] {');
    expect(source).toContain("'data-preview-block-type': blockType");
    expect(source).toContain("'data-preview-code-language'");
    expect(source).toContain("container.className = 'code-block-container';");
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

  it('hides original list and blockquote chrome during block preview remapping', () => {
    const css = readStyleFile('markdown.css');

    expect(css).toContain('.milkdown li[data-preview-hide-list-marker] {');
    expect(css).toContain('list-style-type: none !important;');
    expect(css).toContain('.milkdown li[data-preview-hide-list-marker]::before {');
    expect(css).toContain('.milkdown blockquote[data-preview-hide-blockquote] {');
    expect(css).toContain('padding-left: 0 !important;');
    expect(css).toContain('.milkdown blockquote[data-preview-hide-blockquote]::before {');
  });

  it('applies block preview sizes directly without transform scaling', () => {
    const source = readPreviewStylesSource();

    expect(source).not.toContain('delete nextStyles.fontSize;');
    expect(source).not.toContain('delete nextStyles.lineHeight;');
    expect(source).not.toContain('scale(');
    expect(source).not.toContain('transformOrigin');
  });

  it('keeps block preview spacing aligned with actual typography spacing', () => {
    const source = readPreviewStylesSource();

    expect(source).toContain("marginTop");
    expect(source).toContain("marginBottom");
    expect(source).toContain("paddingTop");
    expect(source).toContain("paddingBottom");
    expect(source).toContain("target.matches(':first-child')");
    expect(source).toContain("nextStyles.marginTop = '0px';");
  });

  it('samples inline hover preview styles from the active editor schema', () => {
    const source = readPreviewStylesSource();

    expect(source).toContain("DOMSerializer");
    expect(source).toContain("const markType = markName ? view.state.schema.marks[markName] : null;");
    expect(source).toContain(".fromSchema(view.state.schema)");
    expect(source).toContain("serializeFragment(Fragment.from(textNode)");
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
