import { describe, expect, it } from "vitest";
import { readStyleFile, readCommonMarkdownSurfaceStyle } from "./selectionStylesTestUtils";

describe("editor markdown presentation styles", () => {
  it('collapses paragraph line box around standalone image blocks', () => {
    const css = readStyleFile('markdown.css');

    expect(css).toContain('.milkdown p:has(> .image-block-container) {');
    expect(css).toContain('font-size: var(--vlaina-font-0);');
    expect(css).toContain('line-height: var(--vlaina-leading-0);');
    expect(css).toContain('margin-top: var(--vlaina-space-1rem);');
    expect(css).toContain('margin-bottom: var(--vlaina-space-1rem);');
    expect(css).toContain('.milkdown p:has(> .image-block-container) > .image-block-container {');
    expect(css).toContain('display: block;');
    expect(css).toContain('width: 100%;');
    expect(css).toContain('margin-top: 0;');
    expect(css).toContain('margin-bottom: 0;');
    expect(css).toContain('.milkdown .image-block-container {');
    expect(css).toContain('margin: var(--vlaina-space-0);');
  });

  it('keeps embedded floating toolbars readable inside selected blocks', () => {
    const css = readStyleFile('floating-toolbar.css');

    expect(css).toContain('.milkdown .ProseMirror .editor-block-selected :is(');
    expect(css).toContain('.floating-toolbar-inner,');
    expect(css).toContain('.toolbar-tooltip');
    expect(css).toContain('color: var(--vlaina-text-primary) !important;');
    expect(css).toContain('-webkit-text-fill-color: currentColor !important;');
    expect(css).toContain(') .toolbar-btn.active {');
    expect(css).toContain('color: var(--vlaina-accent) !important;');
    expect(css).toContain(') .toolbar-btn:hover[class*="status-danger"] {');
    expect(css).toContain('color: var(--vlaina-color-status-danger-fg) !important;');
    expect(css).toContain(') .toolbar-btn[data-action="copy"].active {');
    expect(css).toContain('color: var(--vlaina-accent) !important;');
  });

  it('keeps raw HTML tables compact instead of using editable markdown table sizing', () => {
    const css = readStyleFile('markdown.css');

    expect(css).toContain(".milkdown [data-type='html-block'] table {");
    expect(css).toContain(".milkdown [data-type='html-block'] th,");
    expect(css).toContain('min-width: var(--vlaina-size-0);');
    expect(css).toContain('text-align: inherit;');
    expect(css).toContain(".milkdown [data-type='html-block'] img {");
    expect(css).toContain('border-radius: var(--vlaina-radius-0);');
    expect(css).toContain(".milkdown [data-type='html-block'] sub,");
    expect(css).toContain('line-height: var(--vlaina-leading-0);');
    expect(css).toContain('bottom: var(--vlaina-space--025em);');
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

    expect(commonCss).toContain('border-bottom: var(--vlaina-border-width-1) solid transparent;');
    expect(commonCss).toContain('border-bottom-color: var(--vlaina-accent);');
    expect(notesCss).toContain('.markdown-surface .milkdown a,');
    expect(notesCss).toContain('.markdown-surface .milkdown a:hover {');
    expect(notesCss).toContain('border-bottom: none;');
    expect(notesCss).toContain('transition: none;');
  });

  it('renders footnote references as smaller inline-code chips with a capsule hover value', () => {
    const css = readStyleFile('extended.css');

    expect(css).toContain('.milkdown .footnote-ref {');
    expect(css).toContain('vertical-align: super;');
    expect(css).toContain('font-size: var(--vlaina-font-068em);');
    expect(css).toContain('cursor: pointer;');
    expect(css).toContain('user-select: none;');
    expect(css).toContain('-webkit-user-select: none;');
    expect(css).toContain('.milkdown .footnote-ref-label {');
    expect(css).toContain('background: var(--vlaina-color-footnote-ref-bg);');
    expect(css).toContain('color: var(--vlaina-sidebar-row-selected-text, var(--vlaina-accent));');
    expect(css).toContain('font-family: var(--crepe-font-code');
    expect(css).toContain('.milkdown .footnote-ref::after {');
    expect(css).toContain('content: attr(data-footnote-value);');
    expect(css).toContain('border-radius: var(--vlaina-radius-pill-lg);');
    expect(css).toContain('box-shadow: var(--vlaina-shadow-raised-soft);');
    expect(css).toContain('transition: none;');
    expect(css).toContain('.milkdown .footnote-ref:hover::after,');
    expect(css).toContain('.milkdown .footnote-ref:focus-within::after {');
    expect(css).toContain('visibility: visible;');
    expect(css).toContain('.milkdown .footnote-def-label {');
    expect(css).toContain('user-select: none;');
    expect(css).toContain('-webkit-user-select: none;');
  });
});
