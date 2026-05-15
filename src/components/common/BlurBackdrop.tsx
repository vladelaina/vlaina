import { forwardRef, type HTMLAttributes, type MouseEventHandler } from 'react';
import { cn } from '@/lib/utils';

export interface BlurBackdropProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  onClick?: MouseEventHandler<HTMLDivElement>;
  className?: string;
  overlayClassName?: string;
  zIndex?: number;
  blurPx?: number;
  duration?: number;
}

export const BlurBackdrop = forwardRef<HTMLDivElement, BlurBackdropProps>(function BlurBackdrop(
  {
    onClick,
    className,
    overlayClassName = 'bg-white/20 dark:bg-white/5',
    zIndex = 100,
    blurPx = 6,
    duration = 0.2,
    style,
    ...props
  },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        'fixed inset-0 opacity-0 transition-opacity data-[state=open]:opacity-100',
        overlayClassName,
        className,
      )}
      style={{
        zIndex,
        backdropFilter: `blur(${blurPx}px)`,
        WebkitBackdropFilter: `blur(${blurPx}px)`,
        transitionDuration: `${duration}s`,
        ...style,
      }}
      onClick={onClick}
      {...props}
    />
  );
});
