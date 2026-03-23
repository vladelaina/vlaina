import React from 'react';
import { CoverPlaceholderLayer } from './layers/CoverPlaceholderLayer';
import { CoverCropperLayer } from './layers/CoverCropperLayer';
import { CoverFrozenLayer } from './layers/CoverFrozenLayer';
import type { CoverRendererProps } from './coverRenderer.types';
export type { CoverRendererProps, LoadedCoverMedia } from './coverRenderer.types';

export const CoverRenderer = React.memo(({
  displaySrc,
  layoutPanelDragging = false,
  isWindowResizing = false,
  isContainerResizing = false,
  placeholderSrc,
  isImageReady,
  isResizing,
  isResizeSettling,
  mediaSize,
  wrapperRef,
  frozenImgRef,
  frozenImageState,
  crop,
  zoom,
  effectiveContainerSize,
  effectiveMinZoom,
  effectiveMaxZoom,
  objectFitMode,
  onCropperCropChange,
  onCropperZoomChange,
  onPointerIntent,
  onPointerMoveIntent,
  onNonPointerIntent,
  onInteractionStart,
  onInteractionEnd,
  onMediaLoaded,
  positionX,
  positionY
}: CoverRendererProps) => {
  const frozenLayerVisible = Boolean(frozenImageState) && (isResizing || isResizeSettling);
  const placeholderFallbackVisible =
    !isImageReady ||
    layoutPanelDragging ||
    isWindowResizing ||
    isContainerResizing ||
    (isResizing && !frozenLayerVisible);

  return (
    <>
      <CoverPlaceholderLayer
        displaySrc={placeholderSrc || displaySrc}
        isImageReady={isImageReady}
        positionX={positionX}
        positionY={positionY}
        zoom={zoom}
        forceVisible={placeholderFallbackVisible}
      />
      <CoverCropperLayer
        displaySrc={displaySrc}
        isImageReady={isImageReady}
        isResizing={isResizing}
        isSuspended={layoutPanelDragging || isWindowResizing || isContainerResizing || (isResizing && frozenLayerVisible)}
        mediaSize={mediaSize}
        wrapperRef={wrapperRef}
        crop={crop}
        zoom={zoom}
        effectiveContainerSize={effectiveContainerSize}
        effectiveMinZoom={effectiveMinZoom}
        effectiveMaxZoom={effectiveMaxZoom}
        objectFitMode={objectFitMode}
        onCropperCropChange={onCropperCropChange}
        onCropperZoomChange={onCropperZoomChange}
        onPointerIntent={onPointerIntent}
        onPointerMoveIntent={onPointerMoveIntent}
        onNonPointerIntent={onNonPointerIntent}
        onInteractionStart={onInteractionStart}
        onInteractionEnd={onInteractionEnd}
        onMediaLoaded={onMediaLoaded}
      />
      <CoverFrozenLayer
        displaySrc={displaySrc}
        isVisible={frozenLayerVisible}
        frozenImgRef={frozenImgRef}
        frozenImageState={frozenImageState}
      />
    </>
  );
});
