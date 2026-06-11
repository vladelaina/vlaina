import { describe, expect, it } from "vitest";
import {
  readStyleFile,
  readBlockSelectionStyle,
  readThemeStyle,
  readBlankAreaInteractionUtilsSource,
  readBlockSelectionLineFillOverlaySource,
  extractCssRule,
} from "./selectionStylesTestUtils";

describe("editor block drag interaction styles", () => {
  it('keeps block drag previews transparent and lightens preview text', () => {
    const css = readStyleFile('core.css');
    const themeCss = readThemeStyle();

    expect(css).toContain('.editor-block-drag-preview {');
    expect(css).toContain('background: transparent;');
    expect(css).toContain('border: var(--vlaina-border-width-0);');
    expect(css).toContain('box-shadow: none;');
    expect(css).toContain('.editor-block-drag-preview-layer {');
    expect(css).toContain('background: transparent;');
    expect(css).toContain('--vlaina-block-drag-preview-fg: var(--vlaina-color-block-drag-preview-fg);');
    expect(css).not.toContain('opacity: var(--vlaina-block-drag-preview-opacity);');
    expect(themeCss).not.toContain('--vlaina-block-drag-preview-opacity');
    expect(themeCss).toContain('--vlaina-color-block-drag-preview-fg: color-mix(in srgb, var(--vlaina-text-primary, currentColor) 40%, var(--vlaina-color-white) 60%);');
    expect(css).toContain('.editor-block-drag-preview-layer * {');
    expect(css).toContain('.editor-block-drag-preview-layer :is(ol, ul) {');
    expect(css).toContain('padding-inline-start: var(--vlaina-size-175rem);');
    expect(css).toContain('.editor-block-drag-preview-layer li::marker {');
  });

  it('paints dragged source blocks with the shared block selection surface', () => {
    const coreCss = readStyleFile('core.css');
    const css = readBlockSelectionStyle();
    const dragSourceColorRule = extractCssRule(
      css,
      '.milkdown .ProseMirror .editor-block-drag-source {'
    );
    const dragSourceSurfaceRule = extractCssRule(
      css,
      'body.editor-block-drag-active .milkdown .ProseMirror .editor-block-selected,'
    );
    const dragSourceForegroundRule = extractCssRule(
      css,
      'body.editor-block-drag-active .milkdown .ProseMirror .editor-block-selected:not(.code-block-container):not(.mermaid-block),'
    );
    const dragSourceMarkerRule = extractCssRule(
      css,
      'body.editor-block-drag-active .milkdown .ProseMirror li.editor-block-selected::marker,'
    );

    expect(css).toContain('.milkdown .ProseMirror .editor-block-drag-source {');
    expect(css).toContain('body.editor-block-drag-active .milkdown .ProseMirror .editor-block-selected,');
    expect(css).toContain('body.editor-block-drag-active .milkdown .ProseMirror .ProseMirror-selectednode,');
    expect(css).toContain('.milkdown .ProseMirror .editor-block-drag-source {');
    expect(dragSourceColorRule).toContain('--vlaina-block-selection-color: var(--vlaina-block-selection-color-default);');
    expect(dragSourceSurfaceRule).toContain('background-color: var(--vlaina-block-selection-color, var(--vlaina-block-selection-color-default)) !important;');
    expect(dragSourceSurfaceRule).toContain('box-shadow: var(--vlaina-block-selection-shadow) !important;');
    expect(dragSourceSurfaceRule).toContain('border-radius: var(--vlaina-radius-8px);');
    expect(dragSourceSurfaceRule).not.toContain('--vlaina-block-selection-bleed-x-start: var(--vlaina-block-selection-bleed-x-default);');
    expect(dragSourceSurfaceRule).not.toContain('--vlaina-block-selection-bleed-x-end: var(--vlaina-block-selection-bleed-x-default);');
    expect(css).not.toContain('opacity: var(--vlaina-opacity-38);');
    expect(coreCss).not.toContain('.milkdown .ProseMirror .editor-block-drag-source {');
    expect(css).toContain(':is(.editor-block-selected, .ProseMirror-selectednode, .editor-block-drag-source):not(:has(> :where(');
    expect(css).toContain('body.editor-block-drag-active .milkdown .ProseMirror :where(');
    expect(css).toContain('background-color: transparent !important;');
    expect(css).toContain('box-shadow: none !important;');
    expect(dragSourceForegroundRule).toContain('body.editor-block-drag-active .milkdown .ProseMirror .editor-block-selected *:not(.code-block-container):not(.code-block-container *):not(.mermaid-block):not(.mermaid-block *),');
    expect(dragSourceForegroundRule).toContain('.milkdown .ProseMirror .editor-block-drag-source:not(.code-block-container):not(.mermaid-block),');
    expect(dragSourceForegroundRule).toContain('.milkdown .ProseMirror .editor-block-drag-source *:not(.code-block-container):not(.code-block-container *):not(.mermaid-block):not(.mermaid-block *) {');
    expect(dragSourceMarkerRule).toContain('body.editor-block-drag-active .milkdown .ProseMirror li:has(> p.editor-block-selected)::marker,');
    expect(dragSourceMarkerRule).toContain('.milkdown .ProseMirror li.editor-block-drag-source::marker,');
    expect(dragSourceMarkerRule).toContain('.milkdown .ProseMirror li:has(> p.editor-block-drag-source)::marker {');
  });

  it('keeps block handle dragging on a grabbing cursor', () => {
    const css = readStyleFile('core.css');

    expect(css).toContain('body.editor-block-drag-active,');
    expect(css).toContain('body.editor-block-drag-active .milkdown,');
    expect(css).toContain('body.editor-block-drag-active .milkdown *,');
    expect(css).toContain('body.editor-block-drag-active .editor-block-drag-preview-layer,');
    expect(css).toContain('cursor: grabbing !important;');
  });

  it('keeps editor block selection color independent from global gray text tokens', () => {
    const css = readBlockSelectionStyle();
    const themeCss = readThemeStyle();
    const source = readBlankAreaInteractionUtilsSource();
    const lineFillSource = readBlockSelectionLineFillOverlaySource();

    expect(themeCss).toContain('--vlaina-editor-block-selection-base: var(--vlaina-color-editor-block-selection);');
    expect(themeCss).toContain('--vlaina-editor-block-selection-bg: var(--vlaina-color-editor-block-selection-bg);');
    expect(themeCss).toContain('--vlaina-editor-block-selection-fg: var(--vlaina-color-editor-block-selection-fg);');
    expect(themeCss).toContain('--vlaina-editor-block-selection-handle: var(--vlaina-color-editor-block-selection-handle);');
    expect(themeCss).toContain('--vlaina-block-selection-color-default: var(--vlaina-editor-block-selection-bg);');
    expect(themeCss).toContain('--vlaina-block-selection-bleed-x-default: var(--vlaina-space-72px);');
    expect(css).toContain('--vlaina-block-selection-color: var(--vlaina-block-selection-color-default);');
    expect(css).toContain('--vlaina-block-selection-bleed-x-start: var(--vlaina-block-selection-bleed-x-default);');
    expect(css).toContain('--vlaina-block-selection-bleed-x-end: var(--vlaina-block-selection-bleed-x-default);');
    expect(css).toContain('border-radius: var(--vlaina-radius-8px);');
    expect(css).toContain('box-decoration-break: clone;');
    expect(css).toContain('-webkit-box-decoration-break: clone;');
    expect(css).toContain('.milkdown.editor-block-selection-line-fill-host,');
    expect(css).toContain('.milkdown .editor-block-selection-line-fill-host {');
    expect(css).toContain('.milkdown .editor-block-selection-line-fill-layer {');
    expect(css).toContain('.milkdown .editor-block-selection-line-fill {');
    expect(css).toContain('.milkdown .ProseMirror .editor-block-selected-inline-line {');
    expect(css).toContain('background-color: transparent;');
    expect(css).toContain('box-shadow: none;');
    expect(css).toContain('color: var(--vlaina-editor-block-selection-fg);');
    expect(source).toContain("const DRAG_BOX_COLOR = 'var(--vlaina-color-editor-block-selection-drag-box)';");
    expect(lineFillSource).toContain('function resolveLineFillLeft(paragraph: HTMLElement, paragraphRect = paragraph.getBoundingClientRect()): number {');
    expect(lineFillSource).toContain('return paragraphRect.left - resolveBlockSelectionBleedXStart(paragraph);');
    expect(lineFillSource).toContain('paragraphRect = paragraph.getBoundingClientRect(),');
    expect(lineFillSource).toContain('const selectedBlockRight = editorRect.width > 0 ? editorRect.right : paragraphRect.right;');
    expect(lineFillSource).toContain('return Math.max(paragraphRect.right, selectedBlockRight) + resolveBlockSelectionBleedXEnd(paragraph);');
    expect(lineFillSource).toContain('const FALLBACK_BLOCK_SELECTION_BLEED_X_PX = 72;');
  });

  it('lets block selection and drag gestures pass over video embeds', () => {
    const css = readStyleFile('extended.css');
    const blockSelectionCss = readBlockSelectionStyle();

    expect(css).toContain('contain-intrinsic-size: var(--vlaina-height-video-intrinsic);');
    expect(css).toContain('.milkdown .video-block::after {');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .video-block.ProseMirror-selectednode::after,');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .video-block.editor-block-selected::after {');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .video-block.ProseMirror-selectednode,');
    expect(blockSelectionCss).toContain('.milkdown .ProseMirror .video-block.editor-block-selected {');
    expect(blockSelectionCss).toContain('--vlaina-block-selection-bleed-x-start: var(--vlaina-block-selection-bleed-x-default);');
    expect(blockSelectionCss).toContain('--vlaina-block-selection-bleed-x-end: var(--vlaina-block-selection-bleed-x-default);');
    expect(blockSelectionCss).toContain('background-color: var(--vlaina-block-selection-color);');
    expect(css).not.toContain('.milkdown .video-block.ProseMirror-selectednode::after,');
    expect(css).not.toContain('.milkdown .video-block.editor-block-selected {');
    expect(css).toContain('.editor-block-drag-preview .video-drag-preview-surface {');
    expect(css).toContain('background: transparent;');
    expect(css).toContain('.milkdown .ProseMirror.editor-block-selection-pending .video-block iframe,');
    expect(css).toContain('body.editor-block-drag-active .milkdown .video-block iframe,');
    expect(css).toContain('pointer-events: none;');
  });

  it('keeps markdown blank-line html blocks from intercepting floating toolbar clicks', () => {
    const css = readStyleFile('markdown.css');

    expect(css).toContain(".milkdown .ProseMirror > [data-type='html-block'][data-value='<!--vlaina-markdown-blank-line-->'] {");
    expect(css).toContain('pointer-events: none;');
  });

  it('suppresses editor icon hover affordances while dragging a block selection', () => {
    const css = readBlockSelectionStyle();

    expect(css).toContain('.milkdown .ProseMirror.editor-block-selection-pending :is(');
    expect(css).toContain('.heading-toggle-btn,');
    expect(css).toContain('.editor-block-control-btn,');
    expect(css).toContain('.editor-collapse-btn,');
    expect(css).toContain('.callout-icon-button,');
    expect(css).toContain('.milkdown-table-block .column-header-drag-control,');
    expect(css).toContain('pointer-events: none !important;');
    expect(css).toContain('opacity: var(--vlaina-opacity-0) !important;');
    expect(css).toContain('background: transparent !important;');
    expect(css).toContain('transform: none !important;');
  });

  it('uses the editor block handle token for the visible drag handle', () => {
    const css = readStyleFile('core.css');
    const themeCss = readThemeStyle();

    expect(css).toContain('.editor-block-controls.visible,\n.editor-block-controls.dragging {');
    expect(css).toContain('pointer-events: auto;');
    expect(css).toContain('.editor-block-controls.visible .editor-block-control-handle,');
    expect(css).toContain('.editor-block-controls.dragging .editor-block-control-handle {');
    expect(css).toContain('color: var(--vlaina-editor-block-selection-handle);');
    expect(css).toContain('.editor-block-controls.visible .editor-block-control-handle:hover {');
    expect(css).toContain('color: var(--vlaina-color-accent) !important;');
    expect(css).toContain('.editor-block-controls .editor-block-control-handle:hover :is(svg, path) {');
    expect(css).toContain('fill: var(--vlaina-color-accent) !important;');
    expect(themeCss).not.toContain('--vlaina-block-controls-drag-surface-pad');
    expect(css).not.toContain('.editor-block-controls.dragging::before');
    expect(css).not.toContain('vlaina-block-controls-drag-surface');
  });

  it('keeps list collapse toggles clear of wide ordered-list markers', () => {
    const css = readStyleFile('extended.css');
    const markdownCss = readStyleFile('markdown.css');
    const themeCss = readThemeStyle();

    expect(themeCss).toContain('--vlaina-editor-collapse-pos-heading: calc(0px - var(--vlaina-editor-collapse-gutter-base));');
    expect(themeCss).toContain('--vlaina-editor-collapse-pos-list: calc(0px - var(--vlaina-editor-collapse-gutter-base) - var(--vlaina-editor-collapse-marker-gap));');
    expect(themeCss).toContain('--vlaina-list-marker-extra: 0px;');
    expect(themeCss).not.toContain('--vlaina-editor-collapse-pos-list: calc(-1 *');
    expect(markdownCss).toContain('left: var(--vlaina-editor-collapse-pos-heading, -22px);');
    expect(css).toContain('left: calc(var(--vlaina-editor-collapse-pos-list, -46px) - var(--vlaina-list-marker-extra, 0px));');
    expect(css).not.toContain('left: var(--vlaina-editor-collapse-pos-list);');
  });
});
