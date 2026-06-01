import { cn } from '@/lib/utils';
import { calculateCropPixels, getBaseDimensions } from '../../../utils/coverGeometry';
import { themeCoverLayerTokens, themeRenderingTokens } from '@/styles/themeTokens';

interface CoverPlaceholderLayerProps {
  displaySrc: string;
  isImageReady: boolean;
  positionX: number;
  positionY: number;
  crop?: { x: number; y: number } | null;
  mediaSize: { width: number; height: number } | null;
  effectiveContainerSize: { width: number; height: number } | null;
  zoom?: number;
  objectFitMode: 'contain' | 'horizontal-cover' | 'vertical-cover';
  forceVisible?: boolean;
}

export function CoverPlaceholderLayer({
  displaySrc,
  isImageReady,
  positionX,
  positionY,
  crop: resolvedCrop,
  mediaSize,
  effectiveContainerSize,
  zoom = 1,
  objectFitMode,
  forceVisible = false,
}: CoverPlaceholderLayerProps) {
  const hasDisplaySrc = Boolean(displaySrc);

  const hasPreciseGeometry = Boolean(mediaSize && effectiveContainerSize);
  const baseDimensions = hasPreciseGeometry && mediaSize && effectiveContainerSize
    ? getBaseDimensions(mediaSize, effectiveContainerSize)
    : null;
  const crop = hasPreciseGeometry && mediaSize && effectiveContainerSize
    ? (
        resolvedCrop ??
        calculateCropPixels(
          { x: positionX, y: positionY },
          mediaSize,
          effectiveContainerSize,
          zoom
        )
      )
    : null;
  const fallbackCrop = resolvedCrop ?? { x: 0, y: 0 };
  const fallbackSizing =
    objectFitMode === 'vertical-cover'
      ? { width: themeCoverLayerTokens.sizeAuto, height: themeCoverLayerTokens.sizeFull }
      : { width: themeCoverLayerTokens.sizeFull, height: themeCoverLayerTokens.sizeAuto };
  const isVisible = forceVisible || !isImageReady;
  const style = {
    ...(baseDimensions && crop
      ? {
          width: `${baseDimensions.width}px`,
          height: `${baseDimensions.height}px`,
          left: themeCoverLayerTokens.positionCenter,
          top: themeCoverLayerTokens.positionCenter,
          objectPosition: undefined,
          transform: `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px)) scale(${zoom})`,
        }
      : {
          ...fallbackSizing,
          left: themeCoverLayerTokens.positionCenter,
          top: themeCoverLayerTokens.positionCenter,
          objectPosition: undefined,
          transform: `translate(calc(-50% + ${fallbackCrop.x}px), calc(-50% + ${fallbackCrop.y}px)) scale(${zoom})`,
        }),
    transformOrigin: themeCoverLayerTokens.transformOriginCenter,
    willChange: themeRenderingTokens.transformWillChange,
  } as const;

  if (!hasDisplaySrc) {
    return null;
  }

  return (
    <img
      key={displaySrc}
      src={displaySrc}
      alt="Cover"
      className={cn(
        'absolute max-w-none pointer-events-none select-none',
        baseDimensions ? 'object-none' : 'object-none',
        isVisible ? 'opacity-[var(--vlaina-opacity-100)] placeholder-active' : 'opacity-[var(--vlaina-opacity-0)]'
      )}
      style={style}
    />
  );
}
