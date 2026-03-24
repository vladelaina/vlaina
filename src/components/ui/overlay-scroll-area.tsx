import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

const MIN_THUMB_HEIGHT = 36;
const scrollbarThumbIdleColor = 'bg-[#eeeff0] dark:bg-[rgba(150,150,150,0.15)]';
const scrollbarThumbActiveColor = 'bg-[rgba(120,120,120,0.5)] dark:bg-[rgba(150,150,150,0.4)]';
const scrollbarThumbHoverColor = 'hover:bg-[rgba(120,120,120,0.5)] dark:hover:bg-[rgba(150,150,150,0.4)]';

const scrollbarVariantClasses = {
  default: {
    rail: 'w-4',
    railHover: 'w-4',
    railAlign: 'justify-center',
    track: 'w-3',
    trackHover: 'w-3',
    thumbOffset: 'right-[2px]',
    thumbHoverOffset: 'right-[2px]',
    thumbIdleWidth: 'w-2',
    thumbHoverWidth: 'w-2',
    thumbDraggingWidth: 'w-[9px]',
  },
  compact: {
    rail: 'w-[7px]',
    railHover: 'w-4',
    railAlign: 'justify-end',
    track: 'w-[7px]',
    trackHover: 'w-3',
    thumbOffset: 'right-0',
    thumbHoverOffset: 'right-[2px]',
    thumbIdleWidth: 'w-[5px]',
    thumbHoverWidth: 'w-2',
    thumbDraggingWidth: 'w-[9px]',
  },
} as const;

type ScrollbarVariant = keyof typeof scrollbarVariantClasses;

interface ScrollMetrics {
  canScroll: boolean;
  viewportHeight: number;
  scrollHeight: number;
  scrollTop: number;
  thumbHeight: number;
  thumbOffset: number;
}

interface OverlayScrollAreaProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'children'> {
  children?: ReactNode;
  className?: string;
  viewportClassName?: string;
  draggingBodyClassName?: string;
  scrollbarInsetRight?: number;
  scrollbarVariant?: ScrollbarVariant;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getScrollMetrics(element: HTMLDivElement): ScrollMetrics {
  const viewportHeight = element.clientHeight;
  const scrollHeight = element.scrollHeight;
  const scrollTop = element.scrollTop;
  const maxScrollTop = Math.max(scrollHeight - viewportHeight, 0);
  const canScroll = maxScrollTop > 0;

  if (!canScroll) {
    return {
      canScroll,
      viewportHeight,
      scrollHeight,
      scrollTop,
      thumbHeight: viewportHeight,
      thumbOffset: 0,
    };
  }

  const thumbHeight = clamp((viewportHeight / scrollHeight) * viewportHeight, MIN_THUMB_HEIGHT, viewportHeight);
  const maxThumbOffset = Math.max(viewportHeight - thumbHeight, 0);
  const thumbOffset = maxScrollTop === 0
    ? 0
    : (scrollTop / maxScrollTop) * maxThumbOffset;

  return {
    canScroll,
    viewportHeight,
    scrollHeight,
    scrollTop,
    thumbHeight,
    thumbOffset,
  };
}

export const OverlayScrollArea = forwardRef<HTMLDivElement, OverlayScrollAreaProps>(function OverlayScrollArea({
  children,
  className,
  viewportClassName,
  draggingBodyClassName,
  scrollbarInsetRight = 0,
  scrollbarVariant = 'default',
  onScroll,
  onMouseEnter,
  onMouseLeave,
  ...props
}, forwardedRef) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ pointerStartY: number; scrollTopStart: number } | null>(null);
  const metricsRef = useRef<ScrollMetrics>({
    canScroll: false,
    viewportHeight: 0,
    scrollHeight: 0,
    scrollTop: 0,
    thumbHeight: 0,
    thumbOffset: 0,
  });

