import React, { useMemo } from 'react';
import Cropper from 'react-easy-crop';
import { cn } from '@/lib/utils';

interface CoverRendererProps {
  displaySrc: string;
  isImageReady: boolean;
  isResizing: boolean;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  frozenImgRef: React.RefObject<HTMLImageElement | null>;
  frozenImageState: { top: number; left: number; width: number; height: number } | null;
  crop: { x: number; y: number };
  zoom: number;
  effectiveContainerSize: { width: number; height: number } | null;
  effectiveMinZoom: number;
  effectiveMaxZoom: number;
  objectFitMode: 'contain' | 'horizontal-cover' | 'vertical-cover';
  onCropperCropChange: (crop: { x: number; y: number }) => void;
  onCropperZoomChange: (zoom: number) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
  onMediaLoaded: (media: any) => void;
  positionX: number;
  positionY: number;
}

export const CoverRenderer = React.memo(({
  displaySrc,
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

  const cropperStyle = useMemo(() => ({
    containerStyle: { backgroundColor: 'transparent' },
    cropAreaStyle: { border: 'none', boxShadow: 'none', color: 'transparent' },
    mediaStyle: {
      willChange: 'transform',
      backfaceVisibility: 'hidden' as 'hidden',
      transform: 'translateZ(0)',
      maxWidth: 'none',
      maxHeight: 'none'
    }
  }), []);

  const mediaProps = useMemo(() => ({
    style: {
      willChange: 'transform',
      backfaceVisibility: 'hidden' as 'hidden',
      transform: 'translateZ(0)',
      maxWidth: 'none',
    }
  }), []);

  return (
    <>
      {/* Background/Loading Placeholder */}
      <img
        src={displaySrc}
        alt="Cover"
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-opacity duration-300 pointer-events-none",
          isImageReady ? "opacity-0" : "opacity-100 placeholder-active"
        )}
        style={{ objectPosition: `${positionX}% ${positionY}%` }}
      />

      {/* Main Cropper */}
      {!isResizing && (
        <div
          ref={wrapperRef}
          className={cn("absolute inset-0 transition-opacity duration-300", isImageReady ? "opacity-100" : "opacity-0")}
          style={{ willChange: 'transform' }}
        >
          <Cropper
            image={displaySrc}
            crop={crop}
            zoom={zoom}
            cropSize={effectiveContainerSize ?? undefined}
            minZoom={effectiveMinZoom}
            maxZoom={effectiveMaxZoom}
            objectFit={objectFitMode}
            restrictPosition={true}
            showGrid={false}
            onCropChange={onCropperCropChange}
            onZoomChange={onCropperZoomChange}
            onInteractionStart={onInteractionStart}
            onInteractionEnd={onInteractionEnd}
            onMediaLoaded={onMediaLoaded}
            style={cropperStyle}
            mediaProps={mediaProps}
          />
        </div>
      )}

      {/* Frozen Layer for Resize Performance */}
      <div
        className={cn(
          "absolute inset-0 pointer-events-none overflow-hidden transition-none",
          !isResizing ? "invisible" : "visible"
        )}
      >
        <img
          ref={frozenImgRef}
          src={displaySrc}
          alt="Frozen Cover"
          style={{
            position: 'absolute',
            top: frozenImageState?.top ?? 0,
            left: frozenImageState?.left ?? 0,
            width: frozenImageState?.width ?? 0,
            height: frozenImageState?.height ?? 0,
            maxWidth: 'none',
            maxHeight: 'none',
            objectFit: 'fill',
            opacity: isResizing ? 1 : 0,
            transition: 'none'
          }}
        />
      </div>
    </>
  );
});
