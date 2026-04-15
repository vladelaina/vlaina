import { cn } from '@/lib/utils';
import { calculateCropPixels, getBaseDimensions } from '../../../utils/coverGeometry';

interface CoverPlaceholderLayerProps {
  displaySrc: string;
  isImageReady: boolean;
  positionX: number;
  positionY: number;
  mediaSize: { width: number; height: number } | null;
  effectiveContainerSize: { width: number; height: number } | null;
  zoom?: number;
  forceVisible?: boolean;
}

export function CoverPlaceholderLayer({
  displaySrc,
  isImageReady,
  positionX,
  positionY,
  mediaSize,
  effectiveContainerSize,
  zoom = 1,
  forceVisible = false,
}: CoverPlaceholderLayerProps) {
  if (!displaySrc) return null;

  const hasPreciseGeometry = Boolean(mediaSize && effectiveContainerSize);
  const baseDimensions = hasPreciseGeometry && mediaSize && effectiveContainerSize
    ? getBaseDimensions(mediaSize, effectiveContainerSize)
    : null;
  const crop = hasPreciseGeometry && mediaSize && effectiveContainerSize
    ? calculateCropPixels(
        { x: positionX, y: positionY },
        mediaSize,
        effectiveContainerSize,
        zoom
      )
    : null;

  return (
    <img
      src={displaySrc}
      alt="Cover"
      className={cn(
        'absolute max-w-none pointer-events-none select-none',
        baseDimensions ? 'object-none' : '-inset-px h-[calc(100%+2px)] w-[calc(100%+2px)] object-cover',
        forceVisible || !isImageReady ? 'opacity-100 placeholder-active' : 'opacity-0'
      )}
      style={{
        ...(baseDimensions && crop
          ? {
              width: `${baseDimensions.width}px`,
              height: `${baseDimensions.height}px`,
              left: '50%',
              top: '50%',
              objectPosition: undefined,
              transform: `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px)) scale(${zoom})`,
            }
          : {
              objectPosition: `${positionX}% ${positionY}%`,
              transform: `scale(${zoom})`,
            }),
        transformOrigin: 'center center',
        willChange: 'transform',
      }}
    />
  );
}
