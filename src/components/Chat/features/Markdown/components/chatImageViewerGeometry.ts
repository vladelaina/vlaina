import { themeChatImageViewerTokens } from "@/styles/themeTokens";

export const MIN_ZOOM = themeChatImageViewerTokens.minZoom;
export const MAX_ZOOM = themeChatImageViewerTokens.maxZoom;
export const ZOOM_STEP = themeChatImageViewerTokens.zoomStep;

export type ViewerPoint = { x: number; y: number };
export type ViewerSize = { width: number; height: number };

export function clampZoom(value: number): number {
  if (value < MIN_ZOOM) {
    return MIN_ZOOM;
  }
  if (value > MAX_ZOOM) {
    return MAX_ZOOM;
  }
  return Number(value.toFixed(2));
}

export function getViewerFitBounds(viewportSize: { width: number; height: number }) {
  const horizontalPadding = viewportSize.width < themeChatImageViewerTokens.fitPaddingBreakpointPx
    ? themeChatImageViewerTokens.fitHorizontalPaddingCompactPx
    : themeChatImageViewerTokens.fitHorizontalPaddingWidePx;
  const verticalPadding = viewportSize.height < themeChatImageViewerTokens.fitPaddingBreakpointPx
    ? themeChatImageViewerTokens.fitVerticalPaddingCompactPx
    : themeChatImageViewerTokens.fitVerticalPaddingWidePx;
  return {
    maxWidth: Math.max(themeChatImageViewerTokens.minViewportSizePx, viewportSize.width - horizontalPadding),
    maxHeight: Math.max(themeChatImageViewerTokens.minViewportSizePx, viewportSize.height - verticalPadding),
  };
}

export function resolveInitialViewerZoom({
  mediaHeight,
  mediaWidth,
  naturalHeight,
  naturalWidth,
  viewportSize,
}: {
  mediaHeight: number;
  mediaWidth: number;
  naturalHeight: number;
  naturalWidth: number;
  viewportSize: { width: number; height: number };
}): number {
  const { maxHeight, maxWidth } = getViewerFitBounds(viewportSize);
  const targetWidth = Math.min(naturalWidth || mediaWidth, maxWidth);
  const targetHeight = Math.min(naturalHeight || mediaHeight, maxHeight);
  return clampZoom(Math.min(
    1,
    targetWidth / Math.max(mediaWidth, themeChatImageViewerTokens.minViewportSizePx),
    targetHeight / Math.max(mediaHeight, themeChatImageViewerTokens.minViewportSizePx),
  ));
}
