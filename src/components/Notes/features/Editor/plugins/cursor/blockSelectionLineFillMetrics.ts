import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockRange, RectBounds } from './blockSelectionUtils';
import {
  FALLBACK_BLOCK_SELECTION_BLEED_X_PX,
  FALLBACK_BLOCK_SELECTION_BLEED_Y_PX,
  LINE_FILL_VIEWPORT_OVERSCAN_PX,
  type LineFillEdges,
} from './blockSelectionLineFillConstants';

function isRangeIntersecting(left: BlockRange, right: BlockRange): boolean {
  return left.to > right.from && left.from < right.to;
}

function readCssPx(style: CSSStyleDeclaration, property: string, fallback = 0): number {
  const value = Number.parseFloat(style.getPropertyValue(property));
  return Number.isFinite(value) ? value : fallback;
}

export function resolveBlockSelectionBleedXEnd(element: HTMLElement): number {
  const selectedElement = element.classList.contains('editor-block-selected')
    ? element
    : element.querySelector<HTMLElement>('.editor-block-selected') ?? element;
  return readCssPx(
    window.getComputedStyle(selectedElement),
    '--vlaina-block-selection-bleed-x-end',
    FALLBACK_BLOCK_SELECTION_BLEED_X_PX
  );
}

export function resolveBlockSelectionBleedXStart(element: HTMLElement): number {
  const selectedElement = element.classList.contains('editor-block-selected')
    ? element
    : element.querySelector<HTMLElement>('.editor-block-selected') ?? element;
  return readCssPx(
    window.getComputedStyle(selectedElement),
    '--vlaina-block-selection-bleed-x-start',
    FALLBACK_BLOCK_SELECTION_BLEED_X_PX
  );
}

function resolveSelectedElementForBlockSelectionMetrics(element: HTMLElement): HTMLElement {
  return element.classList.contains('editor-block-selected')
    ? element
    : element.querySelector<HTMLElement>('.editor-block-selected') ?? element;
}

export function resolveLineFillEdges(element: HTMLElement): LineFillEdges {
  const selectedElement = resolveSelectedElementForBlockSelectionMetrics(element);
  const style = window.getComputedStyle(selectedElement);
  const bleedY = readCssPx(
    style,
    '--vlaina-block-selection-bleed-y',
    FALLBACK_BLOCK_SELECTION_BLEED_Y_PX,
  );

  return {
    top: -bleedY,
    bottom: -bleedY,
  };
}

export function resolveLineFillLeft(paragraph: HTMLElement, paragraphRect = paragraph.getBoundingClientRect()): number {
  return paragraphRect.left - resolveBlockSelectionBleedXStart(paragraph);
}

export function resolveLineFillRight(
  view: EditorView,
  paragraph: HTMLElement,
  paragraphRect = paragraph.getBoundingClientRect(),
): number {
  const editorRect = view.dom.getBoundingClientRect();
  const selectedBlockRight = editorRect.width > 0 ? editorRect.right : paragraphRect.right;
  return Math.max(paragraphRect.right, selectedBlockRight) + resolveBlockSelectionBleedXEnd(paragraph);
}

export function resolveLineFillViewportRect(view: EditorView): RectBounds | null {
  const scrollRoot = view.dom.closest<HTMLElement>('[data-note-scroll-root="true"]');
  const viewportElement = scrollRoot ?? view.dom.ownerDocument.documentElement;
  const rect = viewportElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    left: rect.left - LINE_FILL_VIEWPORT_OVERSCAN_PX,
    top: rect.top - LINE_FILL_VIEWPORT_OVERSCAN_PX,
    right: rect.right + LINE_FILL_VIEWPORT_OVERSCAN_PX,
    bottom: rect.bottom + LINE_FILL_VIEWPORT_OVERSCAN_PX,
  };
}

export function isRectNearViewport(rect: RectBounds, viewportRect: RectBounds | null): boolean {
  if (!viewportRect) return true;
  return isRangeIntersecting(
    { from: rect.top, to: rect.bottom },
    { from: viewportRect.top, to: viewportRect.bottom },
  );
}

export function resolveParagraphElement(view: EditorView, range: BlockRange): HTMLElement | null {
  try {
    const domAtPos = view.domAtPos(range.from);
    const base = domAtPos.node instanceof HTMLElement ? domAtPos.node : domAtPos.node.parentElement;
    const paragraph = base?.closest('p') ?? null;
    return paragraph instanceof HTMLElement && view.dom.contains(paragraph) ? paragraph : null;
  } catch {
    return null;
  }
}
