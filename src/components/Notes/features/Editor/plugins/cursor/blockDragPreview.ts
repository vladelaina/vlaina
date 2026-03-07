import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockRange } from './blockSelectionUtils';
import { resolveBlockElementAtPos } from './topLevelBlockDom';

const SOURCE_CLASS = 'neko-block-drag-source';
const PREVIEW_CLASS = 'neko-block-drag-preview';
const PREVIEW_LAYER_CLASS = 'neko-block-drag-preview-layer';
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

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function collectBlockElements(view: EditorView, ranges: readonly BlockRange[]): HTMLElement[] {
  const unique = new Set<HTMLElement>();
  const elements: HTMLElement[] = [];
  for (const range of ranges) {
    const element = resolveBlockElementAtPos(view, range.from);
    if (!element || unique.has(element)) continue;
    unique.add(element);
    elements.push(element);
  }
  return elements;
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

function createContentLayer(doc: Document, elements: readonly HTMLElement[]): HTMLElement {
  const layer = doc.createElement('div');
  layer.className = PREVIEW_LAYER_CLASS;
  layer.classList.add('milkdown');
  elements.forEach((source) => {
    const clone = source.cloneNode(true);
    if (!(clone instanceof HTMLElement)) return;
    sanitizeCloneTree(clone);
    layer.appendChild(clone);
  });
  return layer;
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
  preview.style.left = '-10000px';
  preview.style.top = '-10000px';

  copyCssVariables(view.dom as HTMLElement, preview);
  const scrollRoot = view.dom.closest('[data-note-scroll-root="true"]');
  if (scrollRoot instanceof HTMLElement) {
    copyCssVariables(scrollRoot, preview);
  }
  copyCssVariables(elements[0], preview);

  const contentLayer = createContentLayer(doc, elements);
  preview.appendChild(contentLayer);

  const viewportWidth = doc.defaultView?.innerWidth ?? 1600;
  const sourceWidth = Math.max(...elements.map((element) => element.getBoundingClientRect().width));
  const previewWidth = clamp(sourceWidth, MIN_PREVIEW_WIDTH, Math.max(MIN_PREVIEW_WIDTH, viewportWidth - 16));
  preview.style.width = `${Math.round(previewWidth)}px`;

  doc.body.appendChild(preview);

  const firstRect = elements[0].getBoundingClientRect();
  const previewRect = preview.getBoundingClientRect();
  const offsetX = clamp(clientX - firstRect.left, 10, Math.max(10, previewRect.width - 10));
  const offsetY = clamp(clientY - firstRect.top, 8, Math.max(8, previewRect.height - 8));

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
