// CustomScrollbar - A custom scrollbar component that replaces native scrollbar

import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CustomScrollbarProps {
  children: ReactNode;
  className?: string;
}

export function CustomScrollbar({ children, className }: CustomScrollbarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  
  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  
  const dragStartY = useRef(0);
  const dragStartScrollTop = useRef(0);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const updateThumb = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;

    const { scrollHeight, clientHeight, scrollTop } = content;
    
    if (scrollHeight <= clientHeight) {
      setThumbHeight(0);
      return;
    }

    const ratio = clientHeight / scrollHeight;
    const newThumbHeight = Math.max(ratio * clientHeight, 30);
    const maxScrollTop = scrollHeight - clientHeight;
    const scrollRatio = scrollTop / maxScrollTop;
    const maxThumbTop = clientHeight - newThumbHeight;
    const newThumbTop = scrollRatio * maxThumbTop;

    setThumbHeight(newThumbHeight);
    setThumbTop(newThumbTop);
  }, []);

  const showScrollbar = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    setIsVisible(true);
  }, []);

  const hideScrollbar = useCallback(() => {
    if (isDragging || isHovering) return;
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 1000);
  }, [isDragging, isHovering]);

  const handleScroll = useCallback(() => {
    updateThumb();
    showScrollbar();
    hideScrollbar();
  }, [updateThumb, showScrollbar, hideScrollbar]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartScrollTop.current = contentRef.current?.scrollTop || 0;
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !contentRef.current) return;

    const content = contentRef.current;
    const { scrollHeight, clientHeight } = content;
    const maxScrollTop = scrollHeight - clientHeight;
    const maxThumbTop = clientHeight - thumbHeight;
    
    const deltaY = e.clientY - dragStartY.current;
    const scrollDelta = (deltaY / maxThumbTop) * maxScrollTop;
    
    content.scrollTop = dragStartScrollTop.current + scrollDelta;
  }, [isDragging, thumbHeight]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    hideScrollbar();
  }, [hideScrollbar]);

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (!contentRef.current || e.target === thumbRef.current) return;
    
    const track = e.currentTarget;
    const rect = track.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const content = contentRef.current;
    const { scrollHeight, clientHeight } = content;
    
    const scrollRatio = clickY / clientHeight;
    content.scrollTop = scrollRatio * (scrollHeight - clientHeight);
  }, []);

  useEffect(() => {
    updateThumb();
    
    const content = contentRef.current;
    if (!content) return;

    const resizeObserver = new ResizeObserver(updateThumb);
    resizeObserver.observe(content);
    
    // Also observe children changes
    const mutationObserver = new MutationObserver(updateThumb);
    mutationObserver.observe(content, { childList: true, subtree: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [updateThumb]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const shouldShowScrollbar = thumbHeight > 0 && (isVisible || isDragging || isHovering);

  return (
    <div 
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      onMouseEnter={() => {
        setIsHovering(true);
        showScrollbar();
      }}
      onMouseLeave={() => {
        setIsHovering(false);
        hideScrollbar();
      }}
    >
      <div
        ref={contentRef}
        className="h-full overflow-auto neko-scrollbar"
        onScroll={handleScroll}
      >
        {children}
      </div>
      
      {thumbHeight > 0 && (
        <div
          className={cn(
            "absolute right-1 top-0 bottom-0 w-2 transition-opacity duration-200",
            shouldShowScrollbar ? "opacity-100" : "opacity-0"
          )}
          onClick={handleTrackClick}
        >
          <div
            ref={thumbRef}
            className={cn(
              "absolute right-0 w-1.5 rounded-full transition-colors cursor-pointer",
              isDragging 
                ? "bg-[var(--neko-text-tertiary)]" 
                : "bg-[var(--neko-border)] hover:bg-[var(--neko-text-tertiary)]"
            )}
            style={{
              height: thumbHeight,
              top: thumbTop,
            }}
            onMouseDown={handleMouseDown}
          />
        </div>
      )}
    </div>
  );
}
