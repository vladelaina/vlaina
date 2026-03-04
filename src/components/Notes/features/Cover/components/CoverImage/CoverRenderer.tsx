import React from 'react';
import { CoverPlaceholderLayer } from './layers/CoverPlaceholderLayer';
import { CoverCropperLayer } from './layers/CoverCropperLayer';
import { CoverFrozenLayer } from './layers/CoverFrozenLayer';
import type { CoverRendererProps } from './coverRenderer.types';
export type { CoverRendererProps, LoadedCoverMedia } from './coverRenderer.types';

export const CoverRenderer = React.memo(({
  displaySrc,
  placeholderSrc,
  isImageReady,
  isResizing,
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
  onInteractionStart,
  onInteractionEnd,
  onMediaLoaded,
  positionX,
  positionY
}: CoverRendererProps) => {
  return (
    <>
      <CoverPlaceholderLayer
        displaySrc={placeholderSrc || displaySrc}
        isImageReady={isImageReady}
        positionX={positionX}
        positionY={positionY}
      />
      <CoverCropperLayer
        displaySrc={displaySrc}
        isImageReady={isImageReady}
        isResizing={isResizing}
        wrapperRef={wrapperRef}
        crop={crop}
        zoom={zoom}
        effectiveContainerSize={effectiveContainerSize}
        effectiveMinZoom={effectiveMinZoom}
        effectiveMaxZoom={effectiveMaxZoom}
        objectFitMode={objectFitMode}
        onCropperCropChange={onCropperCropChange}
        onCropperZoomChange={onCropperZoomChange}
        onInteractionStart={onInteractionStart}
        onInteractionEnd={onInteractionEnd}
        onMediaLoaded={onMediaLoaded}
      />
      <CoverFrozenLayer
        displaySrc={displaySrc}
        isResizing={isResizing}
        frozenImgRef={frozenImgRef}
        frozenImageState={frozenImageState}
      />
    </>
  );
});
