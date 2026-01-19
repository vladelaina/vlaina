import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ResizablePanelProps {
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string;
  className?: string;
  onWidthChange?: (width: number) => void;
}

export function ResizablePanel({
  children,
  defaultWidth = 320,
  minWidth = 280,
  maxWidth = 800,
  storageKey,
  className,
  onWidthChange,
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

  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    isResizingRef.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; // Prevent text selection
    
    // Add overlay to prevent iframe stealing events (if any)
    const overlay = document.createElement('div');
    overlay.id = 'resize-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '99999';
    overlay.style.cursor = 'col-resize';
    document.body.appendChild(overlay);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;
    
    // Calculate new width: Window Width - Mouse X
    // Because it's a RIGHT sidebar, width = distance from right edge
    const newWidth = window.innerWidth - e.clientX;
    
    // Apply constraints
    const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    
    setWidth(constrainedWidth);
    onWidthChange?.(constrainedWidth);
  }, [minWidth, maxWidth, onWidthChange]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    isResizingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    const overlay = document.getElementById('resize-overlay');
    if (overlay) overlay.remove();
  }, []);
  
  // Persist effect
  useEffect(() => {
      if (storageKey && !isResizing) {
          localStorage.setItem(storageKey, String(width));
      }
  }, [width, isResizing, storageKey]);

  return (
    <aside
      className={cn(
        "relative flex flex-col border-l border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md overflow-hidden",
        // Only apply transition when NOT resizing to make it smooth on open/close, but instant on drag
        !isResizing && "transition-[width] duration-300 ease-in-out",
        className
      )}
      style={{ width }}
    >
      {/* Drag Handle */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={() => setWidth(defaultWidth)}
        className={cn(
            "absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-[100] hover:bg-blue-500/50 transition-colors touch-none",
            isResizing && "bg-blue-500/50 w-1.5 -left-0.5 delay-0",
            !isResizing && "delay-150" // Delay hiding to make it easier to grab
        )}
        title="Drag to resize, double-click to reset"
      />
      {children}
    </aside>
  );
}
