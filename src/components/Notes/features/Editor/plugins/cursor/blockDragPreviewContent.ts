import { getElectronBridge } from '@/lib/electron/bridge';
import { themeRenderingTokens } from '@/styles/themeTokens';
import {
  MAX_BLOCK_DRAG_PREVIEW_CAPTURE_CONCURRENCY,
  MAX_ORDERED_LIST_VALUE_CHARS,
  ORDERED_LIST_VALUE_PATTERN,
  PREVIEW_LAYER_CLASS,
  type CaptureJob,
  type PreviewItem,
} from './blockDragPreviewTypes';
import { collectBlockDragPreviewElements, sanitizeCloneTree } from './blockDragPreviewDom';

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

function collectPreviewBlocks(root: HTMLElement, className: string): HTMLElement[] | null {
  if (root.classList.contains(className)) {
    return [root];
  }

  const collection = collectBlockDragPreviewElements(
    root,
    (element) => element.classList.contains(className)
  );
  return collection.complete ? collection.elements : null;
}

function isVideoMediaElement(element: HTMLElement): boolean {
  return element instanceof HTMLIFrameElement || element instanceof HTMLVideoElement;
}

function replaceVideoMediaForPreview(
  sourceRoot: HTMLElement,
  cloneRoot: HTMLElement,
  captureJobs: CaptureJob[]
): boolean {
  const sourceBlocks = collectPreviewBlocks(sourceRoot, 'video-block');
  const cloneBlocks = collectPreviewBlocks(cloneRoot, 'video-block');
  if (!sourceBlocks || !cloneBlocks) return false;

  for (let index = 0; index < cloneBlocks.length; index += 1) {
    const videoBlock = cloneBlocks[index];
    if (!videoBlock) continue;

    const sourceBlock = sourceBlocks[index];
    const media = collectBlockDragPreviewElements(videoBlock, isVideoMediaElement);
    if (!media.complete) return false;

    media.elements.forEach((node, mediaIndex) => {
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
  }

  return true;
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

function replaceMermaidBlocksForPreview(
  sourceRoot: HTMLElement,
  cloneRoot: HTMLElement,
  captureJobs: CaptureJob[]
): HTMLElement | null {
  if (!getElectronBridge()?.media?.capturePage) {
    return cloneRoot;
  }

  if (sourceRoot.matches('.mermaid-block') && cloneRoot.matches('.mermaid-block')) {
    return createMermaidPreviewSurface(sourceRoot, cloneRoot.ownerDocument, captureJobs);
  }

  const sourceBlocks = collectPreviewBlocks(sourceRoot, 'mermaid-block');
  const cloneBlocks = collectPreviewBlocks(cloneRoot, 'mermaid-block');
  if (!sourceBlocks || !cloneBlocks) return null;

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

function parseOrderedListValue(value: string | null): number | null {
  if (value === null || value.length > MAX_ORDERED_LIST_VALUE_CHARS) return null;
  const trimmed = value.trim();
  if (!ORDERED_LIST_VALUE_PATTERN.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function resolveOrderedListItemValue(sourceItem: HTMLLIElement, parentList: HTMLOListElement): number {
  const explicitValue = parseOrderedListValue(sourceItem.getAttribute('value'));
  if (explicitValue !== null) return explicitValue;

  let value = parseOrderedListValue(parentList.getAttribute('start')) ?? 1;
  for (const child of parentList.children) {
    if (!(child instanceof HTMLLIElement)) continue;
    if (child === sourceItem) return value;

    const childExplicitValue = parseOrderedListValue(child.getAttribute('value'));
    if (childExplicitValue !== null) value = childExplicitValue;
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

  if (!sanitizeCloneTree(wrapper)) return cloneRoot;
  if (wrapper instanceof HTMLOListElement && parentList instanceof HTMLOListElement) {
    wrapper.start = resolveOrderedListItemValue(sourceRoot, parentList);
  }
  wrapper.appendChild(cloneRoot);
  return wrapper;
}

export function createContentLayer(doc: Document, items: readonly PreviewItem[], captureJobs: CaptureJob[]): HTMLElement {
  const layer = doc.createElement('div');
  layer.className = PREVIEW_LAYER_CLASS;
  layer.classList.add('milkdown');
  items.forEach(({ source, content }) => {
    const clone = content;
    if (!replaceVideoMediaForPreview(source, clone, captureJobs)) {
      return;
    }
    const stableMediaClone = replaceMermaidBlocksForPreview(source, clone, captureJobs);
    if (!stableMediaClone) {
      return;
    }
    layer.appendChild(wrapDetachedListItemForPreview(source, stableMediaClone));
  });
  return layer;
}

async function runCaptureJobs(captureJobs: readonly CaptureJob[]): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.min(MAX_BLOCK_DRAG_PREVIEW_CAPTURE_CONCURRENCY, captureJobs.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < captureJobs.length) {
      const job = captureJobs[nextIndex];
      nextIndex += 1;
      if (!job) continue;
      await captureElementPreview(job);
    }
  });
  await Promise.all(workers);
}

export function revealAfterVideoCaptures(preview: HTMLElement, captureJobs: readonly CaptureJob[]): void {
  if (captureJobs.length === 0) return;

  preview.style.visibility = themeRenderingTokens.visibilityHidden;
  void runCaptureJobs(captureJobs).finally(() => {
    if (!preview.isConnected) return;
    preview.style.visibility = '';
  });
}