  const [metrics, setMetrics] = useState(metricsRef.current);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isScrollbarHovered, setIsScrollbarHovered] = useState(false);
  const scrollbarClasses = scrollbarVariantClasses[scrollbarVariant];

  const setViewportRef = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
      return;
    }
    if (forwardedRef) {
      forwardedRef.current = node;
    }
  }, [forwardedRef]);

  const updateMetrics = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const nextMetrics = getScrollMetrics(viewport);
    metricsRef.current = nextMetrics;
    setMetrics((previous) => {
      if (
        previous.canScroll === nextMetrics.canScroll &&
        previous.viewportHeight === nextMetrics.viewportHeight &&
        previous.scrollHeight === nextMetrics.scrollHeight &&
        previous.scrollTop === nextMetrics.scrollTop &&
        previous.thumbHeight === nextMetrics.thumbHeight &&
        previous.thumbOffset === nextMetrics.thumbOffset
      ) {
        return previous;
      }
      return nextMetrics;
    });
  }, []);

  const stopDragging = useCallback(() => {
    dragStateRef.current = null;
    setIsDragging(false);
    setIsScrollbarHovered(false);
  }, []);

  const handleWindowPointerMove = useCallback((event: PointerEvent) => {
    const viewport = viewportRef.current;
    const dragState = dragStateRef.current;
    const nextMetrics = metricsRef.current;

    if (!viewport || !dragState || !nextMetrics.canScroll) {
      return;
    }

    const maxThumbOffset = Math.max(nextMetrics.viewportHeight - nextMetrics.thumbHeight, 0);
    const maxScrollTop = Math.max(nextMetrics.scrollHeight - nextMetrics.viewportHeight, 0);
    if (maxThumbOffset === 0 || maxScrollTop === 0) {
      return;
    }

    const deltaY = event.clientY - dragState.pointerStartY;
    const scrollDelta = (deltaY / maxThumbOffset) * maxScrollTop;
    viewport.scrollTop = clamp(dragState.scrollTopStart + scrollDelta, 0, maxScrollTop);
    updateMetrics();
  }, [updateMetrics]);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };
  }, [handleWindowPointerMove, isDragging, stopDragging]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    if (isDragging) {
      viewport.dataset.overlayScrollbarDragging = 'true';
      if (draggingBodyClassName) {
        document.body.classList.add(draggingBodyClassName);
      }
      return;
    }

    delete viewport.dataset.overlayScrollbarDragging;
    if (draggingBodyClassName) {
      document.body.classList.remove(draggingBodyClassName);
    }

    return () => {
      delete viewport.dataset.overlayScrollbarDragging;
      if (draggingBodyClassName) {
        document.body.classList.remove(draggingBodyClassName);
      }
    };
  }, [draggingBodyClassName, isDragging]);

  useLayoutEffect(() => {
    updateMetrics();
  }, [children, updateMetrics]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      updateMetrics();
    });

    resizeObserver.observe(viewport);
    const firstChild = viewport.firstElementChild;
    if (firstChild instanceof HTMLElement) {
      resizeObserver.observe(firstChild);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [children, updateMetrics]);

  const handleThumbPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const viewport = viewportRef.current;
    if (!viewport || !metricsRef.current.canScroll) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    dragStateRef.current = {
      pointerStartY: event.clientY,
      scrollTopStart: viewport.scrollTop,
    };

    setIsDragging(true);
  }, []);

  const isVisible = metrics.canScroll && (isHovered || isDragging);
  const isScrollbarExpanded = isScrollbarHovered || isDragging;

  return (
    <div
      className={cn('relative flex-1 min-h-0 overflow-hidden', className)}
      onMouseEnter={(event) => {
        setIsHovered(true);
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        setIsHovered(false);
        setIsScrollbarHovered(false);
        onMouseLeave?.(event);
      }}
    >
      <div
        ref={setViewportRef}
        className={cn(
          'scrollbar-hidden h-full min-h-0 overflow-y-auto overflow-x-hidden',
          viewportClassName,
        )}
        onScroll={(event) => {
          updateMetrics();
          onScroll?.(event);
        }}
        {...props}
      >
        {children}
      </div>

      {metrics.canScroll ? (
        <div
          aria-hidden="true"
          className={cn(
            'absolute inset-y-0 right-0 flex cursor-default transition-[opacity,width] duration-100',
            isVisible ? 'pointer-events-auto' : 'pointer-events-none',
            isScrollbarExpanded ? scrollbarClasses.railHover : scrollbarClasses.rail,
            scrollbarClasses.railAlign,
            isVisible ? 'opacity-100' : 'opacity-0',
          )}
          style={{ right: `${scrollbarInsetRight}px` }}
          onPointerEnter={() => setIsScrollbarHovered(true)}
          onPointerLeave={() => setIsScrollbarHovered(false)}
        >
          <div
            className={cn(
              'relative h-full cursor-default transition-[width] duration-100',
              isScrollbarExpanded ? scrollbarClasses.trackHover : scrollbarClasses.track,
            )}
          >
            <div
              className={cn(
                'pointer-events-auto absolute cursor-default rounded-full transition-[width,background-color] duration-100',
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
              onPointerDown={handleThumbPointerDown}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
});
