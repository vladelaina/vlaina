import { DOMSerializer } from '@milkdown/kit/prose/model';
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import type { EditorState, Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { CodeBlockNodeView } from '../code/CodeBlockNodeView';
import { getMermaidElementCode } from '../mermaid/mermaidDom';
import { getMathElementLatex } from '../math/mathSchema';
import { getVideoElementAttrs } from '../video/videoDom';
import {
  DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT,
  STOP_PROSE_SCAN,
  scanProseDescendants,
} from '../shared/boundedProseNodeScan';

const previewCleanupCallbacks = new WeakMap<HTMLElement, () => void>();

export const MAX_APPLIED_PREVIEW_DOM_SCAN_ELEMENTS = 20_000;
export const MAX_APPLIED_PREVIEW_MATCHED_ELEMENTS = 5_000;
export const MAX_APPLIED_PREVIEW_CODE_BLOCK_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
export const MAX_APPLIED_PREVIEW_TRAILING_BREAK_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
export const MAX_APPLIED_PREVIEW_TRAILING_BREAK_DEPTH = 512;

type AppliedPreviewElementCollection = {
  elements: HTMLElement[];
  complete: boolean;
};

export function collectAppliedPreviewElements(
  root: HTMLElement,
  matches: (element: HTMLElement) => boolean,
  options: {
    maxScanned?: number;
    maxMatches?: number;
  } = {}
): AppliedPreviewElementCollection {
  const maxScanned = options.maxScanned ?? MAX_APPLIED_PREVIEW_DOM_SCAN_ELEMENTS;
  const maxMatches = options.maxMatches ?? MAX_APPLIED_PREVIEW_MATCHED_ELEMENTS;
  const elements: HTMLElement[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, 1);
  let scanned = 0;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    scanned += 1;
    if (scanned > maxScanned) {
      return { elements: [], complete: false };
    }

    if (!(node instanceof HTMLElement) || !matches(node)) {
      continue;
    }

    elements.push(node);
    if (elements.length > maxMatches) {
      return { elements: [], complete: false };
    }
  }

  return { elements, complete: true };
}

export function createAppliedPreviewState(
  view: EditorView,
  apply: (previewView: EditorView) => void
): EditorState {
  const previewView: any = {
    ...view,
    state: view.state,
    dom: {},
    dispatch(tr: Transaction) {
      previewView.state = previewView.state.apply(tr);
    },
    focus() {},
    nodeDOM() {
      return null;
    },
  };

  apply(previewView as EditorView);
  return previewView.state;
}

export function renderAppliedPreviewDocument(
  state: EditorState,
  sourceDom: HTMLElement | null,
  ownerDocument: Document,
  extraClassName?: string,
  view?: EditorView
): HTMLElement {
  const previewDom = sourceDom
    ? sourceDom.cloneNode(false) as HTMLElement
    : ownerDocument.createElement('div');
  const className = sourceDom?.className || 'ProseMirror';
  previewDom.className = extraClassName ? `${className} ${extraClassName}` : className;
  previewDom.removeAttribute('data-toolbar-preview-hidden');
  previewDom.removeAttribute('contenteditable');
  previewDom.removeAttribute('tabindex');
  previewDom.setAttribute('aria-hidden', 'true');
  previewDom.appendChild(
    DOMSerializer.fromSchema(state.schema).serializeFragment(
      state.doc.content,
      { document: ownerDocument }
    )
  );
  addProseMirrorTrailingBreaks(previewDom, state.doc, ownerDocument);
  const didPreserveCodeBlocks = preserveSourceCodeBlockNodeViews(previewDom, sourceDom);
  if (!didPreserveCodeBlocks && view) {
    // Serialized ProseMirror output is not enough for custom-rendered blocks.
    // Rehydrate preview-only code blocks with the same node view used by the
    // live editor so hover previews stay equivalent to the committed result.
    renderCodeBlockNodeViewPreviews(previewDom, state, view);
  }
  preserveSourceImageBlockNodeViews(previewDom, sourceDom);
  preserveSourceFrontmatterNodeViews(previewDom, sourceDom);
  preserveSourceRenderedAtomNodes(previewDom, sourceDom);
  stabilizePreviewMediaAdjacentLayout(previewDom, sourceDom);
  stabilizePreviewBlankLineLayout(previewDom, sourceDom);
  stabilizePreviewTopLevelLayoutDecorations(previewDom, sourceDom);
  stabilizePreviewListLayout(previewDom, sourceDom);
  stabilizePreviewRootTypography(previewDom, sourceDom);
  return previewDom;
}

