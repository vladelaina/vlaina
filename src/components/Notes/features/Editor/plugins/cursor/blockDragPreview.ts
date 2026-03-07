import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockRange } from './blockSelectionUtils';
import { resolveTopLevelBlockElement } from './topLevelBlockDom';

const SOURCE_CLASS = 'neko-block-drag-source';
const PREVIEW_CLASS = 'neko-block-drag-preview';
const PREVIEW_ITEM_CLASS = 'neko-block-drag-preview-item';
const PREVIEW_MORE_CLASS = 'neko-block-drag-preview-more';
const MAX_PREVIEW_BLOCKS = 6;
const MIN_PREVIEW_WIDTH = 220;
const MAX_PREVIEW_WIDTH = 760;

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

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function collectBlockElements(view: EditorView, ranges: readonly BlockRange[]): HTMLElement[] {
  const unique = new Set<HTMLElement>();
  const elements: HTMLElement[] = [];
  for (const range of ranges) {
    const element = resolveTopLevelBlockElement(view, range.from);
    if (!element || unique.has(element)) continue;
    unique.add(element);
    elements.push(element);
  }
  return elements;
}

function sanitizeClone(element: HTMLElement): void {
  element.removeAttribute('id');
  element.setAttribute('contenteditable', 'false');
  element.removeAttribute('data-no-block-controls');
  element.removeAttribute('data-no-editor-drag-box');
  element.classList.remove('neko-block-selected', SOURCE_CLASS);
  const descendants = element.querySelectorAll<HTMLElement>('*');
  descendants.forEach((node) => {
    node.removeAttribute('id');
    node.removeAttribute('data-no-block-controls');
    node.removeAttribute('data-no-editor-drag-box');
    node.setAttribute('draggable', 'false');
    node.classList.remove('neko-block-selected', SOURCE_CLASS);
  });
}

export function createBlockDragPreview({
  view,
  ranges,
  clientX,
  clientY,
}: BlockDragPreviewOptions): BlockDragPreviewHandle | null {
  const elements = collectBlockElements(view, ranges);
  if (elements.length === 0) return null;

  const doc = view.dom.ownerDocument;
  const preview = doc.createElement('div');
  preview.className = PREVIEW_CLASS;
  preview.setAttribute('aria-hidden', 'true');
  preview.setAttribute('data-no-editor-drag-box', 'true');

  const visibleElements = elements.slice(0, MAX_PREVIEW_BLOCKS);
  visibleElements.forEach((source) => {
    const item = doc.createElement('div');
    item.className = PREVIEW_ITEM_CLASS;
    const clone = source.cloneNode(true);
    if (clone instanceof HTMLElement) {
      sanitizeClone(clone);
      item.appendChild(clone);
      preview.appendChild(item);
    }
  });

  if (elements.length > MAX_PREVIEW_BLOCKS) {
    const more = doc.createElement('div');
    more.className = PREVIEW_MORE_CLASS;
    more.textContent = `+${elements.length - MAX_PREVIEW_BLOCKS} blocks`;
    preview.appendChild(more);
  }

  const viewportWidth = doc.defaultView?.innerWidth ?? 1200;
  const sourceWidth = Math.max(...elements.map((element) => element.getBoundingClientRect().width));
  const previewWidth = clamp(sourceWidth, MIN_PREVIEW_WIDTH, Math.min(MAX_PREVIEW_WIDTH, viewportWidth - 24));
  preview.style.width = `${Math.round(previewWidth)}px`;
  preview.style.left = '-10000px';
  preview.style.top = '-10000px';

  doc.body.appendChild(preview);

  const firstRect = elements[0].getBoundingClientRect();
  const previewRect = preview.getBoundingClientRect();
  const offsetX = clamp(clientX - firstRect.left, 18, Math.max(18, previewRect.width - 18));
  const offsetY = clamp(clientY - firstRect.top, 12, Math.max(12, previewRect.height - 12));

  elements.forEach((element) => element.classList.add(SOURCE_CLASS));

  const destroy = () => {
    elements.forEach((element) => element.classList.remove(SOURCE_CLASS));
    preview.remove();
  };

  return {
    element: preview,
    offsetX: Math.round(offsetX),
    offsetY: Math.round(offsetY),
    destroy,
  };
}
