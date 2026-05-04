import type { EditorView } from '@milkdown/kit/prose/view';
import { getElectronBridge } from '@/lib/electron/bridge';
import type { BlockRange } from './blockSelectionUtils';
import { resolveSelectableBlockTargetByPos } from './blockUnitResolver';

const SOURCE_CLASS = 'vlaina-block-drag-source';
const PREVIEW_CLASS = 'vlaina-block-drag-preview';
const PREVIEW_LAYER_CLASS = 'vlaina-block-drag-preview-layer';
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

function collectBlockElements(view: EditorView, ranges: readonly BlockRange[]): HTMLElement[] {
  const elements: HTMLElement[] = [];
  for (const range of ranges) {
    const target = resolveSelectableBlockTargetByPos(view, range.from);
    const element = target?.element;
    if (!element) continue;

    const existingAncestorIndex = elements.findIndex((existing) => existing.contains(element));
    if (existingAncestorIndex >= 0) continue;

    for (let index = elements.length - 1; index >= 0; index -= 1) {
      if (element.contains(elements[index])) {
        elements.splice(index, 1);
      }
    }

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

function captureElementPreview(element: HTMLElement, target: HTMLElement): Promise<boolean> {
  const media = getElectronBridge()?.media;
  if (!media?.capturePage) return Promise.resolve(false);

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
    image.className = 'video-drag-preview-image';
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
        captureJobs.push({ source: sourceBlock, target: placeholder });
      }
    });
  });
}

function createContentLayer(doc: Document, elements: readonly HTMLElement[], captureJobs: CaptureJob[]): HTMLElement {
  const layer = doc.createElement('div');
  layer.className = PREVIEW_LAYER_CLASS;
  layer.classList.add('milkdown');
  elements.forEach((source) => {
    const clone = source.cloneNode(true);
    if (!(clone instanceof HTMLElement)) return;
    sanitizeCloneTree(clone);
    replaceVideoMediaForPreview(source, clone, captureJobs);
    layer.appendChild(clone);
  });
  return layer;
}

function revealAfterVideoCaptures(preview: HTMLElement, captureJobs: readonly CaptureJob[]): void {
  if (captureJobs.length === 0) return;

  preview.style.visibility = 'hidden';
  void Promise.all(captureJobs.map((job) => captureElementPreview(job.source, job.target))).finally(() => {
    if (!preview.isConnected) return;
    preview.style.visibility = '';
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
  preview.style.left = '-10000px';
  preview.style.top = '-10000px';

  copyCssVariables(view.dom as HTMLElement, preview);
  const scrollRoot = view.dom.closest('[data-note-scroll-root="true"]');
  if (scrollRoot instanceof HTMLElement) {
    copyCssVariables(scrollRoot, preview);
  }
  copyCssVariables(elements[0], preview);

  const captureJobs: CaptureJob[] = [];
  const contentLayer = createContentLayer(doc, elements, captureJobs);
  preview.appendChild(contentLayer);

  const viewportWidth = doc.defaultView?.innerWidth ?? 1600;
  const sourceWidth = Math.max(...elements.map((element) => element.getBoundingClientRect().width));
  const previewWidth = clamp(sourceWidth, MIN_PREVIEW_WIDTH, Math.max(MIN_PREVIEW_WIDTH, viewportWidth - 16));
  preview.style.width = `${Math.round(previewWidth)}px`;

  doc.body.appendChild(preview);
  revealAfterVideoCaptures(preview, captureJobs);

  const firstRect = elements[0].getBoundingClientRect();
  const previewRect = preview.getBoundingClientRect();
  const offsetX = resolvePreviewOffsetX(clientX, firstRect.left, previewRect.width);
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
