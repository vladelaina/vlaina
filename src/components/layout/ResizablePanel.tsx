import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';
import { useResizableDivider } from './shell/useResizableDivider';

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
      {/* Drag Handle */}
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <div
            onMouseDown={handleDragStart}
            className={cn(
                "absolute left-0 top-0 bottom-0 w-3 cursor-col-resize z-[100] bg-transparent transition-colors touch-none group flex items-center justify-center",
                isDragging && "bg-transparent delay-0",
                !isDragging && "delay-150" // Delay hiding to make it easier to grab
            )}
            title="Drag to resize, double-click to reset"
          >
            <div
              className={`w-[3px] h-full bg-[var(--neko-border)] transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            />
          </div>
        </TooltipTrigger>
        {shortcutKeys && shortcutKeys.length > 0 && (
          <TooltipContent side="left" sideOffset={5} className="flex items-center gap-1.5 text-xs">
            <span>Toggle Sidebar</span>
            <ShortcutKeys keys={shortcutKeys} />
          </TooltipContent>
        )}
      </Tooltip>
      {children}
    </aside>
  );
}
