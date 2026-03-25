import { cn } from '@/lib/utils';

export const RESIZE_HANDLE_HIT_WIDTH = 10;
export const RESIZE_HANDLE_HALF_WIDTH = RESIZE_HANDLE_HIT_WIDTH / 2;
export const RESIZE_LINE_WIDTH = 1;

interface ResizeDividerVisualProps {
  isVisible: boolean;
  className?: string;
}

export function ResizeDividerVisual({ isVisible, className }: ResizeDividerVisualProps) {
  return (
    <div
      className={cn('h-full bg-[var(--vlaina-border)] opacity-0', isVisible && 'opacity-0', className)}
      style={{ width: RESIZE_LINE_WIDTH }}
    />
  );
}
