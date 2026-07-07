import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { cn } from '@/lib/utils';
import {
  scrollbarThumbActiveColor,
  scrollbarThumbHoverColor,
  scrollbarThumbIdleColor,
  type ScrollbarVariantClasses,
  type ScrollMetrics,
} from './overlayScrollAreaUtils';

interface OverlayScrollbarProps {
  metrics: ScrollMetrics;
  isVisible: boolean;
  isScrollbarExpanded: boolean;
  isDragging: boolean;
  scrollbarInsetRight: number;
  scrollbarClasses: ScrollbarVariantClasses;
  thumbRef: RefObject<HTMLDivElement | null>;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onThumbPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export function OverlayScrollbar({
  metrics,
  isVisible,
  isScrollbarExpanded,
  isDragging,
  scrollbarInsetRight,
  scrollbarClasses,
  thumbRef,
  onPointerEnter,
  onPointerLeave,
  onThumbPointerDown,
}: OverlayScrollbarProps) {
  return (
    <div
      aria-hidden="true"
      data-overlay-scrollbar-rail="true"
      data-no-focus-input="true"
      className={cn(
        'absolute inset-y-0 right-0 z-[var(--vlaina-z-20)] flex cursor-default transition-[opacity,width] duration-[var(--vlaina-duration-100)]',
        isVisible ? 'pointer-events-auto' : 'pointer-events-none',
        isScrollbarExpanded ? scrollbarClasses.railHover : scrollbarClasses.rail,
        scrollbarClasses.railAlign,
        isVisible ? 'opacity-[var(--vlaina-opacity-100)]' : 'opacity-[var(--vlaina-opacity-0)]',
      )}
      style={{ right: `${scrollbarInsetRight}px` }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div
        className={cn(
          'relative h-full cursor-default transition-[width] duration-[var(--vlaina-duration-100)]',
          isScrollbarExpanded ? scrollbarClasses.trackHover : scrollbarClasses.track,
        )}
      >
        <div
          ref={thumbRef}
          data-overlay-scrollbar-thumb="true"
          className={cn(
            'pointer-events-auto absolute cursor-default rounded-full transition-[width,background-color] duration-[var(--vlaina-duration-100)]',
            isScrollbarExpanded ? scrollbarClasses.thumbHoverOffset : scrollbarClasses.thumbOffset,
            isDragging
              ? scrollbarThumbActiveColor
              : isScrollbarExpanded
                ? scrollbarThumbActiveColor
                : cn(scrollbarThumbIdleColor, scrollbarThumbHoverColor),
            isDragging
              ? scrollbarClasses.thumbDraggingWidth
              : isScrollbarExpanded
                ? scrollbarClasses.thumbHoverWidth
                : scrollbarClasses.thumbIdleWidth,
          )}
          style={{
            height: `${metrics.thumbHeight}px`,
            transform: `translateY(${metrics.thumbOffset}px)`,
          }}
          onPointerDown={onThumbPointerDown}
        />
      </div>
    </div>
  );
}
