import { useMemo } from 'react';
import Cropper from 'react-easy-crop';
import { cn } from '@/lib/utils';
import type { LoadedCoverMedia } from '../coverRenderer.types';

interface CoverCropperLayerProps {
  displaySrc: string;
  isImageReady: boolean;
  isResizing: boolean;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  crop: { x: number; y: number };
  zoom: number;
  effectiveContainerSize: { width: number; height: number } | null;
  effectiveMinZoom: number;
  effectiveMaxZoom: number;
  objectFitMode: 'contain' | 'horizontal-cover' | 'vertical-cover';
  onCropperCropChange: (crop: { x: number; y: number }) => void;
  onCropperZoomChange: (zoom: number) => void;
  onPointerIntent: () => void;
  onNonPointerIntent: () => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
  onMediaLoaded: (media: LoadedCoverMedia) => void;
}

export function CoverCropperLayer({
  displaySrc,
  isImageReady,
  isResizing,
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
  onNonPointerIntent,
  onInteractionStart,
  onInteractionEnd,
  onMediaLoaded,
}: CoverCropperLayerProps) {
  const cropperStyle = useMemo(() => ({
    containerStyle: { backgroundColor: 'transparent' },
    cropAreaStyle: {
      border: 'none',
      boxShadow: 'none',
      color: 'transparent',
      outline: 'none',
      background: 'transparent',
    },
    mediaStyle: {
      willChange: 'transform',
      backfaceVisibility: 'hidden' as 'hidden',
      transform: 'translateZ(0)',
      maxWidth: 'none',
      maxHeight: 'none',
    },
  }), []);

  const mediaProps = useMemo(() => ({
    style: {
      willChange: 'transform',
      backfaceVisibility: 'hidden' as 'hidden',
      transform: 'translateZ(0)',
      maxWidth: 'none',
    },
  }), []);

  if (isResizing) return null;

  return (
    <div
      ref={wrapperRef}
      className={cn('absolute -inset-px', isImageReady ? 'opacity-100' : 'opacity-0')}
      style={{ willChange: 'transform' }}
      onPointerDownCapture={onPointerIntent}
      onWheelCapture={onNonPointerIntent}
      onKeyDownCapture={onNonPointerIntent}
    >
      <Cropper
        image={displaySrc || undefined}
        crop={crop}
        zoom={zoom}
        cropSize={effectiveContainerSize ?? undefined}
        minZoom={effectiveMinZoom}
        maxZoom={effectiveMaxZoom}
        objectFit={objectFitMode}
        restrictPosition={true}
        zoomWithScroll={true}
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
  );
}
