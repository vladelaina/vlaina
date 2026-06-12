import { describe, expect, it } from "vitest";
import {
  readStyleFile,
  readBlockSelectionStyle,
  readThemeStyle,
  extractCssRule,
  extractSelectorListsContaining,
} from "./selectionStylesTestUtils";

describe("editor rich block selection styles", () => {
  it('keeps code block selection rendering on the CodeMirror selection layer', () => {
    const css = readStyleFile('code-block.css');

    expect(css).toContain('.milkdown .code-block-container > .code-block-container {');
    expect(css).toContain('margin-top: 0 !important;');
    expect(css).toContain('margin-bottom: 0 !important;');
    expect(css).toContain('border-radius: inherit;');
    expect(css).toContain('.milkdown .code-block-container .code-block-editable {');
    expect(css).toContain('padding: var(--vlaina-padding-code-block-editable);');
    expect(css).toContain('.milkdown .code-block-container .cm-editor {');
    expect(css).toContain('background: transparent !important;');
    expect(css).toContain('.milkdown .code-block-container .cm-content {');
    expect(css).toContain('padding: 0 !important;');
    expect(css).toContain('color: var(--vlaina-code-syntax-foreground);');
    expect(css).toContain('.milkdown .code-block-container .cm-line {');
    expect(css).toContain('padding: var(--vlaina-padding-code-block-line) !important;');
    expect(css).toContain(
      '.milkdown .code-block-container .cm-editor.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {'
    );
    expect(css).toContain(
      ".milkdown .code-block-container:not(.ProseMirror-selectednode):not(.editor-block-selected):not([data-pm-selected='true']) .cm-editor:not(.cm-focused) > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {"
    );
    expect(css).toContain(
      ".milkdown .code-block-container[data-pm-selected='true'] .cm-editor:not(.cm-focused) > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {"
    );
    expect(css).toContain(
      ".milkdown .ProseMirror.editor-toolbar-copy-feedback-active .code-block-container[data-pm-selected='true'] .cm-editor:not(.cm-focused) > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {"
    );
    expect(css).toContain('.milkdown .code-block-container.ProseMirror-selectednode .cm-editor > .cm-scroller > .cm-selectionLayer .cm-selectionBackground,');
    expect(css).toContain('.milkdown .code-block-container.editor-block-selected .cm-editor > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {');
    expect(css).not.toContain(".milkdown .code-block-container[data-pm-selected='true'] .cm-editor > .cm-scroller > .cm-selectionLayer .cm-selectionBackground {");
    expect(css).toContain('.milkdown .code-block-container.editor-block-selected .cm-editor,');
    expect(css).toContain('.milkdown .code-block-container.editor-block-selected .cm-scroller,');
    expect(css).toContain('.milkdown .code-block-container.editor-block-selected .cm-content,');
    expect(css).toContain('.milkdown .code-block-container.editor-block-selected .cm-line,');
    expect(css).toContain('.milkdown .code-block-container.editor-block-selected .cm-activeLine,');
    expect(css).not.toContain(".milkdown .code-block-container[data-pm-selected='true'] .cm-gutter-filler");
    expect(css).toContain('.milkdown .code-block-container.ProseMirror-selectednode .code-block-chrome-header,');
    expect(css).toContain('.milkdown .code-block-container.ProseMirror-selectednode .code-block-editable,');
    expect(css).toContain('.milkdown .code-block-container.editor-block-selected .code-block-lazy-preview,');
    expect(css).not.toContain(".milkdown .code-block-container[data-pm-selected='true'] .code-block-lazy-line-numbers");
    expect(css).toContain('.milkdown .code-block-container.editor-block-selected-contained {');
    expect(css).not.toContain('.milkdown .ProseMirror li.editor-block-selected > .code-block-container {');
    expect(css).not.toContain('.milkdown .ProseMirror li.editor-block-selected > .code-block-container::before {');
    expect(css).toContain('.milkdown .ProseMirror .editor-block-selected .code-block-container {');
    expect(css).toContain('background: var(--vlaina-code-block-background);');
    expect(css).toContain('background-color: var(--vlaina-code-block-background);');
    expect(css).toContain('color: var(--vlaina-code-syntax-foreground);');
    expect(css).toContain('.milkdown .ProseMirror .editor-block-selected .code-block-container * {');
    expect(css).toContain('.milkdown .ProseMirror .editor-block-selected .code-block-container .code-block-chrome-language,');
    expect(css).toContain('.milkdown .ProseMirror .editor-block-selected .code-block-container .code-block-chrome-language-label,');
    expect(css).toContain('color: var(--vlaina-code-syntax-muted);');
    expect(css).toContain('.milkdown .ProseMirror .editor-block-selected .code-block-container .cm-gutters,');
    expect(css).toContain('.milkdown .ProseMirror .editor-block-selected .code-block-container .cm-gutterElement,');
    expect(css).toContain('.milkdown .ProseMirror .editor-block-selected .code-block-container .cm-lineNumbers,');
    expect(css).not.toContain('.milkdown .ProseMirror li .code-block-container.editor-block-selected {');
    expect(css).not.toContain('.milkdown .ProseMirror li .code-block-container.editor-block-selected .cm-gutters,');
    expect(css).not.toContain('background-color: color-mix(in srgb, var(--vlaina-code-block-background), var(--vlaina-block-selection-color)) !important;');
    expect(css).toContain('background: var(--vlaina-code-block-background) !important;');
    expect(css).toContain('background-color: var(--vlaina-code-block-background) !important;');
    expect(css).toContain('--vlaina-block-selection-color: var(--vlaina-block-selection-color-default);');
    expect(css).toContain('background-color: var(--vlaina-block-selection-color);');
    expect(css).toContain('transition: none;');
    expect(css).toContain('.milkdown .code-block-container {');
    expect(css).toContain('transition: none;');
    expect(css).toContain('transition: none !important;');
    expect(css).toContain('border-radius: var(--vlaina-radius-1rem);');
    expect(css).toContain('box-shadow: var(--vlaina-block-selection-shadow);');
    expect(css).not.toContain('--vlaina-block-selection-bleed-y:');
    expect(css).toContain('.milkdown .code-block-container.editor-block-selected *,');
    expect(css).toContain('-webkit-text-fill-color: currentColor;');
    expect(css).not.toContain('.cm-editor.cm-focused .cm-content ::selection');
    expect(css).not.toContain('.cm-editor.cm-focused .cm-line ::selection');
  });

  it('extends selected list items below direct code blocks without changing code block layout', () => {
    const blockSelectionCss = readBlockSelectionStyle();
    const codeCss = readStyleFile('code-block.css');

    expect(blockSelectionCss).toContain('.milkdown .ProseMirror li.editor-block-selected.editor-block-selected-has-direct-code-block {');
    expect(blockSelectionCss).toContain('--vlaina-list-contained-block-selection-bleed-y: var(--vlaina-block-selection-list-contained-bleed-y);');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror li.editor-block-selected.editor-block-selected-has-direct-code-block::after {');
    expect(blockSelectionCss).toContain('right: calc(-1 * var(--vlaina-block-selection-bleed-x-end));');
    expect(blockSelectionCss).toContain('left: calc(-1 * var(--vlaina-block-selection-bleed-x-start));');
    expect(blockSelectionCss).toContain('bottom: calc(-1 * var(--vlaina-list-contained-block-selection-bleed-y));');
    expect(blockSelectionCss).toContain('height: calc(var(--vlaina-list-contained-block-selection-bleed-y) + var(--vlaina-space-8px));');
    expect(blockSelectionCss).toContain('border-bottom-right-radius: var(--vlaina-radius-8px);');
    expect(blockSelectionCss).toContain('border-bottom-left-radius: var(--vlaina-radius-8px);');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror li.editor-block-selected.editor-block-selected-has-direct-code-block > * {');
    expect(blockSelectionCss).not.toContain('li.editor-block-selected:has(> .code-block-container)');
    expect(codeCss).not.toContain('display: flow-root;');
    expect(codeCss).not.toContain('overflow: visible;');
  });

  it('sizes selected image parent blocks without selected-state child scans', () => {
    const blockSelectionCss = readBlockSelectionStyle();

    expect(blockSelectionCss).toContain('.milkdown .ProseMirror p.editor-block-selected.editor-block-selected-has-direct-image {');
    expect(blockSelectionCss).toContain('--vlaina-block-selection-bleed-y: var(--vlaina-block-selection-bleed-y-rich);');
    expect(blockSelectionCss).not.toContain('p.editor-block-selected:has(> .image-block-container)');
  });

  it('keeps rich child blocks at their original colors during block selection', () => {
    const blockSelectionCss = readBlockSelectionStyle();
    const mathCss = readStyleFile('math-editor.css');
    const richChildLists = extractSelectorListsContaining(blockSelectionCss, ':is', '.image-block-container')
      .filter((list) => list.includes("[data-type='math-inline']"));
    const listContainedRichBlockLists = extractSelectorListsContaining(blockSelectionCss, ':is', '.image-block-container')
      .filter((list) => list.includes('.code-block-container'));
    const expectedRichChildList = [
      '.image-block-container',
      '.video-block',
      "[data-type='math-block']",
      "[data-type='math-inline']",
      '.mermaid-block',
      '.milkdown-table-block',
      'table',
    ];

    expect(blockSelectionCss).not.toContain('.milkdown .ProseMirror .editor-block-selected:is(');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .editor-block-selected :is(');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .editor-block-selected-contained:is(');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror li.editor-block-selected :is(');
    expect(blockSelectionCss).toContain(').editor-block-selected-contained {');
    expect(blockSelectionCss).not.toContain('.milkdown .ProseMirror li :is(\n  .image-block-container,\n  .video-block,\n  [data-type=\'math-block\'],\n  [data-type=\'math-inline\'],\n  .mermaid-block,\n  .milkdown-table-block,\n  table\n).editor-block-selected {');
    expect(blockSelectionCss).toContain('.image-block-container,');
    expect(blockSelectionCss).toContain('.video-block,');
    expect(blockSelectionCss).toContain("[data-type='math-block'],");
    expect(blockSelectionCss).toContain("[data-type='math-inline'],");
    expect(blockSelectionCss).toContain('.mermaid-block,');
    expect(blockSelectionCss).toContain('.milkdown-table-block,');
    expect(blockSelectionCss).toContain('table');
    expect(blockSelectionCss).toContain('background: transparent !important;');
    expect(blockSelectionCss).toContain('box-shadow: none !important;');
    expect(blockSelectionCss).not.toContain('background-color: inherit;');
    expect(mathCss).not.toContain('.milkdown .ProseMirror .editor-block-selected:is(');
    expect(mathCss).toContain('.milkdown .ProseMirror .editor-block-selected :is(');
    expect(mathCss).not.toContain('.milkdown .ProseMirror .editor-block-selected-contained:is(');
    expect(mathCss).not.toContain('.milkdown .ProseMirror li.editor-block-selected :is(');
    expect(mathCss).toContain('.mermaid-block');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .editor-block-selected-textlike,');
    expect(blockSelectionCss).toContain(':not(.code-block-container *):not(.mermaid-block):not(.mermaid-block *) {');
    expect(blockSelectionCss).not.toContain('.milkdown .ProseMirror .mermaid-block.editor-block-selected * {');
    expect(mathCss).not.toContain('.milkdown .ProseMirror .mermaid-block.editor-block-selected,\n.milkdown .ProseMirror.editor-block-selection-pending');
    expect(mathCss).toContain('.milkdown .ProseMirror.editor-block-selection-pending .mermaid-block.editor-block-selected:is(:hover, :focus-visible) {');
    expect(mathCss).toContain('background: var(--vlaina-block-selection-color, var(--vlaina-block-selection-color-default)) !important;');
    expect(richChildLists).toHaveLength(4);
    for (const list of richChildLists) {
      expect(list).toEqual(expectedRichChildList);
    }
    expect(listContainedRichBlockLists).toEqual([[
      '.code-block-container',
      '.frontmatter-block-container',
      '.image-block-container',
      '.video-block',
      "[data-type='math-block']",
      '.mermaid-block',
      '.milkdown-table-block',
      'table',
    ]]);
  });

  it('paints selected tables with the standard block selection frame', () => {
    const tableBlockCss = readStyleFile('table-block.css');
    const blockSelectionCss = readBlockSelectionStyle();
    const themeCss = readThemeStyle();

    expect(themeCss).toContain('--vlaina-block-selection-top-reserve-default: 0px;');
    expect(themeCss).toContain('--vlaina-block-selection-scrollbar-reserve-default: 0px;');
    expect(tableBlockCss).toContain('.milkdown .milkdown-table-block {');
    expect(tableBlockCss).toContain('margin: var(--vlaina-space-8px) var(--vlaina-space-0) var(--vlaina-space-0);');
    expect(tableBlockCss).toContain('.milkdown .milkdown-table-block:first-child {');
    expect(tableBlockCss).toContain('margin-top: var(--vlaina-space-0);');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .milkdown-table-block.editor-block-selected .table-content-host,');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .milkdown-table-block.ProseMirror-selectednode .table-content-host {');
    expect(blockSelectionCss).toContain('background: transparent !important;');
    expect(blockSelectionCss).toContain('box-shadow: none !important;');
    expect(tableBlockCss).toContain('align-items: flex-start;');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .milkdown-table-block.editor-block-selected,');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .milkdown-table-block.ProseMirror-selectednode {');
    expect(blockSelectionCss).toContain('--vlaina-block-selection-bleed-y: var(--vlaina-block-selection-bleed-y-rich);');
    expect(blockSelectionCss).toContain('--vlaina-block-selection-bleed-x-start: var(--vlaina-block-selection-bleed-x-default);');
    expect(blockSelectionCss).toContain('--vlaina-block-selection-bleed-x-end: var(--vlaina-block-selection-bleed-x-default);');
    expect(blockSelectionCss).toContain('--vlaina-block-selection-top-reserve: var(--vlaina-block-selection-top-reserve-default);');
    expect(blockSelectionCss).toContain('--vlaina-block-selection-scrollbar-reserve: var(--vlaina-block-selection-scrollbar-reserve-default);');
    expect(blockSelectionCss).toContain('background: transparent !important;');
    expect(blockSelectionCss).toContain('border-radius: var(--vlaina-radius-8px);');
    expect(blockSelectionCss).not.toContain('.milkdown-table-block.editor-block-selected:has(');
    expect(blockSelectionCss).not.toContain('.milkdown-table-block.ProseMirror-selectednode:has(');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .milkdown-table-block.editor-block-selected.editor-table-block-zero-min-width,');
    expect(blockSelectionCss).toContain('--vlaina-block-selection-top-reserve: var(--vlaina-block-selection-bleed-y);');
    expect(blockSelectionCss).toContain('--vlaina-block-selection-scrollbar-reserve: var(--table-block-scrollbar-reserve, var(--vlaina-block-selection-table-scrollbar-reserve));');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .milkdown-table-block.editor-block-selected::before,');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .milkdown-table-block.ProseMirror-selectednode::before {');
    expect(blockSelectionCss).toContain('top: calc(var(--vlaina-block-selection-top-reserve, var(--vlaina-block-selection-top-reserve-default)) - var(--vlaina-block-selection-bleed-y));');
    expect(blockSelectionCss).toContain('bottom: calc(var(--vlaina-block-selection-scrollbar-reserve, var(--vlaina-block-selection-scrollbar-reserve-default)) - var(--vlaina-block-selection-bleed-y));');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .milkdown-table-block.editor-block-selected > *,');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .milkdown-table-block.ProseMirror-selectednode > * {');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .milkdown-table-block.editor-block-selected.editor-table-block-zero-min-width .table-scroll,');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .milkdown-table-block.ProseMirror-selectednode.editor-table-block-zero-min-width .table-scroll {');
    expect(blockSelectionCss).toContain('margin-top: calc(-1 * var(--vlaina-block-selection-bleed-y));');
    expect(blockSelectionCss).toContain('margin-bottom: calc(-1 * var(--vlaina-block-selection-bleed-y));');
    expect(blockSelectionCss).toContain('padding-top: var(--vlaina-block-selection-bleed-y);');
    expect(blockSelectionCss).toContain('padding-bottom: var(--vlaina-block-selection-bleed-y);');
    expect(
      extractCssRule(
        blockSelectionCss,
        '.milkdown .ProseMirror .milkdown-table-block.editor-block-selected.editor-table-block-zero-min-width .table-scroll,'
      )
    ).not.toContain('background: var(--vlaina-block-selection-color);');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .milkdown-table-block.editor-block-selected .table-scroll-track,');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .milkdown-table-block.ProseMirror-selectednode .table-scroll-track {');
    expect(blockSelectionCss).toContain('position: relative;');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .milkdown-table-block.editor-block-selected.editor-table-block-zero-min-width .table-content-host::before,');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .milkdown-table-block.ProseMirror-selectednode.editor-table-block-zero-min-width .table-content-host::before {');
    expect(blockSelectionCss).toContain("content: '';");
    expect(blockSelectionCss).toContain('top: calc(-1 * var(--vlaina-block-selection-bleed-y));');
    expect(blockSelectionCss).toContain('right: calc(-1 * var(--vlaina-block-selection-bleed-x-end));');
    expect(blockSelectionCss).toContain('bottom: calc(-1 * var(--vlaina-block-selection-bleed-y));');
    expect(blockSelectionCss).toContain('left: calc(-1 * var(--vlaina-block-selection-bleed-x-start));');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .milkdown-table-block.editor-block-selected .table-scroll-spacer,');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .milkdown-table-block.editor-block-selected .table-content-host > *,');
    expect(blockSelectionCss).toContain('z-index: var(--vlaina-z-1);');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .milkdown-table-block.editor-block-selected :is(th, td),');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .milkdown-table-block.ProseMirror-selectednode :is(th, td) {');
    expect(blockSelectionCss).toContain('background-color: transparent !important;');
  });

  it('keeps table column drag handles dark even inside selected table blocks', () => {
    const tableBlockCss = readStyleFile('table-block.css');

    expect(tableBlockCss).toContain('.milkdown .milkdown-table-block .column-header-drag-control,');
    expect(tableBlockCss).toContain(".milkdown .milkdown-table-block .column-header-drag-control[data-active='true'],");
    expect(tableBlockCss).toContain('.milkdown .milkdown-table-block .column-header-drag-control__grip {');
    expect(tableBlockCss).toContain('color: var(--vlaina-text-primary) !important;');
    expect(tableBlockCss).toContain('-webkit-text-fill-color: var(--vlaina-text-primary) !important;');
    expect(tableBlockCss).toContain('background: currentColor;');
    expect(tableBlockCss).toContain('box-shadow: var(--vlaina-shadow-table-grip-dots);');
  });

  it('keeps table column menus readable inside selected table blocks', () => {
    const tableBlockCss = readStyleFile('table-block.css');

    expect(tableBlockCss).toContain('border-radius: var(--vlaina-radius-22px);');
    expect(tableBlockCss).toContain('.milkdown .milkdown-table-block .column-header-drag-menu__item {');
    expect(tableBlockCss).toContain('color: var(--vlaina-sidebar-notes-text) !important;');
    expect(tableBlockCss).toContain('-webkit-text-fill-color: var(--vlaina-sidebar-notes-text) !important;');
    expect(tableBlockCss).toContain('background: var(--vlaina-sidebar-notes-row-hover);');
    expect(tableBlockCss).toContain('color: var(--vlaina-color-status-danger-fg) !important;');
    expect(tableBlockCss).toContain('-webkit-text-fill-color: var(--vlaina-color-status-danger-fg) !important;');
    expect(tableBlockCss).toContain('background: var(--vlaina-color-status-danger-bg);');
  });

  it('keeps selected math blocks inside selected list items vertically covered', () => {
    const blockSelectionCss = readBlockSelectionStyle();
    const mathCss = readStyleFile('math-editor.css');

    expect(blockSelectionCss).toContain('.milkdown .ProseMirror li.editor-block-selected :is(');
    expect(blockSelectionCss).toContain(').editor-block-selected-contained {');
    expect(blockSelectionCss).toContain('box-shadow: var(--vlaina-block-selection-shadow-y) !important;');
    expect(mathCss).not.toContain('.milkdown .ProseMirror li.editor-block-selected :is(');
    expect(mathCss).not.toContain(').editor-block-selected-contained {');
    expect(mathCss).not.toContain('box-shadow: var(--vlaina-block-selection-shadow-y) !important;');
  });

  it('restores formula and mermaid text color while preserving mermaid shape colors on selected hover', () => {
    const css = readStyleFile('math-editor.css');
    const themeCss = readThemeStyle();

    expect(themeCss).toContain('--vlaina-math-hover-bleed-x-start-default: 0px;');
    expect(css).toContain('.milkdown .ProseMirror .editor-block-selected :is(');
    expect(css).toMatch(
      /\[data-type='math-inline'\],\s*\[data-type='math-block'\]\s*\):is\(:hover, :focus-visible, \.ProseMirror-selectednode, \.editor-preview-context-menu-active\) :is\(svg, svg \*, \.katex, \.katex \*, text, tspan, path, rect, circle, ellipse, line, polyline, polygon\),/
    );
    expect(css).toMatch(
      /\.mermaid-block\s*\):is\(:hover, :focus-visible, \.ProseMirror-selectednode, \.editor-preview-context-menu-active\) :is\(text, tspan, \.nodeLabel, \.label, \.edgeLabel\)\s*[, {]/
    );
    expect(css).not.toContain('.mermaid-block\n):is(:hover, :focus-visible, .ProseMirror-selectednode, .editor-preview-context-menu-active) :is(svg, svg *, .katex, .katex *, text, tspan, path, rect, circle, ellipse, line, polyline, polygon)');
    expect(css).toContain('color: var(--vlaina-text-primary) !important;');
    expect(css).toContain('-webkit-text-fill-color: var(--vlaina-text-primary) !important;');
    expect(css).toContain('fill: var(--vlaina-text-primary) !important;');
    expect(css).toContain('stroke: var(--vlaina-text-primary) !important;');
    expect(css).toContain(').editor-block-selected:is(:hover, :focus-visible, .ProseMirror-selectednode, .editor-preview-context-menu-active),');
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
});
