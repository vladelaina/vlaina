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
  onDragStateChange?: (dragging: boolean) => void;
}

function clampPanelWidth(width: number, minWidth: number, maxWidth: number): number {
  return Math.max(minWidth, Math.min(maxWidth, width));
}

function parseStoredPanelWidth(value: string | null, minWidth: number, maxWidth: number): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return clampPanelWidth(parsed, minWidth, maxWidth);
}

export function ResizablePanel({
  children,
  defaultWidth = 320,
  minWidth = 280,
  maxWidth = 800,
  storageKey,
  className,
  onWidthChange,
  onDragStateChange,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(() => {
    if (storageKey) {
      try {
        const saved = parseStoredPanelWidth(localStorage.getItem(storageKey), minWidth, maxWidth);
        if (saved !== null) return saved;
      } catch (e) {
      }
    }
    return clampPanelWidth(defaultWidth, minWidth, maxWidth);
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
    onDragStateChange,
    direction: 'reverse',
    useOverlay: true,
  });

  useEffect(() => {
    if (storageKey && !isDragging) {
      try {
        localStorage.setItem(storageKey, String(width));
      } catch {
      }
    }
  }, [width, isDragging, storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || event.key !== storageKey) {
        return;
      }

      const nextWidth = parseStoredPanelWidth(event.newValue, minWidth, maxWidth);
      if (nextWidth === null) {
        return;
      }

      setWidth(nextWidth);
      onWidthChange?.(nextWidth);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [maxWidth, minWidth, onWidthChange, storageKey]);

  return (
    <aside
      className={cn(
        "relative flex flex-col bg-[var(--vlaina-color-setting-content)] backdrop-blur-[var(--vlaina-backdrop-blur-md)] overflow-hidden",
        isDragging && "will-change-[width]",
        !isDragging && "transition-[width] duration-[var(--vlaina-duration-300)] ease-in-out",
        className
      )}
      style={{ width }}
    >
      <ResizeHandle
        onMouseDown={handleDragStart}
        isDragging={isDragging}
        zIndexClassName="z-[var(--vlaina-z-100)]"
        positionStyle={{
          right: width - RESIZE_HANDLE_HALF_WIDTH,
        }}
      />
      {children}
    </aside>
  );
}
