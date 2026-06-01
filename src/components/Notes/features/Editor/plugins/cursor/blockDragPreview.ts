import type { EditorView } from '@milkdown/kit/prose/view';
import { getElectronBridge } from '@/lib/electron/bridge';
import type { BlockRange } from './blockSelectionUtils';
import {
  isInlineSelectableBlockRange,
  resolveSelectableBlockTargetByPos,
} from './blockUnitResolver';
import { themeOffscreenTokens, themeRenderingTokens } from '@/styles/themeTokens';

const SOURCE_CLASS = 'editor-block-drag-source';
const PREVIEW_CLASS = 'editor-block-drag-preview';
const PREVIEW_LAYER_CLASS = 'editor-block-drag-preview-layer';
const MIN_PREVIEW_WIDTH = 80;

interface BlockDragPreviewOptions {
  view: EditorView;
  ranges: readonly BlockRange[];
  clientX: number;
  clientY: number;
}

export interface BlockDragPreviewHandle {
  element: HTMLElement;
  offsetX: number;
  offsetY: number;
  destroy: () => void;
}

interface CaptureJob {
  source: HTMLElement;
  target: HTMLElement;
  imageClassName: string;
}

interface PreviewItem {
  source: HTMLElement;
  sourceClassElement: HTMLElement | null;
  rect: DOMRect;
  content: HTMLElement;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function resolvePreviewOffsetX(clientX: number, sourceLeft: number, previewWidth: number): number {
  const rawOffsetX = clientX - sourceLeft;
  const maxOffsetX = Math.max(10, previewWidth - 10);
  return Math.min(rawOffsetX, maxOffsetX);
}

function createInlineRangePreviewContent(
  view: EditorView,
  range: BlockRange,
  source: HTMLElement,
): HTMLElement | null {
  const doc = view.dom.ownerDocument;
  const domRange = doc.createRange();

  try {
    const start = view.domAtPos(range.from);
    const end = view.domAtPos(range.to);
    domRange.setStart(start.node, start.offset);
    domRange.setEnd(end.node, end.offset);

    const content = source.cloneNode(false);
    if (!(content instanceof HTMLElement)) return null;
    content.appendChild(domRange.cloneContents());
    sanitizeCloneTree(content);
    return content;
  } catch {
    return null;
  } finally {
    domRange.detach();
  }
}

function collectPreviewItems(view: EditorView, ranges: readonly BlockRange[]): PreviewItem[] {
  const items: PreviewItem[] = [];
  for (const range of ranges) {
    const target = resolveSelectableBlockTargetByPos(view, range.from);
    if (!target) continue;
    const element = target?.subElement ?? target?.element;
    if (!element) continue;

    if (isInlineSelectableBlockRange(view.state.doc, range)) {
      const content = createInlineRangePreviewContent(view, range, element);
      if (!content) continue;
      items.push({
        source: element,
        sourceClassElement: null,
        rect: target.rect,
        content,
      });
      continue;
    }

    const existingAncestorIndex = items.findIndex((existing) => (
      existing.sourceClassElement !== null && existing.sourceClassElement.contains(element)
    ));
    if (existingAncestorIndex >= 0) continue;

    for (let index = items.length - 1; index >= 0; index -= 1) {
      const existingElement = items[index].sourceClassElement;
      if (existingElement !== null && element.contains(existingElement)) {
        items.splice(index, 1);
      }
    }

    const clone = element.cloneNode(true);
    if (!(clone instanceof HTMLElement)) continue;
    sanitizeCloneTree(clone);

    items.push({
      source: element,
      sourceClassElement: element,
      rect: element.getBoundingClientRect(),
      content: clone,
    });
  }
  return items;
}

function copyCssVariables(from: HTMLElement, to: HTMLElement): void {
  const computed = window.getComputedStyle(from);
  for (let i = 0; i < computed.length; i += 1) {
    const name = computed.item(i);
    if (!name.startsWith('--')) continue;
    const value = computed.getPropertyValue(name);
    if (!value) continue;
    to.style.setProperty(name, value);
  }
}

function sanitizeCloneTree(root: HTMLElement): void {
  root.setAttribute('contenteditable', 'false');
  root.setAttribute('draggable', 'false');
  root.removeAttribute('data-no-block-controls');
  root.removeAttribute('data-no-editor-drag-box');

  if (root.hasAttribute('id')) root.removeAttribute('id');
  const descendants = root.querySelectorAll<HTMLElement>('*');
  descendants.forEach((node) => {
    if (node.hasAttribute('id')) node.removeAttribute('id');
    node.removeAttribute('data-no-block-controls');
    node.removeAttribute('data-no-editor-drag-box');
    node.setAttribute('draggable', 'false');
    if (node.tabIndex >= 0) node.tabIndex = -1;
  });
}

function captureElementPreview(job: CaptureJob): Promise<boolean> {
  const media = getElectronBridge()?.media;
  if (!media?.capturePage) return Promise.resolve(false);

  const { source: element, target, imageClassName } = job;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return Promise.resolve(false);

  return media.capturePage({
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  }).then((dataUrl) => {
    if (!dataUrl || !target.isConnected) return false;
    const image = target.ownerDocument.createElement('img');
    image.className = imageClassName;
    image.alt = '';
    image.draggable = false;
    image.src = dataUrl;
    target.replaceChildren(image);
    return true;
  }).catch(() => {
    return false;
  });
}

function replaceVideoMediaForPreview(sourceRoot: HTMLElement, cloneRoot: HTMLElement, captureJobs: CaptureJob[]): void {
  const sourceBlocks = sourceRoot.matches('.video-block')
    ? [sourceRoot]
    : Array.from(sourceRoot.querySelectorAll<HTMLElement>('.video-block'));
  const cloneBlocks = cloneRoot.matches('.video-block')
    ? [cloneRoot]
    : Array.from(cloneRoot.querySelectorAll<HTMLElement>('.video-block'));

  cloneBlocks.forEach((videoBlock, index) => {
    const sourceBlock = sourceBlocks[index];
    const media = videoBlock.querySelectorAll('iframe, video');
    media.forEach((node, mediaIndex) => {
      const placeholder = cloneRoot.ownerDocument.createElement('div');
      placeholder.className = 'video-drag-preview-surface';
      placeholder.setAttribute('aria-hidden', 'true');
      node.replaceWith(placeholder);
      if (mediaIndex === 0 && sourceBlock) {
        captureJobs.push({
          source: sourceBlock,
          target: placeholder,
          imageClassName: 'video-drag-preview-image',
        });
      }
    });
  });
}

function createMermaidPreviewSurface(sourceBlock: HTMLElement, doc: Document, captureJobs: CaptureJob[]) {
  const placeholder = doc.createElement('div');
  placeholder.className = 'mermaid-drag-preview-surface';
  placeholder.setAttribute('aria-hidden', 'true');
  captureJobs.push({
    source: sourceBlock,
    target: placeholder,
    imageClassName: 'mermaid-drag-preview-image',
  });
  return placeholder;
}

function replaceMermaidBlocksForPreview(sourceRoot: HTMLElement, cloneRoot: HTMLElement, captureJobs: CaptureJob[]): HTMLElement {
  if (!getElectronBridge()?.media?.capturePage) {
    return cloneRoot;
  }

  if (sourceRoot.matches('.mermaid-block') && cloneRoot.matches('.mermaid-block')) {
    return createMermaidPreviewSurface(sourceRoot, cloneRoot.ownerDocument, captureJobs);
  }

  const sourceBlocks = Array.from(sourceRoot.querySelectorAll<HTMLElement>('.mermaid-block'));
  const cloneBlocks = Array.from(cloneRoot.querySelectorAll<HTMLElement>('.mermaid-block'));
  cloneBlocks.forEach((mermaidBlock, index) => {
    const sourceBlock = sourceBlocks[index];
    if (!sourceBlock) return;
    mermaidBlock.replaceWith(
      createMermaidPreviewSurface(sourceBlock, cloneRoot.ownerDocument, captureJobs)
    );
  });

  return cloneRoot;
}

function isListContainerElement(element: Node | null): element is HTMLOListElement | HTMLUListElement {
  return element instanceof HTMLOListElement || element instanceof HTMLUListElement;
}

function resolveOrderedListItemValue(sourceItem: HTMLLIElement, parentList: HTMLOListElement): number {
  const explicitValue = sourceItem.getAttribute('value');
  if (explicitValue !== null) {
    const parsed = Number.parseInt(explicitValue, 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  let value = parentList.hasAttribute('start') ? parentList.start : 1;
  for (const child of parentList.children) {
    if (!(child instanceof HTMLLIElement)) continue;
    if (child === sourceItem) return value;

    const childExplicitValue = child.getAttribute('value');
    if (childExplicitValue !== null) {
      const parsed = Number.parseInt(childExplicitValue, 10);
      if (Number.isFinite(parsed)) {
        value = parsed;
      }
    }
    value += 1;
  }
  return value;
}

function wrapDetachedListItemForPreview(sourceRoot: HTMLElement, cloneRoot: HTMLElement): HTMLElement {
  if (!(sourceRoot instanceof HTMLLIElement) || !(cloneRoot instanceof HTMLLIElement)) {
    return cloneRoot;
  }

  const parentList = sourceRoot.parentElement;
  if (!isListContainerElement(parentList)) return cloneRoot;

  const wrapper = parentList.cloneNode(false);
  if (!isListContainerElement(wrapper)) return cloneRoot;

  sanitizeCloneTree(wrapper);
  if (wrapper instanceof HTMLOListElement && parentList instanceof HTMLOListElement) {
    wrapper.start = resolveOrderedListItemValue(sourceRoot, parentList);
  }
  wrapper.appendChild(cloneRoot);
  return wrapper;
}

function createContentLayer(doc: Document, items: readonly PreviewItem[], captureJobs: CaptureJob[]): HTMLElement {
  const layer = doc.createElement('div');
  layer.className = PREVIEW_LAYER_CLASS;
  layer.classList.add('milkdown');
  items.forEach(({ source, content }) => {
    const clone = content;
    replaceVideoMediaForPreview(source, clone, captureJobs);
    const stableMediaClone = replaceMermaidBlocksForPreview(source, clone, captureJobs);
    layer.appendChild(wrapDetachedListItemForPreview(source, stableMediaClone));
  });
  return layer;
}

function revealAfterVideoCaptures(preview: HTMLElement, captureJobs: readonly CaptureJob[]): void {
  if (captureJobs.length === 0) return;

  preview.style.visibility = themeRenderingTokens.visibilityHidden;
  void Promise.all(captureJobs.map((job) => captureElementPreview(job))).finally(() => {
    if (!preview.isConnected) return;
    preview.style.visibility = '';
  });
}

function resolvePreviewSourceWidth(view: EditorView, items: readonly PreviewItem[]): number {
  const sourceWidth = Math.max(...items.map((item) => item.rect.width));
  if (items.every((item) => item.sourceClassElement === null)) {
    return sourceWidth;
  }

  const editorWidth = view.dom.getBoundingClientRect().width;
  return Math.max(sourceWidth, editorWidth);
}

export function createBlockDragPreview({
  view,
  ranges,
  clientX,
  clientY,
}: BlockDragPreviewOptions): BlockDragPreviewHandle | null {
  const items = collectPreviewItems(view, ranges);
  if (items.length === 0) return null;

  const doc = view.dom.ownerDocument;
  const preview = doc.createElement('div');
  preview.className = PREVIEW_CLASS;
  preview.setAttribute('aria-hidden', 'true');
  preview.setAttribute('data-no-editor-drag-box', 'true');
  preview.style.left = themeOffscreenTokens.blockDragPreviewLeft;
  preview.style.top = themeOffscreenTokens.blockDragPreviewTop;

  copyCssVariables(view.dom as HTMLElement, preview);
  const scrollRoot = view.dom.closest('[data-note-scroll-root="true"]');
  if (scrollRoot instanceof HTMLElement) {
    copyCssVariables(scrollRoot, preview);
  }
  copyCssVariables(items[0].source, preview);

  const captureJobs: CaptureJob[] = [];
  const contentLayer = createContentLayer(doc, items, captureJobs);
  preview.appendChild(contentLayer);

  const viewportWidth = doc.defaultView?.innerWidth ?? 1600;
  const sourceWidth = resolvePreviewSourceWidth(view, items);
  const previewWidth = clamp(sourceWidth, MIN_PREVIEW_WIDTH, Math.max(MIN_PREVIEW_WIDTH, viewportWidth - 16));
  preview.style.width = `${Math.round(previewWidth)}px`;

  doc.body.appendChild(preview);
  revealAfterVideoCaptures(preview, captureJobs);

  const firstRect = items[0].rect;
  const previewRect = preview.getBoundingClientRect();
  const offsetX = resolvePreviewOffsetX(clientX, firstRect.left, previewRect.width);
  const offsetY = clamp(clientY - firstRect.top, 8, Math.max(8, previewRect.height - 8));

  const sourceClassElements = items
    .map((item) => item.sourceClassElement)
    .filter((element): element is HTMLElement => element !== null);
  sourceClassElements.forEach((element) => element.classList.add(SOURCE_CLASS));

  const destroy = () => {
    sourceClassElements.forEach((element) => element.classList.remove(SOURCE_CLASS));
    preview.remove();
  };

  return {
    element: preview,
    offsetX: Math.round(offsetX),
    offsetY: Math.round(offsetY),
    destroy,
  };
}
