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
