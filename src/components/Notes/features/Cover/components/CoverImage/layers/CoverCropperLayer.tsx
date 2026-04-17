import { useCallback, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { LoadedCoverMedia } from '../coverRenderer.types';
import { getBaseDimensions } from '../../../utils/coverGeometry';
import { useCoverCropperInteraction } from '../hooks/interaction/useCoverCropperInteraction';

interface CoverCropperLayerProps {
  displaySrc: string;
  isImageReady: boolean;
  isResizing: boolean;
  isSuspended?: boolean;
  mediaSize: { width: number; height: number } | null;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  crop: { x: number; y: number };
  zoom: number;
  effectiveContainerSize: { width: number; height: number } | null;
  effectiveMinZoom: number;
  effectiveMaxZoom: number;
  objectFitMode: 'contain' | 'horizontal-cover' | 'vertical-cover';
  onCropperCropChange: (crop: { x: number; y: number }) => void;
  onCropperZoomChange: (zoom: number) => void;
  onPointerIntent: (x?: number, y?: number) => void;
  onPointerMoveIntent: (x: number, y: number) => void;
  onNonPointerIntent: () => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
  onMediaLoaded: (media: LoadedCoverMedia) => void;
}

export function CoverCropperLayer({
  displaySrc,
  isImageReady,
  isResizing,
  isSuspended = false,
  mediaSize,
  wrapperRef,
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
}: CoverCropperLayerProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const lastLoadedMediaKeyRef = useRef<string | null>(null);

  const baseDimensions = useMemo(() => {
    if (!effectiveContainerSize || !mediaSize) {
      return null;
    }

    return getBaseDimensions(mediaSize, effectiveContainerSize);
  }, [effectiveContainerSize, mediaSize]);

  const imageStyle = useMemo(() => {
    if (!baseDimensions) {
      const fallbackSizing =
        objectFitMode === 'vertical-cover'
          ? { width: 'auto', height: '100%' }
          : { width: '100%', height: 'auto' };

      return {
        ...fallbackSizing,
        left: '50%',
        top: '50%',
        transform: `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px)) scale(${zoom})`,
      };
    }

    return {
      width: `${baseDimensions.width}px`,
      height: `${baseDimensions.height}px`,
      left: '50%',
      top: '50%',
      transform: `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px)) scale(${zoom})`,
    };
  }, [baseDimensions, crop.x, crop.y, objectFitMode, zoom]);
  const emitMediaLoaded = useCallback(() => {
    const image = imageRef.current;
    if (!image || !image.complete || !image.naturalWidth || !image.naturalHeight) return;

    const media = {
      width: image.clientWidth || image.naturalWidth,
      height: image.clientHeight || image.naturalHeight,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    };
    const mediaKey = `${displaySrc}::${media.width}x${media.height}::${media.naturalWidth}x${media.naturalHeight}`;

    if (lastLoadedMediaKeyRef.current === mediaKey) {
      return;
    }

    lastLoadedMediaKeyRef.current = mediaKey;
    onMediaLoaded(media);
  }, [displaySrc, onMediaLoaded]);

  useEffect(() => {
    lastLoadedMediaKeyRef.current = null;
  }, [displaySrc]);

  useEffect(() => {
    emitMediaLoaded();
  }, [emitMediaLoaded]);

  const {
    bindWheelTarget,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
  } = useCoverCropperInteraction({
    displaySrc,
    crop,
    zoom,
    effectiveMinZoom,
    effectiveMaxZoom,
    onCropperCropChange,
    onCropperZoomChange,
    onPointerIntent,
    onPointerMoveIntent,
    onNonPointerIntent,
    onInteractionStart,
    onInteractionEnd,
  });

  const setWrapperNode = useCallback((node: HTMLDivElement | null) => {
    bindWheelTarget(node);
    (wrapperRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [bindWheelTarget, wrapperRef]);

  return (
    <div
      ref={setWrapperNode}
      className={cn(
        'absolute -inset-px',
        isResizing || isSuspended ? 'opacity-0 pointer-events-none' : isImageReady ? 'opacity-100' : 'opacity-0',
        displaySrc ? 'cursor-move' : 'cursor-default'
      )}
      style={{
        willChange: 'transform',
        touchAction: 'none',
        overscrollBehavior: 'none',
        overflowAnchor: 'none',
      }}
      data-testid="cover-cropper"
      data-object-fit={objectFitMode}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onKeyDownCapture={onNonPointerIntent}
    >
      {displaySrc ? (
        <img
          ref={imageRef}
          src={displaySrc}
          alt="Cover Cropper"
          draggable={false}
          onLoad={emitMediaLoaded}
          className="absolute select-none pointer-events-none max-w-none"
          style={{
            ...imageStyle,
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            transformOrigin: 'center center',
            userSelect: 'none',
          }}
        />
      ) : null}
    </div>
  );
}
