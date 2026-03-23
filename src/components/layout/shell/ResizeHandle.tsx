import type { CSSProperties, MouseEventHandler } from 'react';
import { cn } from '@/lib/utils';
import { ResizeDividerVisual, RESIZE_HANDLE_HIT_WIDTH } from './ResizeDividerVisual';

interface ResizeHandleProps {
  onMouseDown: MouseEventHandler<HTMLDivElement>;
  isDragging: boolean;
  positionStyle: CSSProperties;
  zIndexClassName?: string;
  className?: string;
}

export function ResizeHandle({
  onMouseDown,
  isDragging,
  positionStyle,
  zIndexClassName = 'z-30',
  className,
}: ResizeHandleProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={cn(
        'fixed top-0 bottom-0 cursor-col-resize bg-transparent transition-colors touch-none group flex items-center justify-center',
        zIndexClassName,
        isDragging ? 'delay-0' : 'delay-150',
        className,
      )}
      style={{ width: RESIZE_HANDLE_HIT_WIDTH, ...positionStyle }}
    >
      <ResizeDividerVisual isVisible={isDragging} />
    </div>
  );
}
