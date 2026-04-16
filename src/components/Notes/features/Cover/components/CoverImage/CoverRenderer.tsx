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
  placeholderMediaSize,
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
  const placeholderDisplaySrc = placeholderSrc || displaySrc;
  const cropperSuspended =
    layoutPanelDragging ||
    isWindowResizing ||
    isContainerResizing ||
    (isResizing && frozenLayerVisible);

  return (
    <>
      <CoverPlaceholderLayer
        displaySrc={placeholderDisplaySrc}
        isImageReady={isImageReady}
        positionX={positionX}
        positionY={positionY}
        crop={crop}
        mediaSize={placeholderMediaSize ?? mediaSize}
        effectiveContainerSize={effectiveContainerSize}
        zoom={zoom}
        objectFitMode={objectFitMode}
        forceVisible={placeholderFallbackVisible}
      />
      <CoverCropperLayer
        displaySrc={displaySrc}
        isImageReady={isImageReady}
        isResizing={isResizing}
        isSuspended={cropperSuspended}
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
