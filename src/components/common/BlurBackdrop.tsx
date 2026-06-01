import { forwardRef, type HTMLAttributes, type MouseEventHandler } from 'react';
import { cn } from '@/lib/utils';
import { themeBackdropTokens } from '@/styles/themeTokens';

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
    overlayClassName = 'bg-[var(--vlaina-color-drop-overlay)]',
    zIndex = themeBackdropTokens.zIndex,
    blurPx = themeBackdropTokens.blurPx,
    duration = themeBackdropTokens.durationSeconds,
    style,
    ...props
  },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        'fixed inset-0 opacity-[var(--vlaina-opacity-0)] transition-opacity data-[state=open]:opacity-[var(--vlaina-opacity-100)]',
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