export function cleanupAppliedPreviewDocument(previewDom: HTMLElement): void {
  previewCleanupCallbacks.get(previewDom)?.();
  previewCleanupCallbacks.delete(previewDom);
}

const ROOT_TYPOGRAPHY_STYLE_PROPS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'wordSpacing',
  'whiteSpace',
] as const;

function stabilizePreviewRootTypography(previewDom: HTMLElement, sourceDom: HTMLElement | null): void {
  if (!sourceDom || typeof window === 'undefined') {
    return;
  }

  const computed = window.getComputedStyle(sourceDom);
  ROOT_TYPOGRAPHY_STYLE_PROPS.forEach((prop) => {
    const value = computed[prop];
    if (value) {
      previewDom.style[prop] = value;
    }
  });
}

const LIST_COLLAPSED_CONTENT_CLASS = 'editor-collapsed-content';

const IMAGE_BLOCK_CONTAINER_CLASS = 'image-block-container';

const IMAGE_BLOCK_PARAGRAPH_CLASSES = [
  'editor-paragraph-has-image-block',
  'editor-paragraph-has-multiple-image-blocks',
] as const;

const IMAGE_BLOCK_PARAGRAPH_STYLE_PROPS = [
  'display',
  'fontSize',
  'lineHeight',
  'marginBottom',
  'marginTop',
  'minHeight',
  'paddingBottom',
  'paddingTop',
] as const;

