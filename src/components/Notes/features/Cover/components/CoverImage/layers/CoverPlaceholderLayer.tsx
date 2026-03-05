import { cn } from '@/lib/utils';

interface CoverPlaceholderLayerProps {
  displaySrc: string;
  isImageReady: boolean;
  positionX: number;
  positionY: number;
}

export function CoverPlaceholderLayer({
  displaySrc,
  isImageReady,
  positionX,
  positionY,
}: CoverPlaceholderLayerProps) {
  if (!displaySrc) return null;

  return (
    <img
      src={displaySrc}
      alt="Cover"
      className={cn(
        'absolute -inset-px w-auto h-auto min-w-[calc(100%+2px)] min-h-[calc(100%+2px)] object-cover pointer-events-none',
        isImageReady ? 'opacity-0' : 'opacity-100 placeholder-active'
      )}
      style={{ objectPosition: `${positionX}% ${positionY}%` }}
    />
  );
}
