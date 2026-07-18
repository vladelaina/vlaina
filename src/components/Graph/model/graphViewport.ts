import { themeGraphTokens } from '@/styles/themeTokens';

export interface GraphPoint {
  x: number;
  y: number;
}

export interface GraphViewport extends GraphPoint {
  zoom: number;
}

export const GRAPH_INITIAL_VIEWPORT: GraphViewport = {
  x: 0,
  y: 0,
  zoom: themeGraphTokens.defaultZoom,
};

export function clampGraphZoom(zoom: number): number {
  return Math.min(themeGraphTokens.maxZoom, Math.max(themeGraphTokens.minZoom, zoom));
}

export function clientPointToGraphPoint(
  clientPoint: GraphPoint,
  viewportRect: Pick<DOMRectReadOnly, 'left' | 'top'>,
  viewport: GraphViewport,
): GraphPoint {
  return {
    x: (clientPoint.x - viewportRect.left - viewport.x) / viewport.zoom,
    y: (clientPoint.y - viewportRect.top - viewport.y) / viewport.zoom,
  };
}

export function zoomGraphViewportAtPoint(
  viewport: GraphViewport,
  screenPoint: GraphPoint,
  nextZoom: number,
): GraphViewport {
  const zoom = clampGraphZoom(nextZoom);
  const graphPoint = {
    x: (screenPoint.x - viewport.x) / viewport.zoom,
    y: (screenPoint.y - viewport.y) / viewport.zoom,
  };
  return {
    x: screenPoint.x - graphPoint.x * zoom,
    y: screenPoint.y - graphPoint.y * zoom,
    zoom,
  };
}

export function fitGraphViewportToNodes(
  nodes: readonly GraphPoint[],
  viewportSize: GraphPoint,
): GraphViewport {
  if (nodes.length === 0 || viewportSize.x <= 0 || viewportSize.y <= 0) {
    return GRAPH_INITIAL_VIEWPORT;
  }

  const radius = themeGraphTokens.activeNodeRadiusPx;
  const minX = Math.min(...nodes.map((node) => node.x)) - radius;
  const minY = Math.min(...nodes.map((node) => node.y)) - radius;
  const maxX = Math.max(...nodes.map((node) => node.x)) + radius;
  const maxY = Math.max(...nodes.map((node) => node.y)) + radius;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const availableWidth = Math.max(1, viewportSize.x - themeGraphTokens.fitViewPaddingPx * 2);
  const availableHeight = Math.max(1, viewportSize.y - themeGraphTokens.fitViewPaddingPx * 2);
  const zoom = clampGraphZoom(Math.min(
    themeGraphTokens.defaultZoom,
    availableWidth / width,
    availableHeight / height,
  ));

  return {
    x: (viewportSize.x - width * zoom) / 2 - minX * zoom,
    y: (viewportSize.y - height * zoom) / 2 - minY * zoom,
    zoom,
  };
}
