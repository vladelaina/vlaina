export const LIST_COLLAPSED_CONTENT_CLASS = 'editor-collapsed-content';

export const MEDIA_ADJACENT_LAYOUT_CLASS_NAMES = [
  'cm-line',
  'editor-paragraph-has-image-block',
  'editor-paragraph-has-multiple-image-blocks',
  'first-p',
  'iframe',
  'md-htmlblock',
  'md-htmlblock-container',
  'md-p',
  'v-caption',
  'vlook-media-html-block',
] as const;

export const MEDIA_ADJACENT_LAYOUT_STYLE_PROPS = [
  'display',
  'fontSize',
  'lineHeight',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginTop',
  'maxWidth',
  'minHeight',
  'paddingBottom',
  'paddingTop',
  'width',
] as const;

export type MediaAdjacentLayoutStyleProp = typeof MEDIA_ADJACENT_LAYOUT_STYLE_PROPS[number];

export const MARKDOWN_BLANK_LINE_VALUE = '<!--vlaina-markdown-blank-line-->';

export const MARKDOWN_BLANK_LINE_CLASS_NAMES = [
  'editor-editable-markdown-blank-line',
  'editor-empty-paragraph',
] as const;

export const MARKDOWN_BLANK_LINE_STYLE_PROPS = [
  'display',
  'fontSize',
  'lineHeight',
  'marginBottom',
  'marginTop',
  'minHeight',
  'paddingBottom',
  'paddingTop',
] as const;

export type MarkdownBlankLineStyleProp = typeof MARKDOWN_BLANK_LINE_STYLE_PROPS[number];

export const TOP_LEVEL_LAYOUT_DECORATION_CLASS_NAMES = [
  'heading-collapsed-content',
  'editor-collapsed-content',
  'HyperMD-list-line',
  'cm-line',
  'md-task-list-item',
  'task-list-item',
  'HyperMD-task-line',
  'is-checked',
  'has-list-bullet',
  'contains-task-list',
  'first-p',
  'v-caption',
  'vlook-caption-block',
  'vlook-caption-target',
  'vlook-caption-target-table',
  'vlook-caption-target-codeblock',
  'vlook-caption-target-formula',
  'vlook-caption-target-iframe',
  'vlook-caption-target-mermaid',
  'vlook-caption-gap',
  'vlook-tab-caption',
  'vlook-highlight-block',
  'vlook-emphasis-block',
  'vlook-strong-block',
  'vlook-underline-block',
  'vlook-sup-line',
  'vlook-sub-line',
  'v-column',
  'vlook-column-marker',
  'vlook-column-block',
  'vlook-column-2',
  'vlook-column-3',
  'vlook-column-4',
  'vlook-column-5',
  'vlook-column-item-1',
  'vlook-column-item-2',
  'vlook-column-item-3',
  'vlook-column-item-4',
  'vlook-column-item-5',
  'vlook-column-first',
  'vlook-column-list',
  'vlook-column-quote',
  'vlook-column-gap',
  'v-post-card',
  'vlook-post-card',
  'vlook-post-card-dual',
  'v-card-image',
  'v-card-title',
  'v-card-text',
  'v-page-break',
  'vlook-page-break',
  'vlook-media-html-block',
  'vlook-inline-html',
  'vlook-kbd-html',
  'v-btn',
  'table',
  'codeblock',
  'formula',
  'iframe',
  'mermaid',
  'v-cap-cntr',
  'em',
] as const;

export const TOP_LEVEL_LAYOUT_DECORATION_STYLE_PROPS = [
  'alignItems',
  'columnCount',
  'columnGap',
  'columnRule',
  'display',
  'flexBasis',
  'flexGrow',
  'flexShrink',
  'flexWrap',
  'fontSize',
  'height',
  'justifyContent',
  'lineHeight',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginTop',
  'maxHeight',
  'maxWidth',
  'minHeight',
  'minWidth',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'rowGap',
  'visibility',
  'width',
] as const;

export type TopLevelLayoutDecorationStyleProp = typeof TOP_LEVEL_LAYOUT_DECORATION_STYLE_PROPS[number];

export function copyAllowedClasses(
  sourceElement: HTMLElement,
  previewElement: HTMLElement,
  classNames: readonly string[]
): void {
  classNames.forEach((className) => {
    if (sourceElement.classList.contains(className)) {
      previewElement.classList.add(className);
    }
  });
}

export function mirrorLayoutStyles(
  sourceElement: HTMLElement,
  previewElement: HTMLElement,
  props: readonly (MediaAdjacentLayoutStyleProp | MarkdownBlankLineStyleProp | TopLevelLayoutDecorationStyleProp)[]
): void {
  let computed: CSSStyleDeclaration | null = null;
  props.forEach((prop) => {
    const inlineValue = sourceElement.style[prop];
    if (inlineValue) {
      previewElement.style[prop] = inlineValue;
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    computed ??= window.getComputedStyle(sourceElement);
    const computedValue = computed[prop];
    if (computedValue) {
      previewElement.style[prop] = computedValue;
    }
  });
}
