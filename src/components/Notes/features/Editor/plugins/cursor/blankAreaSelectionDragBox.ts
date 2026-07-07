import { themeDomStyleTokens, themeRenderingTokens, themeStyleResetTokens } from '@/styles/themeTokens';
import type { RectBounds } from './blockSelectionUtils';

const DRAG_SELECTION_POINTER_EDGE_HIT_SLOP_PX = 8;
const GEOMETRY_RESIZE_TOLERANCE_PX = 1;

export function createDragBox(doc: Document, dragBoxColor: string): HTMLDivElement {
  const box = doc.createElement('div');
  box.setAttribute('data-editor-drag-box', 'true');
  box.style.position = themeDomStyleTokens.positionFixed;
  box.style.pointerEvents = themeStyleResetTokens.pointerEventsNone;
  box.style.zIndex = themeDomStyleTokens.zIndexMax;
  box.style.border = themeDomStyleTokens.borderNone;
  box.style.background = dragBoxColor;
  box.style.borderRadius = themeStyleResetTokens.borderRadiusNone;
  box.style.left = themeDomStyleTokens.sizeZeroPx;
  box.style.top = themeDomStyleTokens.sizeZeroPx;
  box.style.transform = themeRenderingTokens.translate3dZeroPx;
  box.style.transformOrigin = `${themeDomStyleTokens.sizeZero} ${themeDomStyleTokens.sizeZero}`;
  box.style.willChange = themeRenderingTokens.transformSizeWillChange;
  box.style.contain = themeRenderingTokens.containLayoutPaintStyle;
  box.style.width = themeDomStyleTokens.sizeZeroPx;
  box.style.height = themeDomStyleTokens.sizeZeroPx;
  return box;
}

export function updateDragBox(box: HTMLDivElement, rect: RectBounds): void {
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;

  box.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
  box.style.width = `${width}px`;
  box.style.height = `${height}px`;
}

export function areRectBoundsEqual(left: RectBounds | null, right: RectBounds | null): boolean {
  return left !== null
    && right !== null
    && left.left === right.left
    && left.top === right.top
    && left.right === right.right
    && left.bottom === right.bottom;
}

export function getDragBoxTopBoundary(scrollRoot: HTMLElement | null): number {
  return scrollRoot?.getBoundingClientRect().top ?? 0;
}

export function resolveDragPointerY(startY: number, rect: RectBounds): number {
  return startY === rect.top ? rect.bottom : rect.top;
}

export function expandDragRectPointerEdgeY(
  rect: RectBounds,
  startY: number,
  slopPx = DRAG_SELECTION_POINTER_EDGE_HIT_SLOP_PX,
): RectBounds {
  if (slopPx <= 0) return rect;
  if (startY === rect.top) {
    return {
      ...rect,
      bottom: rect.bottom + slopPx,
    };
  }
  if (startY === rect.bottom) {
    return {
      ...rect,
      top: rect.top - slopPx,
    };
  }
  return rect;
}

export function hasMeaningfulResizeDelta(
  previous: { width: number; height: number } | undefined,
  next: { width: number; height: number },
): boolean {
  if (!previous) return true;
  return (
    Math.abs(previous.width - next.width) > GEOMETRY_RESIZE_TOLERANCE_PX ||
    Math.abs(previous.height - next.height) > GEOMETRY_RESIZE_TOLERANCE_PX
  );
}

export function blurActiveEditableElement(doc: Document): void {
  const activeElement = doc.activeElement;
  if (!(activeElement instanceof HTMLElement) || activeElement === doc.body) return;
  if (!activeElement.matches([
    'input',
    'textarea',
    'select',
    'button',
    '[contenteditable]:not([contenteditable="false"])',
  ].join(', '))) return;

  activeElement.blur();
}
