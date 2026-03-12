import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useResizableDivider } from './shell/useResizableDivider';
import { RESIZE_HANDLE_HALF_WIDTH } from './shell/ResizeDividerVisual';
import { ResizeHandle } from './shell/ResizeHandle';

interface ResizablePanelProps {
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string;
  className?: string;
  onWidthChange?: (width: number) => void;
  shortcutKeys?: string[];
}

export function ResizablePanel({
  children,
  defaultWidth = 320,
  minWidth = 280,
  maxWidth = 800,
  storageKey,
  className,
  onWidthChange,
  shortcutKeys,
}: ResizablePanelProps) {
  // Initialize width from storage or default
  const [width, setWidth] = useState(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return parseInt(saved, 10);
      } catch (e) {
        console.error('Failed to load panel width', e);
      }
    }
    return defaultWidth;
  });

  const handleWidthChange = useCallback((nextWidth: number) => {
    setWidth(nextWidth);
    onWidthChange?.(nextWidth);
  }, [onWidthChange]);

  const { isDragging, handleDragStart } = useResizableDivider({
    width,
    minWidth,
    maxWidth,
    defaultWidth,
    onWidthChange: handleWidthChange,
    direction: 'reverse',
    useOverlay: true,
  });

  // Persist effect
  useEffect(() => {
      if (storageKey && !isDragging) {
          localStorage.setItem(storageKey, String(width));
      }
  }, [width, isDragging, storageKey]);

  return (
    <aside
      className={cn(
        "relative flex flex-col bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md overflow-hidden",
        // Only apply transition when NOT resizing to make it smooth on open/close, but instant on drag
        !isDragging && "transition-[width] duration-300 ease-in-out",
        className
      )}
      style={{ width }}
    >
      <ResizeHandle
        onMouseDown={handleDragStart}
        isDragging={isDragging}
        tooltipSide="left"
        shortcutKeys={shortcutKeys}
        zIndexClassName="z-[100]"
        positionStyle={{
          right: width - RESIZE_HANDLE_HALF_WIDTH,
        }}
      />
      {children}
    </aside>
  );
}
