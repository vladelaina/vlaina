import type { CSSProperties, MouseEventHandler } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';
import { ResizeDividerVisual, RESIZE_HANDLE_HIT_WIDTH } from './ResizeDividerVisual';

interface ResizeHandleProps {
  onMouseDown: MouseEventHandler<HTMLDivElement>;
  isDragging: boolean;
  positionStyle: CSSProperties;
  tooltipSide: 'left' | 'right';
  shortcutKeys?: string[];
  zIndexClassName?: string;
  className?: string;
}

export function ResizeHandle({
  onMouseDown,
  isDragging,
  positionStyle,
  tooltipSide,
  shortcutKeys,
  zIndexClassName = 'z-30',
  className,
}: ResizeHandleProps) {
  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>
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
      </TooltipTrigger>
      {shortcutKeys && shortcutKeys.length > 0 && (
        <TooltipContent side={tooltipSide} sideOffset={5} className="flex items-center gap-1.5 text-xs">
          <span>Toggle Sidebar</span>
          <ShortcutKeys keys={shortcutKeys} />
        </TooltipContent>
      )}
    </Tooltip>
  );
}
