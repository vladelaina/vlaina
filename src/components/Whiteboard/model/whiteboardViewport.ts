import { themeWhiteboardTokens } from '@/styles/themeTokens';
import type { WhiteboardElement, WhiteboardPoint, WhiteboardStroke, WhiteboardViewport } from './whiteboardModel';
import { getStrokeBounds, type WhiteboardSelectionRect } from './whiteboardSelection';
import { WHITEBOARD_INITIAL_VIEWPORT, clampWhiteboardZoom } from './whiteboardModel';

export function fitViewportToContent(
  elements: WhiteboardElement[],
  strokes: WhiteboardStroke[],
  viewportSize: WhiteboardPoint,
): WhiteboardViewport {
  const bounds = getContentBounds(elements, strokes);
  if (!bounds) return WHITEBOARD_INITIAL_VIEWPORT;
  const zoom = clampWhiteboardZoom(Math.min(
    viewportSize.x / Math.max(1, bounds.width + themeWhiteboardTokens.fitViewPaddingPx * 2),
    viewportSize.y / Math.max(1, bounds.height + themeWhiteboardTokens.fitViewPaddingPx * 2),
  ));
  return {
    x: Math.round((viewportSize.x - bounds.width * zoom) / 2 - bounds.x * zoom),
    y: Math.round((viewportSize.y - bounds.height * zoom) / 2 - bounds.y * zoom),
    zoom,
  };
}

export function getVisibleBoardRect(
  viewport: WhiteboardViewport,
  viewportSize: WhiteboardPoint,
): WhiteboardSelectionRect | null {
  if (viewportSize.x <= 0 || viewportSize.y <= 0) return null;
  const overscan = themeWhiteboardTokens.viewportCullingOverscanPx / viewport.zoom;
  return {
    height: viewportSize.y / viewport.zoom + overscan * 2,
    width: viewportSize.x / viewport.zoom + overscan * 2,
    x: -viewport.x / viewport.zoom - overscan,
    y: -viewport.y / viewport.zoom - overscan,
  };
}

function getContentBounds(elements: WhiteboardElement[], strokes: WhiteboardStroke[]): WhiteboardSelectionRect | null {
  const elementBounds = elements.map((element) => ({
    height: element.height,
    width: element.width,
    x: element.x,
    y: element.y,
  }));
  const strokeBounds = strokes.flatMap((stroke) => {
    const bounds = getStrokeBounds(stroke);
    return bounds ? [bounds] : [];
  });
  const bounds = [...elementBounds, ...strokeBounds];
  if (bounds.length === 0) return null;
  const minX = Math.min(...bounds.map((item) => item.x));
  const minY = Math.min(...bounds.map((item) => item.y));
  const maxX = Math.max(...bounds.map((item) => item.x + item.width));
  const maxY = Math.max(...bounds.map((item) => item.y + item.height));
  return { height: maxY - minY, width: maxX - minX, x: minX, y: minY };
}
