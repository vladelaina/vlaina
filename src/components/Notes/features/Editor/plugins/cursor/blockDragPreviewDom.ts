import {
  MAX_BLOCK_DRAG_PREVIEW_DOM_SCAN_ELEMENTS,
  MAX_BLOCK_DRAG_PREVIEW_MATCHED_ELEMENTS,
  MAX_PREVIEW_POINTER_OFFSET_Y,
  type BlockDragPreviewElementCollection,
} from './blockDragPreviewTypes';

export function collectBlockDragPreviewElements(
  root: HTMLElement,
  matches: (element: HTMLElement) => boolean,
  options: {
    includeRoot?: boolean;
    maxScanned?: number;
    maxMatches?: number;
  } = {},
): BlockDragPreviewElementCollection {
  const maxScanned = options.maxScanned ?? MAX_BLOCK_DRAG_PREVIEW_DOM_SCAN_ELEMENTS;
  const maxMatches = options.maxMatches ?? MAX_BLOCK_DRAG_PREVIEW_MATCHED_ELEMENTS;
  const elements: HTMLElement[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, 1);
  let scanned = 0;

  const visit = (element: HTMLElement): boolean => {
    scanned += 1;
    if (scanned > maxScanned) {
      return false;
    }

    if (!matches(element)) {
      return true;
    }

    elements.push(element);
    return elements.length <= maxMatches;
  };

  if (options.includeRoot && !visit(root)) {
    return { elements: [], complete: false };
  }

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }

    if (!visit(node)) {
      return { elements: [], complete: false };
    }
  }

  return { elements, complete: true };
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function resolvePreviewOffsetX(clientX: number, sourceLeft: number, previewWidth: number): number {
  const rawOffsetX = clientX - sourceLeft;
  const maxOffsetX = Math.max(10, previewWidth - 10);
  return Math.min(rawOffsetX, maxOffsetX);
}

export function resolvePreviewOffsetY(clientY: number, sourceTop: number, previewHeight: number): number {
  const rawOffsetY = clientY - sourceTop;
  const maxVisibleOffsetY = Math.max(8, Math.min(previewHeight - 8, MAX_PREVIEW_POINTER_OFFSET_Y));
  return clamp(rawOffsetY, 8, maxVisibleOffsetY);
}

export function copyCssVariables(from: HTMLElement, to: HTMLElement): void {
  const computed = window.getComputedStyle(from);
  for (let i = 0; i < computed.length; i += 1) {
    const name = computed.item(i);
    if (!name.startsWith('--')) continue;
    const value = computed.getPropertyValue(name);
    if (!value) continue;
    to.style.setProperty(name, value);
  }
}

export function sanitizeCloneTree(root: HTMLElement): boolean {
  root.setAttribute('contenteditable', 'false');
  root.setAttribute('draggable', 'false');
  root.removeAttribute('data-no-block-controls');
  root.removeAttribute('data-no-editor-drag-box');

  if (root.hasAttribute('id')) root.removeAttribute('id');
  const descendants = collectBlockDragPreviewElements(root, () => true);
  if (!descendants.complete) return false;

  descendants.elements.forEach((node) => {
    if (node.hasAttribute('id')) node.removeAttribute('id');
    node.removeAttribute('data-no-block-controls');
    node.removeAttribute('data-no-editor-drag-box');
    node.setAttribute('draggable', 'false');
    if (node.tabIndex >= 0) node.tabIndex = -1;
  });
  return true;
}
