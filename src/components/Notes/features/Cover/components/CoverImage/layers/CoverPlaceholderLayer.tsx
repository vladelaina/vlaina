import { cn } from '@/lib/utils';

interface CoverPlaceholderLayerProps {
  displaySrc: string;
  isImageReady: boolean;
  positionX: number;
  positionY: number;
  zoom?: number;
  forceVisible?: boolean;
}

export function CoverPlaceholderLayer({
  displaySrc,
  isImageReady,
  positionX,
  positionY,
  zoom = 1,
  forceVisible = false,
}: CoverPlaceholderLayerProps) {
  if (!displaySrc) return null;

  return (
    <img
      src={displaySrc}
      alt="Cover"
      className={cn(
        'absolute -inset-px h-[calc(100%+2px)] w-[calc(100%+2px)] max-w-none object-cover pointer-events-none select-none',
        forceVisible || !isImageReady ? 'opacity-100 placeholder-active' : 'opacity-0'
      )}
      style={{
        objectPosition: `${positionX}% ${positionY}%`,
        transform: `scale(${zoom})`,
        transformOrigin: 'center center',
        willChange: 'transform',
      }}
    />
  );
}
