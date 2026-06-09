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
    (element) => element.classList.contains('image-block-container')
  );
  if (!sourceImageCollection.complete) {
    return;
  }

  const { elements: sourceImages } = sourceImageCollection;
  if (sourceImages.length === 0) {
    return;
  }

  const previewImageCollection = collectAppliedPreviewElements(
    previewDom,
    (element) => element.tagName === 'IMG'
  );
  if (!previewImageCollection.complete || previewImageCollection.elements.length !== sourceImages.length) {
    return;
  }
  const { elements: previewImages } = previewImageCollection;

  previewImages.forEach((previewImage, index) => {
    const sourceImage = sourceImages[index];
    if (!sourceImage) {
      return;
    }

    const clone = sourceImage.cloneNode(true) as HTMLElement;
    if (!makePreviewCloneNonInteractive(clone)) {
      return;
    }
    previewImage.replaceWith(clone);
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

function addProseMirrorTrailingBreaks(
  previewDom: HTMLElement,
  doc: ProseMirrorNode,
  ownerDocument: Document
): void {
  addTrailingBreaksForChildren(previewDom, doc, ownerDocument);
}

function addTrailingBreaksForChildren(
  container: HTMLElement,
  parentNode: ProseMirrorNode,
  ownerDocument: Document
): void {
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
      scanned >= MAX_APPLIED_PREVIEW_TRAILING_BREAK_NODES ||
      frame.depth >= MAX_APPLIED_PREVIEW_TRAILING_BREAK_DEPTH
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
      if (!child.querySelector(':scope > .ProseMirror-trailingBreak')) {
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
