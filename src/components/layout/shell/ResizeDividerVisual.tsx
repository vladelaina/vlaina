import { cn } from '@/lib/utils';

export const RESIZE_HANDLE_HIT_WIDTH = 10;
export const RESIZE_HANDLE_HALF_WIDTH = RESIZE_HANDLE_HIT_WIDTH / 2;
export const RESIZE_LINE_WIDTH = 3;

interface ResizeDividerVisualProps {
  isVisible: boolean;
  className?: string;
}

export function ResizeDividerVisual({ isVisible, className }: ResizeDividerVisualProps) {
  return (
    <div
      className={cn(
        'h-full bg-[var(--neko-border)] origin-center transition-all duration-200 ease-out',
        isVisible
          ? 'opacity-100 scale-y-100'
          : 'opacity-0 scale-y-0 group-hover:opacity-100 group-hover:scale-y-100',
        className,
      )}
      style={{ width: RESIZE_LINE_WIDTH }}
    />
  );
}
