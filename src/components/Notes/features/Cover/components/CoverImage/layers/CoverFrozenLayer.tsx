import { cn } from '@/lib/utils';

interface CoverFrozenLayerProps {
  displaySrc: string;
  isResizing: boolean;
  frozenImgRef: React.RefObject<HTMLImageElement | null>;
  frozenImageState: { top: number; left: number; width: number; height: number } | null;
}

export function CoverFrozenLayer({
  displaySrc,
  isResizing,
  frozenImgRef,
  frozenImageState,
}: CoverFrozenLayerProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 pointer-events-none overflow-hidden transition-none',
        !isResizing ? 'invisible' : 'visible'
      )}
    >
      {displaySrc && (
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
            transition: 'none',
          }}
        />
      )}
    </div>
  );
}
