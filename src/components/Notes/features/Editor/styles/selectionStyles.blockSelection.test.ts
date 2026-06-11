import { describe, expect, it } from "vitest";
import {
  readStyleFile,
  readBlockSelectionStyle,
  readThemeStyle,
  extractCssRule,
  extractSelectorListsContaining,
} from "./selectionStylesTestUtils";

describe("editor block selection styles", () => {
  it('keeps nested list block selection overlays from stacking darker backgrounds', () => {
    const css = readBlockSelectionStyle();

    expect(css).toContain('.milkdown .ProseMirror li.editor-block-selected .editor-block-selected {');
    expect(css).toContain('background-color: transparent;');
    expect(css).toContain('box-shadow: none;');
    expect(css).toContain('transition: none !important;');
  });

  it('does not replace native list markers during block selection', () => {
    const css = readBlockSelectionStyle();

    expect(css).not.toContain('content: attr(data-label)');
    expect(css).not.toContain('li.editor-block-selected:not([data-item-type="task"])::before');
    expect(css).not.toContain('list-style-type: none !important;');
  });

  it('tints native list markers when the list item or its paragraph child carries selection', () => {
    const css = readBlockSelectionStyle();

    expect(css).toContain('.milkdown .ProseMirror li.editor-block-selected::marker,');
    expect(css).toContain('.milkdown .ProseMirror li:has(> p.editor-block-selected)::marker {');
    expect(css).toContain('color: var(--vlaina-editor-block-selection-fg);');
    expect(css).not.toContain('li:has(> .code-block-container.editor-block-selected)::marker');
  });

  it('tints task checkboxes with the selected block foreground', () => {
    const css = readBlockSelectionStyle();
    const markdownCss = readStyleFile('markdown.css');

    expect(css).toContain('.milkdown .ProseMirror li[data-item-type="task"].editor-block-selected::before,');
    expect(css).toContain('.milkdown .ProseMirror li[data-item-type="task"]:has(> p.editor-block-selected)::before,');
    expect(css).toContain('.milkdown .ProseMirror .editor-block-selected li[data-item-type="task"]::before {');
    expect(css).toContain('border-color: var(--vlaina-editor-block-selection-fg) !important;');
    expect(css).toContain('background-color: transparent !important;');
    expect(css).toContain('.milkdown .ProseMirror li[data-item-type="task"][data-checked="true"] > .editor-block-selected {');
    expect(css).toContain('color: var(--vlaina-editor-block-selection-fg) !important;');
    expect(css).toContain('-webkit-text-fill-color: var(--vlaina-editor-block-selection-fg) !important;');
    expect(markdownCss).not.toContain('.milkdown .ProseMirror li[data-item-type="task"][data-checked="true"] > .editor-block-selected {');
  });

  it('hides editable list gap placeholder text while keeping the caret visible', () => {
    const css = readStyleFile('markdown.css');
    const itemRule = extractCssRule(css, '.milkdown .ProseMirror li.editor-list-gap-placeholder-item');
    const rule = extractCssRule(css, '.milkdown .ProseMirror li.editor-list-gap-placeholder-item > p');

    expect(itemRule).toContain('margin-left: calc(-1 * var(--vlaina-list-gap-placeholder-outdent));');
    expect(itemRule).toContain('width: calc(100% + var(--vlaina-list-gap-placeholder-outdent));');
    expect(rule).toContain('color: transparent;');
    expect(rule).toContain('-webkit-text-fill-color: transparent;');
    expect(rule).toContain('caret-color: transparent;');
  });

  it('keeps list gap placeholder block selection from extending farther left than normal list rows', () => {
    const css = readBlockSelectionStyle();
    const markdownCss = readStyleFile('markdown.css');
    const rule = extractCssRule(
      css,
      '.milkdown .ProseMirror li.editor-list-gap-placeholder-item.editor-block-selected,'
    );

    expect(rule).toContain('.milkdown .ProseMirror li.editor-list-gap-placeholder-item > .editor-block-selected');
    expect(rule).toContain('var(--vlaina-list-row-selection-bleed-x-start)');
    expect(rule).toContain('var(--vlaina-list-gap-placeholder-outdent)');
    expect(markdownCss).not.toContain('.milkdown .ProseMirror li.editor-list-gap-placeholder-item.editor-block-selected,');
  });

  it('tints blockquote rails with the selected block foreground', () => {
    const css = readBlockSelectionStyle();

    expect(css).toContain('.milkdown .ProseMirror blockquote.editor-block-selected::before,');
    expect(css).toContain('.milkdown .ProseMirror blockquote:has(> .editor-block-selected)::before,');
    expect(css).toContain('.milkdown .ProseMirror .editor-block-selected blockquote::before {');
    expect(css).toContain('background: var(--vlaina-editor-block-selection-fg) !important;');
  });

  it('keeps selected text block backgrounds separated by the shared vertical gap token', () => {
    const css = readBlockSelectionStyle();
    const themeCss = readThemeStyle();
    const textBlockRule = extractCssRule(
      css,
      '.milkdown .ProseMirror :where(\n  p,'
    );
    const textBlockFillRule = extractCssRule(
      css,
      ".milkdown .ProseMirror > [data-type='html-block'][data-value='<!--vlaina-markdown-blank-line-->'].editor-block-selected::after"
    );
    const adjacentBottomRule = extractCssRule(
      css,
      ".milkdown .ProseMirror > [data-type='html-block'][data-value='<!--vlaina-markdown-blank-line-->'].editor-block-selected:has(+ :is(.editor-block-selected, .ProseMirror-selectednode, .editor-block-drag-source))"
    );
    const adjacentTopRule = extractCssRule(
      css,
      '.milkdown .ProseMirror :is(.editor-block-selected, .ProseMirror-selectednode, .editor-block-drag-source) + :where('
    );

    expect(css).toContain('.milkdown .ProseMirror p.editor-block-selected {');
    expect(css).toContain('--vlaina-block-selection-bleed-y: var(--vlaina-block-selection-bleed-y-default);');
    expect(themeCss).toContain('--vlaina-block-selection-spacing-y-unit: var(--vlaina-space-1px);');
    expect(themeCss).toContain('--vlaina-block-selection-bleed-y-compact: calc(');
    expect(themeCss).toContain('--vlaina-block-selection-bleed-y-rich: calc(');
    expect(themeCss).toContain('--vlaina-block-selection-bleed-y-list-contained: calc(');
    expect(themeCss).toContain('--vlaina-block-selection-bleed-y-default: var(--vlaina-block-selection-bleed-y-compact);');
    expect(themeCss).toContain('--vlaina-block-selection-gap-y: var(--vlaina-block-selection-spacing-y-unit);');
    expect(themeCss).toContain('--vlaina-block-selection-fill-edge-default: calc(-1 * var(--vlaina-block-selection-bleed-y));');
    expect(themeCss).toContain('--vlaina-block-selection-fill-top: var(--vlaina-block-selection-fill-edge-default);');
    expect(themeCss).toContain('--vlaina-block-selection-fill-bottom: var(--vlaina-block-selection-fill-edge-default);');
    expect(themeCss).toContain('--vlaina-z-behind: -1;');
    expect(css).toContain('--vlaina-block-selection-fill-top: var(--vlaina-block-selection-fill-edge-default);');
    expect(css).toContain('--vlaina-block-selection-fill-bottom: var(--vlaina-block-selection-fill-edge-default);');
    expect(textBlockRule).toContain('):is(.editor-block-selected, .ProseMirror-selectednode, .editor-block-drag-source):not(:has(> :where(');
    expect(textBlockRule).toContain(".milkdown .ProseMirror > [data-type='html-block'][data-value='<!--vlaina-markdown-blank-line-->'].editor-block-selected");
    for (const selector of [
      'p,',
      'h1,',
      'h6,',
      'blockquote,',
      'hr,',
      'li,',
      'dl,',
      'dt,',
      'dd,',
      '.definition-list,',
      '.definition-term,',
      '.definition-desc,',
      '.footnote-def,',
      '.toc-block,',
      '.callout,',
      "[data-type='html-block']",
    ]) {
      expect(textBlockRule).toContain(selector);
    }
    expect(textBlockRule).toContain('isolation: isolate;');
    expect(textBlockRule).toContain('position: relative;');
    expect(textBlockRule).toContain('background-color: transparent;');
    expect(textBlockRule).toContain('box-shadow: none;');
    expect(textBlockRule).toContain('color: var(--vlaina-editor-block-selection-fg);');
    expect(textBlockFillRule).toContain('::after');
    expect(textBlockFillRule).toContain('top: var(--vlaina-block-selection-fill-top);');
    expect(textBlockFillRule).toContain('bottom: var(--vlaina-block-selection-fill-bottom);');
    expect(textBlockFillRule).toContain('z-index: var(--vlaina-z-behind);');
    expect(textBlockFillRule).toContain('background: var(--vlaina-block-selection-color);');
    expect(adjacentBottomRule).toContain(':has(+ :is(.editor-block-selected, .ProseMirror-selectednode, .editor-block-drag-source))');
    expect(adjacentBottomRule).toContain('--vlaina-block-selection-fill-bottom: var(--vlaina-block-selection-gap-y);');
    expect(adjacentTopRule).toContain('--vlaina-block-selection-fill-top: var(--vlaina-block-selection-gap-y);');
  });

  it('keeps repeated text-like block selection selector lists in sync', () => {
    const css = readBlockSelectionStyle();
    const textLikeLists = extractSelectorListsContaining(css, ':where', '.definition-list');
    const firstList = textLikeLists[0];

    expect(textLikeLists.length).toBeGreaterThanOrEqual(5);
    expect(firstList).toEqual([
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'hr',
      '.md-hr',
      'li',
      'dl',
      'dt',
      'dd',
      '.definition-list',
      '.definition-term',
      '.definition-desc',
      '.footnote-def',
      '.toc-block',
      '.callout',
      "[data-type='html-block']",
    ]);

    for (const list of textLikeLists) {
      expect(list).toEqual(firstList);
    }
  });

  it('renders markdown source blank lines as editor-only blank line blocks', () => {
    const markdownCss = readStyleFile('markdown.css');
    const blockSelectionCss = readBlockSelectionStyle();
    const editorBlankLineRule = extractCssRule(
      markdownCss,
      ".milkdown .ProseMirror > [data-type='html-block'][data-value='<!--vlaina-markdown-blank-line-->']"
    );
    const editableBlankLineRule = extractCssRule(
      markdownCss,
      '.milkdown .ProseMirror > p.editor-editable-markdown-blank-line'
    );
    const trailingBreakBlankLineRule = extractCssRule(
      markdownCss,
      '.milkdown .ProseMirror > p:has(> br.ProseMirror-trailingBreak:only-child):not(.is-editor-empty)'
    );

    expect(editorBlankLineRule).toContain('min-height: var(--vlaina-height-markdown-blank-line);');
    expect(editorBlankLineRule).toContain('margin: var(--vlaina-space-0);');
    expect(editorBlankLineRule).toContain('padding: var(--vlaina-space-0);');
    expect(editableBlankLineRule).toContain('min-height: var(--vlaina-height-markdown-blank-line);');
    expect(editableBlankLineRule).toContain('margin: var(--vlaina-space-0);');
    expect(editableBlankLineRule).toContain('padding: var(--vlaina-space-0);');
    expect(trailingBreakBlankLineRule).toContain('min-height: var(--vlaina-height-markdown-blank-line);');
    expect(trailingBreakBlankLineRule).toContain('margin: var(--vlaina-space-0);');
    expect(trailingBreakBlankLineRule).toContain('padding: var(--vlaina-space-0);');
    expect(blockSelectionCss).toContain("[data-type='html-block']\n):is(.editor-block-selected, .ProseMirror-selectednode)");
    expect(blockSelectionCss).toContain(".milkdown .ProseMirror > [data-type='html-block'][data-value='<!--vlaina-markdown-blank-line-->'].editor-block-selected {");
    expect(blockSelectionCss).toContain(".milkdown .ProseMirror > [data-type='html-block'][data-value='<!--vlaina-markdown-blank-line-->'].editor-block-selected::after {");
    expect(blockSelectionCss).toContain('--vlaina-block-selection-bleed-y: var(--vlaina-block-selection-bleed-y-default);');
    expect(blockSelectionCss).toContain('top: var(--vlaina-block-selection-fill-top);');
    expect(blockSelectionCss).toContain('bottom: var(--vlaina-block-selection-fill-bottom);');
    expect(blockSelectionCss).toContain('background: var(--vlaina-block-selection-color);');
  });

  it('keeps list selection overlays wide enough to cover native markers', () => {
    const css = readBlockSelectionStyle();
    const themeCss = readThemeStyle();

    expect(themeCss).toContain('--vlaina-block-selection-offset-x: 0px;');
    expect(css).toContain('--vlaina-block-selection-bleed-x-start: var(--vlaina-block-selection-bleed-x-default);');
    expect(css).toContain('.milkdown .ProseMirror li.editor-block-selected,');
    expect(css).toContain('--vlaina-list-row-selection-bleed-x-start: var(--vlaina-space-72px);');
    expect(css).toContain('--vlaina-block-selection-bleed-x-start: var(--vlaina-list-row-selection-bleed-x-start);');
    expect(css).toContain('--vlaina-block-selection-bleed-y: var(--vlaina-block-selection-bleed-y-default);');
    expect(css).toContain('--vlaina-block-selection-bleed-x-end: var(--vlaina-block-selection-bleed-x-default);');
    expect(css).toContain('.milkdown .ProseMirror :is(ul, ol) > li.editor-block-selected,');
    expect(css).toContain('--vlaina-list-row-selection-bleed-x-start: var(--vlaina-space-72px);');
    expect(css).toContain('.milkdown .ProseMirror ul > li.editor-block-selected,');
    expect(css).toContain('.milkdown .ProseMirror li[data-item-type="task"].editor-block-selected,');
    expect(css).toContain('--vlaina-list-row-selection-bleed-x-start: var(--vlaina-space-96px);');
    expect(css).toContain('.milkdown .ProseMirror ol > li.editor-block-selected,');
    expect(css).toContain('--vlaina-list-row-selection-bleed-x-start: var(--vlaina-space-96px);');
    expect(css).toContain('.milkdown .ProseMirror :is(ul, ol) :is(ul, ol) > li.editor-block-selected,');
    expect(css).toContain('--vlaina-list-row-selection-bleed-x-start: var(--vlaina-space-104px);');
    expect(css).toContain('.milkdown .ProseMirror :is(ul, ol) ol > li.editor-block-selected,');
    expect(css).toContain('--vlaina-list-row-selection-bleed-x-start: var(--vlaina-space-104px);');
    expect(css).toContain('.milkdown .ProseMirror :is(ul, ol) :is(ul, ol) :is(ul, ol) > li.editor-block-selected,');
    expect(css).toContain('--vlaina-list-row-selection-bleed-x-start: var(--vlaina-space-136px);');
    expect(css).toContain('.milkdown .ProseMirror :is(ul, ol) :is(ul, ol) ol > li.editor-block-selected,');
    expect(css).toContain('--vlaina-list-row-selection-bleed-x-start: var(--vlaina-space-128px);');
    expect(css).toContain('.milkdown .ProseMirror li :is(ul, ol) li[data-item-type="task"].editor-block-selected,');
    expect(css).toContain('--vlaina-list-row-selection-bleed-x-start: var(--vlaina-space-96px);');
    expect(css).not.toContain('margin-left: calc(-1 * var(--vlaina-block-selection-offset-x));');
  });

  it('uses semantic vertical spacing roles for compact and rich selected blocks', () => {
    const css = readBlockSelectionStyle();
    const themeCss = readThemeStyle();
    const richBlockRule = extractCssRule(
      css,
      '.milkdown .ProseMirror :is(\n  .code-block-container,'
    );

    expect(themeCss).toContain('--vlaina-block-selection-list-contained-bleed-y: var(--vlaina-block-selection-bleed-y-list-contained);');
    expect(css).toContain('.milkdown .ProseMirror li.editor-block-selected,');
    expect(css).toContain('--vlaina-block-selection-bleed-y: var(--vlaina-block-selection-bleed-y-default);');
    expect(richBlockRule).toContain('.code-block-container,');
    expect(richBlockRule).toContain('.frontmatter-block-container,');
    expect(richBlockRule).toContain('.image-block-container,');
    expect(richBlockRule).toContain('.video-block,');
    expect(richBlockRule).toContain("[data-type='math-block'],");
    expect(richBlockRule).toContain('.mermaid-block,');
    expect(richBlockRule).toContain('.milkdown-table-block,');
    expect(richBlockRule).toContain('table');
    expect(richBlockRule).toContain('--vlaina-block-selection-bleed-y: var(--vlaina-block-selection-bleed-y-rich);');
  });

  it('uses rich vertical bleed for image block selection overlays', () => {
    const css = readBlockSelectionStyle();

    expect(css).toContain('.milkdown .ProseMirror .image-block-container.ProseMirror-selectednode,');
    expect(css).toContain('.milkdown .ProseMirror .image-block-container.editor-block-selected {');
    expect(css).toContain('--vlaina-block-selection-color: var(--vlaina-block-selection-color-default);');
    expect(css).toContain('--vlaina-block-selection-bleed-y: var(--vlaina-block-selection-bleed-y-rich);');
    expect(css).toContain('box-shadow: var(--vlaina-block-selection-shadow);');
    expect(css).toContain('.milkdown .ProseMirror p.editor-block-selected:has(> .image-block-container) {');
  });

  it('keeps structural markdown block selection styles centralized', () => {
    const blockSelectionCss = readBlockSelectionStyle();
    const markdownCss = readStyleFile('markdown.css');
    const hrSelectedRule = extractCssRule(
      blockSelectionCss,
      '.milkdown .ProseMirror hr.ProseMirror-selectednode,'
    );
    const hrSelectedFillRule = extractCssRule(
      blockSelectionCss,
      '.milkdown .ProseMirror hr.ProseMirror-selectednode::after,'
    );

    expect(blockSelectionCss).toContain('.milkdown .ProseMirror hr.ProseMirror-selectednode::before,');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror hr.editor-block-selected::before,');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .md-hr.editor-block-selected::before {');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror hr.ProseMirror-selectednode,\n.milkdown .ProseMirror hr.editor-block-selected,\n.milkdown .ProseMirror .md-hr.ProseMirror-selectednode,\n.milkdown .ProseMirror .md-hr.editor-block-selected {');
    expect(hrSelectedRule).not.toContain('min-height');
    expect(hrSelectedFillRule).toContain('top: var(--vlaina-block-selection-fill-top);');
    expect(hrSelectedFillRule).toContain('right: calc(-1 * var(--vlaina-block-selection-bleed-x-end));');
    expect(hrSelectedFillRule).toContain('bottom: var(--vlaina-block-selection-fill-bottom);');
    expect(hrSelectedFillRule).toContain('left: calc(-1 * var(--vlaina-block-selection-bleed-x-start));');
    expect(blockSelectionCss).toContain('box-shadow: var(--vlaina-shadow-hr-selected);');
    expect(blockSelectionCss).toContain('.footnote-def,');
    expect(blockSelectionCss).toContain('.toc-block,');
    expect(blockSelectionCss).toContain('.callout,');
    expect(blockSelectionCss).toContain(".milkdown .ProseMirror > [data-type='html-block'][data-value='<!--vlaina-markdown-blank-line-->'].editor-block-selected");
    expect(markdownCss).not.toContain('.milkdown .ProseMirror hr.ProseMirror-selectednode::before');
  });
});