const MEDIA_ADJACENT_LAYOUT_CLASS_NAMES = [
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

const MEDIA_ADJACENT_LAYOUT_STYLE_PROPS = [
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

type MediaAdjacentLayoutStyleProp = typeof MEDIA_ADJACENT_LAYOUT_STYLE_PROPS[number];

const MARKDOWN_BLANK_LINE_VALUE = '<!--vlaina-markdown-blank-line-->';

const MARKDOWN_BLANK_LINE_CLASS_NAMES = [
  'editor-editable-markdown-blank-line',
  'editor-empty-paragraph',
] as const;

const MARKDOWN_BLANK_LINE_STYLE_PROPS = [
  'display',
  'fontSize',
  'lineHeight',
  'marginBottom',
  'marginTop',
  'minHeight',
  'paddingBottom',
  'paddingTop',
] as const;

type MarkdownBlankLineStyleProp = typeof MARKDOWN_BLANK_LINE_STYLE_PROPS[number];

const TOP_LEVEL_LAYOUT_DECORATION_CLASS_NAMES = [
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

const TOP_LEVEL_LAYOUT_DECORATION_STYLE_PROPS = [
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

type TopLevelLayoutDecorationStyleProp = typeof TOP_LEVEL_LAYOUT_DECORATION_STYLE_PROPS[number];

const LIST_LAYOUT_SELECTOR = 'ul, ol, li, li > p, li > [data-text-align]';

const LIST_LAYOUT_STYLE_PROPS = [
  'alignItems',
  'columnGap',
  'display',
  'flexBasis',
  'flexGrow',
  'flexShrink',
  'flexWrap',
  'justifyContent',
  'lineHeight',
  'listStylePosition',
  'listStyleType',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginTop',
  'maxWidth',
  'minWidth',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'rowGap',
  'width',
] as const;

function getListLayoutSignature(element: HTMLElement): string {
  const parentListItem = element.closest('li');
  const parentSignature = parentListItem && parentListItem !== element
    ? `:${parentListItem.dataset.itemType ?? ''}:${parentListItem.dataset.listType ?? ''}`
    : '';
  return [
    element.tagName,
    element.dataset.itemType ?? '',
    element.dataset.listType ?? '',
    element.dataset.textAlign ?? '',
    parentSignature,
  ].join(':');
}

function canMirrorListLayout(sourceElement: HTMLElement, previewElement: HTMLElement): boolean {
  return (
    sourceElement.tagName === previewElement.tagName &&
    getListLayoutSignature(sourceElement) === getListLayoutSignature(previewElement)
  );
}

function stabilizePreviewListLayout(previewDom: HTMLElement, sourceDom: HTMLElement | null): void {
  if (!sourceDom || typeof window === 'undefined') {
    return;
  }

  const sourceCollection = collectAppliedPreviewElements(
    sourceDom,
    (element) => element.matches(LIST_LAYOUT_SELECTOR)
  );
  const previewCollection = collectAppliedPreviewElements(
    previewDom,
    (element) => element.matches(LIST_LAYOUT_SELECTOR)
  );
  if (!sourceCollection.complete || !previewCollection.complete) {
    return;
  }

  const { elements: sourceElements } = sourceCollection;
  const { elements: previewElements } = previewCollection;
  if (sourceElements.length !== previewElements.length) {
    return;
  }

  sourceElements.forEach((sourceElement, index) => {
    const previewElement = previewElements[index];
    if (!previewElement || !canMirrorListLayout(sourceElement, previewElement)) {
      return;
    }

    if (sourceElement.classList.contains(LIST_COLLAPSED_CONTENT_CLASS)) {
      previewElement.classList.add(LIST_COLLAPSED_CONTENT_CLASS);
    }
    copyAllowedClasses(sourceElement, previewElement, TOP_LEVEL_LAYOUT_DECORATION_CLASS_NAMES);
    if (sourceElement.hasAttribute('data-task')) {
      previewElement.setAttribute('data-task', sourceElement.getAttribute('data-task') ?? '');
    }
    if (sourceElement.hasAttribute('aria-checked')) {
      previewElement.setAttribute('aria-checked', sourceElement.getAttribute('aria-checked') ?? '');
    }

    const computed = window.getComputedStyle(sourceElement);
    LIST_LAYOUT_STYLE_PROPS.forEach((prop) => {
      const value = computed[prop];
      if (value) {
        previewElement.style[prop] = value;
      }
    });
  });
}

function hasDirectPreCodeChild(element: HTMLElement): boolean {
  for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
    if (child.tagName !== 'PRE') {
      continue;
    }

    for (let preChild = child.firstElementChild; preChild; preChild = preChild.nextElementSibling) {
      if (preChild.tagName === 'CODE') {
        return true;
      }
    }
  }

  return false;
}

function getSerializedCodeBlockElements(previewDom: HTMLElement): HTMLElement[] | null {
  const collection = collectAppliedPreviewElements(previewDom, (element) => {
    if (element.matches('pre.code-block-wrapper')) {
      return true;
    }

    return element.tagName === 'DIV' && hasDirectPreCodeChild(element);
  });
  return collection.complete ? collection.elements : null;
}

export function getPreviewCodeBlockNodes(
  state: EditorState,
  expectedCount: number
): Array<{ node: ProseMirrorNode; pos: number }> | null {
  if (expectedCount <= 0) {
    return [];
  }

  const codeBlocks: Array<{ node: ProseMirrorNode; pos: number }> = [];

  const completed = scanProseDescendants(state.doc, (node, pos) => {
    if (node.type?.name === 'code_block') {
      codeBlocks.push({ node: node as ProseMirrorNode, pos });
      return codeBlocks.length >= expectedCount ? STOP_PROSE_SCAN : true;
    }
    return true;
  }, MAX_APPLIED_PREVIEW_CODE_BLOCK_SCAN_NODES);

  return completed && codeBlocks.length === expectedCount ? codeBlocks : null;
}

function renderCodeBlockNodeViewPreviews(
  previewDom: HTMLElement,
  state: EditorState,
  view: EditorView
): void {
  const previewCodeBlocks = getSerializedCodeBlockElements(previewDom);
  if (!previewCodeBlocks || previewCodeBlocks.length === 0) {
    return;
  }

  const codeBlockNodes = getPreviewCodeBlockNodes(state, previewCodeBlocks.length);
  if (!codeBlockNodes) {
    return;
  }

  const nodeViews: CodeBlockNodeView[] = [];

  previewCodeBlocks.forEach((previewCodeBlock, index) => {
    const entry = codeBlockNodes[index];
    if (!entry) {
      return;
    }

    const nodeView = new CodeBlockNodeView(entry.node, view, () => undefined);
    nodeView.dom.setAttribute('aria-hidden', 'true');
    if (!makePreviewCloneNonInteractive(nodeView.dom)) {
      nodeView.destroy();
      return;
    }
    previewCodeBlock.replaceWith(nodeView.dom);
    nodeViews.push(nodeView);
  });

  if (nodeViews.length > 0) {
    previewCleanupCallbacks.set(previewDom, () => {
      nodeViews.forEach((nodeView) => nodeView.destroy());
    });
  }
}

function preserveSourceCodeBlockNodeViews(previewDom: HTMLElement, sourceDom: HTMLElement | null): boolean {
  if (!sourceDom) {
    return false;
  }

  const sourceCodeBlockCollection = collectAppliedPreviewElements(
    sourceDom,
    (element) => element.classList.contains('code-block-container')
  );
  if (!sourceCodeBlockCollection.complete) {
    return false;
  }

  const { elements: sourceCodeBlocks } = sourceCodeBlockCollection;
  if (sourceCodeBlocks.length === 0) {
    return false;
  }

  const previewCodeBlocks = getSerializedCodeBlockElements(previewDom);
  if (!previewCodeBlocks || previewCodeBlocks.length !== sourceCodeBlocks.length) {
    return false;
  }

  const clones: HTMLElement[] = [];
  for (let index = 0; index < previewCodeBlocks.length; index += 1) {
    const sourceCodeBlock = sourceCodeBlocks[index];
    if (!sourceCodeBlock) {
      return false;
    }

    const clone = sourceCodeBlock.cloneNode(true) as HTMLElement;
    if (!makePreviewCloneNonInteractive(clone)) {
      return false;
    }
    clones.push(clone);
  }

  previewCodeBlocks.forEach((previewCodeBlock, index) => {
    const clone = clones[index];
    if (!clone) {
      return;
    }
    previewCodeBlock.replaceWith(clone);
  });
  return true;
}

function preserveSourceImageBlockNodeViews(previewDom: HTMLElement, sourceDom: HTMLElement | null): void {
  if (!sourceDom) {
    return;
  }

  const sourceImageCollection = collectAppliedPreviewElements(
    sourceDom,
    (element) => element.classList.contains(IMAGE_BLOCK_CONTAINER_CLASS)
  );
  if (!sourceImageCollection.complete) {
    return;
  }

  const { elements: sourceImages } = sourceImageCollection;
  if (sourceImages.length === 0) {
    return;
  }

  const previewImages = getPreviewImagesForSourceImageBlocks(previewDom, sourceImages);
  if (!previewImages) {
    return;
  }

  previewImages.forEach((previewImage, index) => {
    const sourceImage = sourceImages[index];
    if (!sourceImage) {
      return;
    }

    const clone = sourceImage.cloneNode(true) as HTMLElement;
    if (!makePreviewCloneNonInteractive(clone)) {
      return;
    }
    mirrorImageBlockParagraphLayout(sourceImage, previewImage);
    previewImage.replaceWith(clone);
  });
}

function getPreviewImagesForSourceImageBlocks(
  previewDom: HTMLElement,
  sourceImages: HTMLElement[]
): HTMLElement[] | null {
  const previewImageCollection = collectAppliedPreviewElements(
    previewDom,
    (element) => element.tagName === 'IMG'
  );
  if (!previewImageCollection.complete) {
    return null;
  }

  const { elements: previewImages } = previewImageCollection;
  if (previewImages.length === sourceImages.length) {
    return previewImages;
  }

  const matchedPreviewImages: HTMLElement[] = [];
  let searchStartIndex = 0;

  for (const sourceImage of sourceImages) {
    const sourceSignature = getImageBlockSignature(sourceImage);
    if (!sourceSignature) {
      return null;
    }

    let matchedImage: HTMLElement | null = null;
    for (let index = searchStartIndex; index < previewImages.length; index += 1) {
      const previewImage = previewImages[index];
      if (!previewImage || getSerializedPreviewImageSignature(previewImage) !== sourceSignature) {
        continue;
      }

      matchedImage = previewImage;
      searchStartIndex = index + 1;
      break;
    }

    if (!matchedImage) {
      return null;
    }
    matchedPreviewImages.push(matchedImage);
  }

  return matchedPreviewImages.length === sourceImages.length ? matchedPreviewImages : null;
}

function getImageBlockSignature(element: HTMLElement): string | null {
  const source = element.dataset.src || element.getAttribute('src');
  if (!source) {
    return null;
  }

  return JSON.stringify([
    source,
    element.dataset.alt || '',
    element.dataset.title || element.getAttribute('title') || '',
    element.dataset.width || element.getAttribute('width') || '',
    element.dataset.align || element.getAttribute('align') || 'center',
  ]);
}

function getSerializedPreviewImageSignature(element: HTMLElement): string | null {
  const source = element.dataset.src || element.getAttribute('src');
  if (!source) {
    return null;
  }

  return JSON.stringify([
    source,
    element.getAttribute('alt') || '',
    element.getAttribute('title') || '',
    element.getAttribute('width') || '',
    element.getAttribute('align') || 'center',
  ]);
}

function closestImageBlockParagraph(element: HTMLElement): HTMLElement | null {
  const paragraph = element.closest('p');
  return paragraph instanceof HTMLElement ? paragraph : null;
}

function mirrorImageBlockParagraphLayout(sourceImage: HTMLElement, previewImage: HTMLElement): void {
  const sourceParagraph = closestImageBlockParagraph(sourceImage);
  const previewParagraph = closestImageBlockParagraph(previewImage);
  if (!sourceParagraph || !previewParagraph) {
    return;
  }

  IMAGE_BLOCK_PARAGRAPH_CLASSES.forEach((className) => {
    if (sourceParagraph.classList.contains(className)) {
      previewParagraph.classList.add(className);
    }
  });

  let computed: CSSStyleDeclaration | null = null;
  IMAGE_BLOCK_PARAGRAPH_STYLE_PROPS.forEach((prop) => {
    const inlineValue = sourceParagraph.style[prop];
    if (inlineValue) {
      previewParagraph.style[prop] = inlineValue;
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    computed ??= window.getComputedStyle(sourceParagraph);
    const computedValue = computed[prop];
    if (computedValue) {
      previewParagraph.style[prop] = computedValue;
    }
  });
}

function canMirrorMediaAdjacentElement(sourceElement: HTMLElement, previewElement: HTMLElement): boolean {
  return (
    sourceElement.tagName === previewElement.tagName &&
    (sourceElement.tagName === 'P' || sourceElement.dataset.type === 'html-block') &&
    (sourceElement.dataset.type ?? '') === (previewElement.dataset.type ?? '')
  );
}

function hasDirectImageBlock(element: HTMLElement): boolean {
  for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
    if (child.classList.contains(IMAGE_BLOCK_CONTAINER_CLASS)) {
      return true;
    }
  }
  return false;
}

function isMediaLayoutAnchor(element: HTMLElement | undefined): boolean {
  if (!element) {
    return false;
  }

  if (hasDirectImageBlock(element)) {
    return true;
  }

  if (element.dataset.type !== 'html-block') {
    return false;
  }

  return element.querySelector('img, iframe, video, object, embed') !== null;
}

function shouldMirrorMediaAdjacentLayout(elements: HTMLElement[], index: number): boolean {
  return (
    isMediaLayoutAnchor(elements[index]) ||
    isMediaLayoutAnchor(elements[index - 1]) ||
    isMediaLayoutAnchor(elements[index + 1])
  );
}

function copyAllowedClasses(
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

function mirrorLayoutStyles(
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

function stabilizePreviewMediaAdjacentLayout(previewDom: HTMLElement, sourceDom: HTMLElement | null): void {
  if (!sourceDom) {
    return;
  }

  const sourceElements = Array.from(sourceDom.children)
    .filter((element): element is HTMLElement => element instanceof HTMLElement);
  const previewElements = Array.from(previewDom.children)
    .filter((element): element is HTMLElement => element instanceof HTMLElement);
  if (sourceElements.length !== previewElements.length) {
    return;
  }

  sourceElements.forEach((sourceElement, index) => {
    const previewElement = previewElements[index];
    if (
      !previewElement ||
      !canMirrorMediaAdjacentElement(sourceElement, previewElement) ||
      !shouldMirrorMediaAdjacentLayout(sourceElements, index)
    ) {
      return;
    }

    copyAllowedClasses(sourceElement, previewElement, MEDIA_ADJACENT_LAYOUT_CLASS_NAMES);
    mirrorLayoutStyles(sourceElement, previewElement, MEDIA_ADJACENT_LAYOUT_STYLE_PROPS);
  });
}

function isMarkdownBlankLineElement(element: HTMLElement): boolean {
  if (
    element.dataset.type === 'html-block' &&
    element.dataset.value === MARKDOWN_BLANK_LINE_VALUE
  ) {
    return true;
  }

  return (
    element.tagName === 'P' &&
    (
      element.classList.contains('editor-editable-markdown-blank-line') ||
      (
        element.classList.contains('editor-empty-paragraph') &&
        !element.classList.contains('is-editor-empty')
      )
    )
  );
}

function canMirrorMarkdownBlankLineLayout(sourceElement: HTMLElement, previewElement: HTMLElement): boolean {
  if (!isMarkdownBlankLineElement(sourceElement)) {
    return false;
  }

  if (sourceElement.dataset.type === 'html-block') {
    return previewElement.dataset.type === 'html-block';
  }

  return previewElement.tagName === 'P';
}

function stabilizePreviewBlankLineLayout(previewDom: HTMLElement, sourceDom: HTMLElement | null): void {
  if (!sourceDom) {
    return;
  }

  const sourceElements = Array.from(sourceDom.children)
    .filter((element): element is HTMLElement => element instanceof HTMLElement);
  const previewElements = Array.from(previewDom.children)
    .filter((element): element is HTMLElement => element instanceof HTMLElement);
  if (sourceElements.length !== previewElements.length) {
    return;
  }

  sourceElements.forEach((sourceElement, index) => {
    const previewElement = previewElements[index];
    if (!previewElement || !canMirrorMarkdownBlankLineLayout(sourceElement, previewElement)) {
      return;
    }

    copyAllowedClasses(sourceElement, previewElement, MARKDOWN_BLANK_LINE_CLASS_NAMES);
    if (sourceElement.dataset.type === 'html-block') {
      previewElement.dataset.value = MARKDOWN_BLANK_LINE_VALUE;
    }
    mirrorLayoutStyles(sourceElement, previewElement, MARKDOWN_BLANK_LINE_STYLE_PROPS);
  });
}

function hasTopLevelLayoutDecoration(element: HTMLElement): boolean {
  return TOP_LEVEL_LAYOUT_DECORATION_CLASS_NAMES.some((className) => element.classList.contains(className));
}

function canMirrorTopLevelLayoutDecoration(sourceElement: HTMLElement, previewElement: HTMLElement): boolean {
  return (
    sourceElement.tagName === previewElement.tagName &&
    hasTopLevelLayoutDecoration(sourceElement)
  );
}

function stabilizePreviewTopLevelLayoutDecorations(previewDom: HTMLElement, sourceDom: HTMLElement | null): void {
  if (!sourceDom) {
    return;
  }

  const sourceElements = Array.from(sourceDom.children)
    .filter((element): element is HTMLElement => element instanceof HTMLElement);
  const previewElements = Array.from(previewDom.children)
    .filter((element): element is HTMLElement => element instanceof HTMLElement);
  if (sourceElements.length !== previewElements.length) {
    return;
  }

  sourceElements.forEach((sourceElement, index) => {
    const previewElement = previewElements[index];
    if (!previewElement || !canMirrorTopLevelLayoutDecoration(sourceElement, previewElement)) {
      return;
    }

    copyAllowedClasses(sourceElement, previewElement, TOP_LEVEL_LAYOUT_DECORATION_CLASS_NAMES);
    if (sourceElement.hasAttribute('data-task')) {
      previewElement.setAttribute('data-task', sourceElement.getAttribute('data-task') ?? '');
    }
    if (sourceElement.hasAttribute('aria-checked')) {
      previewElement.setAttribute('aria-checked', sourceElement.getAttribute('aria-checked') ?? '');
    }
    mirrorLayoutStyles(sourceElement, previewElement, TOP_LEVEL_LAYOUT_DECORATION_STYLE_PROPS);
  });
}

function preserveSourceFrontmatterNodeViews(previewDom: HTMLElement, sourceDom: HTMLElement | null): void {
  if (!sourceDom) {
    return;
  }

  const sourceFrontmatterCollection = collectAppliedPreviewElements(
    sourceDom,
    (element) => element.classList.contains('frontmatter-block-container')
  );
  if (!sourceFrontmatterCollection.complete) {
    return;
  }

  const { elements: sourceFrontmatters } = sourceFrontmatterCollection;
  if (sourceFrontmatters.length === 0) {
    return;
  }

  const previewFrontmatterCollection = collectAppliedPreviewElements(
    previewDom,
    (element) => element.dataset.type === 'frontmatter'
  );
  if (
    !previewFrontmatterCollection.complete ||
    previewFrontmatterCollection.elements.length !== sourceFrontmatters.length
  ) {
    return;
  }
  const { elements: previewFrontmatters } = previewFrontmatterCollection;

  previewFrontmatters.forEach((previewFrontmatter, index) => {
    const sourceFrontmatter = sourceFrontmatters[index];
    if (!sourceFrontmatter) {
      return;
    }

    const clone = sourceFrontmatter.cloneNode(true) as HTMLElement;
    if (!makePreviewCloneNonInteractive(clone)) {
      return;
    }
    previewFrontmatter.replaceWith(clone);
  });
}

function getRenderedAtomSignature(element: HTMLElement): string | null {
  const type = element.dataset.type;
  if (type === 'math-inline' || type === 'math-block') {
    return `${type}:${getMathElementLatex(element)}`;
  }

  if (type === 'mermaid') {
    return `${type}:${getMermaidElementCode(element)}`;
  }

  if (type === 'video') {
    const attrs = getVideoElementAttrs(element);
    return JSON.stringify([
      type,
      attrs.src,
      attrs.title ?? '',
      attrs.width ?? '',
      attrs.height ?? '',
    ]);
  }

  return null;
}

function isRenderedAtomElement(element: HTMLElement): boolean {
  const type = element.dataset.type;
  return type === 'math-inline' || type === 'math-block' || type === 'mermaid' || type === 'video';
}

function getRenderedAtomElements(root: HTMLElement): HTMLElement[] | null {
  const collection = collectAppliedPreviewElements(root, isRenderedAtomElement);
  return collection.complete ? collection.elements : null;
}

function preserveSourceRenderedAtomNodes(previewDom: HTMLElement, sourceDom: HTMLElement | null): void {
  if (!sourceDom) {
    return;
  }

  const previewAtoms = getRenderedAtomElements(previewDom);
  if (!previewAtoms || previewAtoms.length === 0) {
    return;
  }

  const sourceAtoms = getRenderedAtomElements(sourceDom);
  if (!sourceAtoms || sourceAtoms.length !== previewAtoms.length) {
    return;
  }

  previewAtoms.forEach((previewAtom, index) => {
    const sourceAtom = sourceAtoms[index];
    if (!sourceAtom) {
      return;
    }

    if (getRenderedAtomSignature(sourceAtom) !== getRenderedAtomSignature(previewAtom)) {
      return;
    }

    const clone = sourceAtom.cloneNode(true) as HTMLElement;
    if (!makePreviewCloneNonInteractive(clone)) {
      return;
    }
    previewAtom.replaceWith(clone);
  });
}

function isPreviewInteractiveElement(element: HTMLElement): boolean {
  return (
    (element.tagName === 'IFRAME' && element.hasAttribute('src')) ||
    element.hasAttribute('contenteditable') ||
    element.hasAttribute('tabindex')
  );
}

function makePreviewCloneNonInteractive(clone: HTMLElement): boolean {
  clone.setAttribute('aria-hidden', 'true');
  clone.removeAttribute('contenteditable');
  clone.removeAttribute('tabindex');

  const interactiveCollection = collectAppliedPreviewElements(clone, isPreviewInteractiveElement);
  if (!interactiveCollection.complete) {
    return false;
  }

  interactiveCollection.elements.forEach((element) => {
    if (element.tagName === 'IFRAME' && element.hasAttribute('src')) {
      element.dataset.previewSrc = element.getAttribute('src') ?? '';
      element.removeAttribute('src');
    }
    element.removeAttribute('contenteditable');
    element.removeAttribute('tabindex');
  });

  return true;
}

export function addProseMirrorTrailingBreaks(
  previewDom: HTMLElement,
  doc: ProseMirrorNode,
  ownerDocument: Document,
  options: {
    maxDepth?: number;
    maxNodes?: number;
  } = {}
): void {
  addTrailingBreaksForChildren(previewDom, doc, ownerDocument, options);
}

function addTrailingBreaksForChildren(
  container: HTMLElement,
  parentNode: ProseMirrorNode,
  ownerDocument: Document,
  options: {
    maxDepth?: number;
    maxNodes?: number;
  } = {}
): void {
  const maxDepth = options.maxDepth ?? MAX_APPLIED_PREVIEW_TRAILING_BREAK_DEPTH;
  const maxNodes = options.maxNodes ?? MAX_APPLIED_PREVIEW_TRAILING_BREAK_NODES;
  let scanned = 0;
  const stack: Array<{
    container: HTMLElement;
    depth: number;
    index: number;
    node: ProseMirrorNode;
  }> = [{ container, depth: 0, index: 0, node: parentNode }];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.index >= frame.node.childCount) {
      stack.pop();
      continue;
    }
    if (
      scanned >= maxNodes ||
      frame.depth >= maxDepth
    ) {
      return;
    }

    const childIndex = frame.index;
    frame.index += 1;
    const node = frame.node.child(childIndex);
    const child = frame.container.children.item(childIndex);
    scanned += 1;

    if (!(child instanceof HTMLElement)) {
      continue;
    }

    if (node.isTextblock && node.content.size === 0) {
      if (!hasDirectProseMirrorTrailingBreak(child)) {
        const br = ownerDocument.createElement('br');
        br.className = 'ProseMirror-trailingBreak';
        child.appendChild(br);
      }
      continue;
    }

    if (node.childCount > 0) {
      stack.push({
        container: child,
        depth: frame.depth + 1,
        index: 0,
        node,
      });
    }
  }
}

function hasDirectProseMirrorTrailingBreak(element: HTMLElement): boolean {
  for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
    if (child.classList.contains('ProseMirror-trailingBreak')) return true;
  }
  return false;
}
