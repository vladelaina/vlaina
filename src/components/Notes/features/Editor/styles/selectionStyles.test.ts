import { describe, expect, it } from "vitest";
import { readEditorStyleSourceFiles, readStyleFile, readThemeCompatibilityStyle } from "./selectionStylesTestUtils";

describe("editor style theme compatibility", () => {
  it('keeps the Typora compatibility bridge scoped to imported external themes', () => {
    const css = readThemeCompatibilityStyle();

    expect(css).toContain(":where(.milkdown-editor[data-markdown-compat-layer='external'].theme-typora)");
    expect(css).toContain('--typora-inline-code-bg');
    expect(css).toContain('--typora-table-hover-bg');
    expect(css).toContain("[data-markdown-theme-color-scheme-mode='fixed-light']");
    expect(css).toContain('color-scheme: light;');
    expect(css).toContain('--vlaina-code-block-background: #f5f5f5;');
    expect(css).toContain('--vlaina-text-primary: #2c2c2b;');
    expect(css).toContain("#write .callout.md-alert");
    expect(css).toContain("#write .md-hr::before");
    expect(css).toContain(".milkdown table tr:hover > :is(th, td)");
    expect(css).not.toContain(".theme-vlaina.theme-typora");
  });

  it('keeps Typora ecosystem semantic compatibility scoped to imported Typora themes', () => {
    const css = readThemeCompatibilityStyle();
    const scope = ":where(.milkdown-editor[data-markdown-compat-layer='external'].theme-typora)";

    expect(css).toContain(`${scope} #write {`);
    expect(css).toContain('--typora-page-max-width: min(100%, var(--v-write-w, 1200px));');
    expect(css).toContain('max-width: 100% !important;');
    expect(css).toContain('background: transparent !important;');
    expect(css).toContain(`${scope} #write.done::before,`);
    expect(css).toContain(`${scope} #write :is(.md-htmlblock, .video-block, .v-caption.iframe) :is(iframe, video, object, embed),`);
    expect(css).toContain(`${scope} #write .milkdown-table-block.table-figure {`);
    expect(css).toContain(`${scope} #write .v-caption.full {`);
    expect(css).toContain(`${scope} #write .v-btn {`);
    expect(css).toContain(`${scope} #write .v-tab-group {`);
    expect(css).toContain(`${scope} #write .v-tab-box {`);
    expect(css).toContain(`${scope} #write .v-post-card.vlook-post-card {`);
    expect(css).toContain(`${scope} #write blockquote.vlook-post-card {`);
    expect(css).toContain(`${scope} #write :is(.md-htmlblock.vlook-media-html-block, [data-type='html-block'].md-htmlblock.vlook-media-html-block) {`);
    expect(css).toContain('.milkdown-table-block.table-figure.editor-typora-table-figure-without-caption');
    expect(css).toContain(`${scope} #write .v-btn-group.editor-typora-button-group-has-selected {`);
    expect(css).toContain(`${scope} #write :is(blockquote, details, .md-alert) {`);
    expect(css).toContain(`${scope} #write table :is(th, td).td-span {`);
    expect(css).toContain(`${scope} #write .vlook-caption-gap {`);
    expect(css).toContain(`${scope} #write .vlook-caption-target-codeblock.code-block-container.md-fences,`);
    expect(css).toContain(`${scope} #write .v-page-break.vlook-page-break {`);
    expect(css).toContain('break-before: page;');
    expect(css).toContain(`${scope} #write .v-tbl-row-g-btn,`);
    expect(css).toContain(`${scope} #write .v-svg-input-checkbox {`);
    expect(css).toContain(`${scope} #write :is(.v-fig-content, .v-caption) :is(img, svg) {`);
    expect(css).toContain(`${scope} #write .v-audio-mini-control {`);
    expect(css).toContain(`${scope} #write .v-backdrop-blurs {`);
    expect(css).toContain(`${scope} #write :is(.v-info-tips, .v-tool-tips) {`);
    expect(css).toContain(`${scope} #write .vlook-column-list {`);
    expect(css).toContain('--typora-vlook-column-gap: var(--vlaina-size-2rem);');
    expect(css).not.toContain("data-markdown-imported-theme^='vlook-'");
    expect(css).not.toContain("#write .md-hr + :is(ul, ol)");
    expect(css).not.toContain("#write hr + :is(ul, ol)");
    expect(css).not.toContain("#write .md-hr + :is(blockquote, details, .md-alert)");
    expect(css).not.toContain("#write hr + :is(blockquote, details, .md-alert)");
    expect(css).not.toContain(":has(+ :is(ul, ol))");
    expect(css).not.toContain(":has(");
  });

  it('keeps external theme code block backgrounds from covering block selection paint', () => {
    const css = readThemeCompatibilityStyle();

    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror.editor-block-selection-active .code-block-container.editor-block-selected,");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror.editor-block-selection-pending .code-block-container.editor-block-selected {");
    expect(css).toContain("background: var(--vlaina-block-selection-color, var(--vlaina-block-selection-color-default)) !important;");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror.editor-block-selection-active .editor-block-selected .code-block-container:not(.editor-block-selected),");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror.editor-block-selection-pending .code-block-container.editor-block-selected-contained {");
    expect(css).toContain("box-shadow: none !important;");
  });

  it('keeps external theme foreground and code chrome rules from overriding block selection', () => {
    const css = readThemeCompatibilityStyle();

    expect(css).not.toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror:not(.editor-block-selection-large) .editor-block-selected-textlike {\n  background-color:");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror:not(.editor-block-selection-large) .editor-block-selected-textlike > *:not(.code-block-container):not(.code-block-container *):not(.mermaid-block):not(.mermaid-block *) {");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror:is(.editor-block-selection-active, .editor-block-selection-pending) .editor-block-selected *:not(.code-block-container):not(.code-block-container *):not(.mermaid-block):not(.mermaid-block *),");
    expect(css).toContain("-webkit-text-fill-color: var(--vlaina-editor-block-selection-fg) !important;");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror.editor-block-selection-pending .code-block-chrome-language-label {");
    expect(css).toContain("display: inline !important;");
    expect(css).toContain("visibility: visible !important;");
    expect(css).toContain("opacity: var(--vlaina-opacity-0) !important;");
    expect(css).toContain("pointer-events: none !important;");
  });

  it('does not use CSS :has selectors in editor styles', () => {
    const offenders = readEditorStyleSourceFiles()
      .filter(({ source }) => source.includes(':has('))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  it('scopes body line number gutter styles behind the markdown body line number class', () => {
    const coreCss = readStyleFile('core.css');

    expect(coreCss).toContain(
      '.milkdown-editor.markdown-body-line-numbers .body-line-number-gutter'
    );
    expect(coreCss).toContain(
      '.milkdown-editor.markdown-body-line-numbers .body-line-number'
    );
    expect(coreCss).not.toContain('.milkdown-editor .body-line-number-gutter');
    expect(coreCss).not.toContain('.milkdown-editor .body-line-number {');
  });
});
