import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readMathStyles() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/styles/math-editor.css'),
    'utf8'
  );
}

describe('math hover styles', () => {
  it('keeps clickable hover affordances for inline and block math nodes', () => {
    const css = readMathStyles();

    expect(css).toContain(".milkdown [data-type='math-inline'],");
    expect(css).toContain(".milkdown [data-type='math-block'],");
    expect(css).toContain(".milkdown .mermaid-block {");
    expect(css).toContain('--vlaina-math-hover-color: var(--vlaina-hover-filled);');
    expect(css).toContain('--vlaina-math-hover-bleed-y: 4px;');
    expect(css).toContain('box-decoration-break: clone;');
    expect(css).toContain(".milkdown [data-type='math-inline']:hover,");
    expect(css).toContain(".milkdown .mermaid-block:hover,");
    expect(css).toContain(".milkdown [data-type='math-block'].ProseMirror-selectednode,");
    expect(css).toContain(".milkdown .mermaid-block.ProseMirror-selectednode,");
    expect(css).toContain('.milkdown .ProseMirror.vlaina-atomic-block-keyboard-selected,');
    expect(css).toContain('caret-color: transparent;');
    expect(css).toContain('background: var(--vlaina-math-hover-color);');
    expect(css).toContain('inset 0 0 0 1px var(--vlaina-math-hover-color),');
    expect(css).toContain('border-radius: 0;');
    expect(css).toContain('cursor: pointer !important;');
  });

  it('keeps mermaid blocks on the shared math hover treatment without a standalone frame', () => {
    const mathCss = readMathStyles();
    const extendedCss = readFileSync(
      resolve(process.cwd(), 'src/components/Notes/features/Editor/styles/extended.css'),
      'utf8'
    );

    expect(mathCss).toContain(".milkdown .mermaid-block:hover,");
    const mermaidRule = extendedCss.match(/\.milkdown \.mermaid-block \{(?<body>[\s\S]*?)\n\}/)?.groups?.body ?? '';

    expect(mermaidRule).toContain('content-visibility: auto;');
    expect(mermaidRule).toContain('contain-intrinsic-size: auto 180px;');
    expect(mermaidRule).toContain('background: transparent;');
    expect(mermaidRule).toContain('border: 0;');
    expect(mermaidRule).toContain('border-radius: 0;');
    expect(extendedCss).not.toContain('.milkdown .mermaid-block:hover,\n.milkdown .mermaid-block:focus-visible {');
    expect(extendedCss).not.toContain('border-color: var(--vlaina-accent);');
    expect(extendedCss).not.toContain('box-shadow: 0 0 0 2px var(--vlaina-accent-light);');
  });

  it('suppresses math and mermaid hover affordances while dragging a block selection', () => {
    const css = readMathStyles();

    expect(css).toContain('body.vlaina-block-dragging-cursor .milkdown :is(');
    expect(css).toContain("[data-type='math-inline'],\n  [data-type='math-block'],\n  .mermaid-block\n):not(.vlaina-block-selected):is(:hover, :focus-visible)");
    expect(css).toContain('cursor: crosshair !important;');
    expect(css).toContain('background: transparent !important;');
    expect(css).toContain('box-shadow: none !important;');
  });

  it('keeps selected atomic blocks from regaining hover affordances after block drag ends', () => {
    const css = readMathStyles();

    expect(css).toContain('.milkdown .ProseMirror.vlaina-block-selection-active :is(');
    expect(css).toContain(').vlaina-block-selected:is(:hover, :focus-visible) * {');
    expect(css).toContain('cursor: default !important;');
    expect(css).toContain('background: transparent !important;');
    expect(css).toContain('box-shadow: none !important;');
    expect(css).toContain('body.vlaina-block-dragging-cursor .milkdown .mermaid-block.vlaina-block-selected:is(:hover, :focus-visible) {');
    expect(css).toContain('body.vlaina-block-dragging-cursor .milkdown .mermaid-block.vlaina-block-selected,');
    expect(css).toContain('cursor: crosshair !important;');
    expect(css).not.toContain('.milkdown .ProseMirror .mermaid-block.vlaina-block-selected,\nbody.vlaina-block-dragging-cursor');
    expect(css).not.toContain('.milkdown .ProseMirror.vlaina-block-selection-active .mermaid-block.vlaina-block-selected:is(:hover, :focus-visible)');
    expect(css).toContain('background: var(--vlaina-block-selection-color, var(--vlaina-editor-block-selection-bg, #bedffe)) !important;');
  });

  it('keeps oversized block formulas inside a horizontal scroll container', () => {
    const css = readMathStyles();

    expect(css).toContain(".milkdown [data-type='math-block'].math-block-wrapper {");
    expect(css).toContain('content-visibility: auto;');
    expect(css).toContain('contain-intrinsic-size: auto 96px;');
    expect(css).toContain('overflow-x: auto;');
    expect(css).toContain(".milkdown [data-type='math-block'].math-block-wrapper .katex-display {");
    expect(css).toContain('max-width: 100%;');
    expect(css).toContain(".milkdown [data-type='math-block'].math-block-wrapper .katex-display > .katex {");
    expect(css).toContain('min-width: max-content;');
  });

  it('uses the app accent blue for the primary math editor action', () => {
    const css = readMathStyles();

    expect(css).toContain('.math-editor-action-button-primary {');
    expect(css).toContain('border-color: var(--vlaina-accent);');
    expect(css).toContain('background: var(--vlaina-accent);');
    expect(css).toContain('.math-editor-action-button-primary:hover {');
    expect(css).toContain('border-color: var(--vlaina-accent-hover);');
    expect(css).toContain('background: var(--vlaina-accent-hover);');
  });

  it('does not force a minimum or fixed textarea height in the shared editor popup', () => {
    const css = readMathStyles();

    const textareaRule = css.match(/\.math-editor-textarea \{(?<body>[\s\S]*?)\n\}/)?.groups?.body ?? '';

    expect(textareaRule).toContain('box-sizing: border-box;');
    expect(textareaRule).toContain('resize: vertical;');
    expect(textareaRule).not.toMatch(/(^|\n)\s*min-height:/);
    expect(textareaRule).not.toMatch(/(^|\n)\s*height:/);
  });
});
