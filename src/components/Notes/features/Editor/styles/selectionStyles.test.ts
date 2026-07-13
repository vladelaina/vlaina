import { describe, expect, it } from "vitest";
import { extractCssRule, readEditorStyleSourceFiles, readStyleFile, readThemeCompatibilityStyle } from "./selectionStylesTestUtils";

describe("editor style theme compatibility", () => {
  it('keeps the Typora compatibility bridge scoped to imported external themes', () => {
    const css = readThemeCompatibilityStyle();

    expect(css).toContain(":where(.milkdown-editor[data-markdown-compat-layer='external'].theme-typora)");
    expect(css).toContain('--typora-inline-code-bg');
    expect(css).toContain('--typora-table-hover-bg');
    expect(css).toContain("[data-markdown-theme-color-scheme-mode='fixed-light']");
    expect(css).toContain('color-scheme: light;');
    expect(css).toContain('--vlaina-code-block-background: #f5f5f5;');
    expect(css).toContain('--vlaina-color-editor-inline-code-bg: var(--vlaina-code-inline-background);');
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
    const typoraHtmlBlockOverflowRule = extractCssRule(
      css,
      `${scope} #write :is(.md-htmlblock, [data-type='html-block'].md-htmlblock):not(`
    );
    expect(typoraHtmlBlockOverflowRule).toContain(":not([data-value='<!--vlaina-markdown-blank-line-->']):not([data-value='<!--vlaina-rendered-html-boundary-blank-line-->'])");
    expect(typoraHtmlBlockOverflowRule).toContain(":not([data-value='<!--vlaina-markdown-tight-heading-->'])");
    expect(typoraHtmlBlockOverflowRule).toContain('overflow-x: auto;');
    expect(css).not.toContain(`${scope} #write :is(.md-htmlblock, [data-type='html-block'].md-htmlblock) {\n`);
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
    const typoraImageCaptionRule = extractCssRule(
      css,
      `${scope} #write .image-block-container[data-alt]:not([data-alt='']):not([src*='#logo']):not([src*='#icon']):not([src*='#card'])::after`
    );
    expect(typoraImageCaptionRule).toContain('overflow-wrap: anywhere;');
    expect(typoraImageCaptionRule).toContain('word-break: break-word;');
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
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror.editor-block-selection-active .code-block-container.editor-block-drag-source,");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror.editor-block-selection-pending .code-block-container.editor-block-selected,");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror.editor-block-selection-pending .code-block-container.editor-block-drag-source {");
    expect(css).toContain("background: var(--vlaina-block-selection-color, var(--vlaina-block-selection-color-default)) !important;");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror.editor-block-selection-active .editor-block-selected .code-block-container:not(.editor-block-selected),");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror.editor-block-selection-pending .code-block-container.editor-block-selected-contained {");
    expect(css).toContain("box-shadow: none !important;");
  });

  it('keeps external theme foreground and code chrome rules from overriding block selection', () => {
    const css = readThemeCompatibilityStyle();
    const selectedCodeBorderRule = extractCssRule(
      css,
      [
        ".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror:is(.editor-block-selection-active, .editor-block-selection-pending) :is(",
        "  .code-block-container.editor-block-selected,",
        "  .code-block-container.editor-block-drag-source,",
        "  .editor-block-selected .code-block-container,",
        "  .code-block-container.editor-block-selected-contained",
        ") {",
      ].join('\n')
    );
    const selectedCodeForegroundRule = extractCssRule(
      css,
      [
        ".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror:is(.editor-block-selection-active, .editor-block-selection-pending) :is(",
        "  .code-block-container.editor-block-selected,",
        "  .code-block-container.editor-block-drag-source,",
        "  .editor-block-selected .code-block-container,",
        "  .code-block-container.editor-block-selected-contained",
        ") :is(",
      ].join('\n')
    );
    const selectedRichNodeSurfaceRule = extractCssRule(
      css,
      ".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror :is(\n  [data-type='math-inline'],"
    );
    const keyboardRichNodeRule = extractCssRule(
      css,
      ".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror.editor-atomic-block-keyboard-selected :is("
    );

    expect(css).not.toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror:not(.editor-block-selection-large) .editor-block-selected-textlike {\n  background-color:");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror:not(.editor-block-selection-large) .editor-block-selected-textlike > *:not(.code-block-container):not(.code-block-container *):not(.mermaid-block):not(.mermaid-block *):not(.heading-toggle-btn):not(.editor-collapse-btn):not(.ProseMirror-widget) {");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror:is(.editor-block-selection-active, .editor-block-selection-pending) .editor-block-selected:not(.code-block-container):not(.mermaid-block):not(.editor-tag-token):not(.editor-raw-markdown-link-text),");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror:is(.editor-block-selection-active, .editor-block-selection-pending) .editor-block-selected *:not(.code-block-container):not(.code-block-container *):not(.mermaid-block):not(.mermaid-block *):not(.editor-tag-token):not(.editor-tag-token *):not(a):not(a *):not(.external-link):not(.external-link *):not(.internal-link):not(.internal-link *):not(.editor-raw-markdown-link-text):not(.editor-raw-markdown-link-text *),");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror:is(.editor-block-selection-active, .editor-block-selection-pending) .editor-block-selected-textlike:not(.code-block-container):not(.mermaid-block):not(.editor-tag-token):not(.editor-raw-markdown-link-text),");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror:is(.editor-block-selection-active, .editor-block-selection-pending) .editor-block-selected-textlike *:not(.code-block-container):not(.code-block-container *):not(.mermaid-block):not(.mermaid-block *):not(.editor-tag-token):not(.editor-tag-token *):not(a):not(a *):not(.external-link):not(.external-link *):not(.internal-link):not(.internal-link *):not(.editor-raw-markdown-link-text):not(.editor-raw-markdown-link-text *) {");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror:is(.editor-block-selection-active, .editor-block-selection-pending) :is(\n  .editor-block-selected,");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror:is(.editor-block-selection-active, .editor-block-selection-pending) .editor-tag-token :is(\n  .editor-block-selected,");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror:is(.editor-block-selection-active, .editor-block-selection-pending) :is(a, .external-link, .internal-link, .editor-raw-markdown-link-text) :is(\n  .editor-block-selected,");
    expect(css).toContain("):is(a, .external-link, .internal-link, .editor-raw-markdown-link-text) {\n  color: var(--typora-link-color, var(--primary-color, var(--text-accent, var(--vlaina-accent)))) !important;");
    expect(css).toContain("-webkit-text-fill-color: var(--vlaina-editor-block-selection-fg) !important;");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror.editor-block-selection-pending .code-block-chrome-language-label {");
    expect(css).toContain("display: inline !important;");
    expect(css).toContain("visibility: visible !important;");
    expect(css).toContain("opacity: var(--vlaina-opacity-0) !important;");
    expect(css).toContain("pointer-events: none !important;");
    expect(selectedCodeBorderRule).toContain(".code-block-container.editor-block-selected,");
    expect(selectedCodeBorderRule).toContain(".code-block-container.editor-block-drag-source,");
    expect(selectedCodeBorderRule).toContain(".editor-block-selected .code-block-container,");
    expect(selectedCodeBorderRule).toContain(".code-block-container.editor-block-selected-contained");
    expect(selectedCodeBorderRule).toContain("border-color: var(--vlaina-color-white) !important;");
    expect(selectedCodeBorderRule).toContain("outline: var(--vlaina-code-block-selected-border-outline) !important;");
    expect(selectedCodeBorderRule).toContain("outline-offset: var(--vlaina-code-block-selected-border-outline-offset) !important;");
    expect(selectedCodeForegroundRule).toContain(".code-block-container.editor-block-selected,");
    expect(selectedCodeForegroundRule).toContain(".code-block-container.editor-block-drag-source,");
    expect(selectedCodeForegroundRule).toContain(".editor-block-selected .code-block-container,");
    expect(selectedCodeForegroundRule).toContain(".code-block-container.editor-block-selected-contained");
    expect(selectedCodeForegroundRule).toContain(".code-block-chrome-language-label,");
    expect(selectedCodeForegroundRule).toContain(".cm-line *,");
    expect(selectedCodeForegroundRule).toContain(".cm-s-inner *,");
    expect(selectedCodeForegroundRule).toContain("color: var(--vlaina-editor-block-selection-fg) !important;");
    expect(selectedCodeForegroundRule).toContain("-webkit-text-fill-color: var(--vlaina-editor-block-selection-fg) !important;");
    expect(selectedRichNodeSurfaceRule).toContain("[data-type='math-inline'],");
    expect(selectedRichNodeSurfaceRule).toContain("[data-type='math-block'],");
    expect(selectedRichNodeSurfaceRule).toContain("[data-type='html-block']:not([data-value='<!--vlaina-markdown-blank-line-->']):not([data-value='<!--vlaina-rendered-html-boundary-blank-line-->']):not([data-value='<!--vlaina-markdown-tight-heading-->']),");
    expect(selectedRichNodeSurfaceRule).toContain(".mermaid-block");
    expect(selectedRichNodeSurfaceRule).toContain(".ProseMirror-selectednode {");
    expect(selectedRichNodeSurfaceRule).toContain("--vlaina-block-selection-color: var(--vlaina-block-selection-color-default);");
    expect(selectedRichNodeSurfaceRule).toContain("background: var(--vlaina-block-selection-color) !important;");
    expect(selectedRichNodeSurfaceRule).toContain("background-color: var(--vlaina-block-selection-color) !important;");
    expect(selectedRichNodeSurfaceRule).toContain("box-shadow: var(--vlaina-block-selection-shadow) !important;");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror :is(\n  [data-type='math-inline'],\n  [data-type='math-block'],\n  [data-type='html-block']:not([data-value='<!--vlaina-markdown-blank-line-->']):not([data-value='<!--vlaina-rendered-html-boundary-blank-line-->']):not([data-value='<!--vlaina-markdown-tight-heading-->'])\n).ProseMirror-selectednode * {");
    expect(css).toContain("color: var(--vlaina-editor-block-selection-fg) !important;");
    expect(css).toContain(".milkdown-editor[data-markdown-compat-layer='external'] .ProseMirror .mermaid-block.ProseMirror-selectednode :is(text, tspan, .nodeLabel, .nodeLabel *, .label, .label *, .edgeLabel, .edgeLabel *) {");
    expect(css).toContain("color: var(--vlaina-mermaid-text) !important;");
    expect(css).toContain("-webkit-text-fill-color: var(--vlaina-mermaid-text) !important;");
    expect(css).toContain("fill: var(--vlaina-mermaid-text) !important;");
    expect(keyboardRichNodeRule).toContain(".ProseMirror-selectednode {");
    expect(keyboardRichNodeRule).toContain("background: var(--vlaina-math-hover-color) !important;");
    expect(keyboardRichNodeRule).toContain("box-shadow:");
    expect(keyboardRichNodeRule).toContain("color: inherit !important;");
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
    expect(coreCss).toContain(
      '.milkdown-editor.markdown-body-line-numbers .body-line-number.body-line-number-selected'
    );
    expect(coreCss).toContain('color: var(--vlaina-color-white);');
    expect(coreCss).toContain('-webkit-text-fill-color: var(--vlaina-color-white);');
    expect(coreCss).not.toContain('.milkdown-editor .body-line-number-gutter');
    expect(coreCss).not.toContain('.milkdown-editor .body-line-number {');
  });
});
