import { forwardRef, type MouseEventHandler } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface BlurBackdropProps extends Omit<HTMLMotionProps<'div'>, 'onClick'> {
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
    initial,
    animate,
    exit,
    transition,
    style,
    ...props
  },
  ref
) {
  return (
    <motion.div
      ref={ref}
      initial={initial ?? { opacity: 0 }}
      animate={animate ?? { opacity: 1 }}
      exit={exit ?? { opacity: 0 }}
      transition={transition ?? { duration }}
      className={cn('fixed inset-0', overlayClassName, className)}
      style={{
        zIndex,
        backdropFilter: `blur(${blurPx}px)`,
        WebkitBackdropFilter: `blur(${blurPx}px)`,
        ...style,
      }}
      onClick={onClick}
      {...props}
    />
  );
});
