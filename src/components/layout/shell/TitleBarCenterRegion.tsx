import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function TitleBarCenterRegion({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('relative flex h-full w-full min-w-0 items-center px-2', className)}
      {...props}
    />
  );
}

export function TitleBarInteractiveRegion({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('app-no-drag relative flex h-full w-fit max-w-full min-w-0 items-center', className)}
      {...props}
    />
  );
}
