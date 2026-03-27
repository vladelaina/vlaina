import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SidebarRowProps extends HTMLAttributes<HTMLDivElement> {
  indentWidth?: number;
  leading?: ReactNode;
  leadingClassName?: string;
  main: ReactNode;
  trailing?: ReactNode;
  actions?: ReactNode;
  isActive?: boolean;
  isDragOver?: boolean;
  showActionsByDefault?: boolean;
  contentClassName?: string;
  actionFadeClassName?: string;
  activeClassName: string;
  inactiveClassName: string;
  dragOverClassName?: string;
}

export function SidebarRow({
  indentWidth = 0,
  leading,
  leadingClassName,
  main,
  trailing,
  actions,
  isActive = false,
  isDragOver = false,
  showActionsByDefault = false,
  className,
  contentClassName,
  actionFadeClassName,
  activeClassName,
  inactiveClassName,
  dragOverClassName,
  children,
  ...props
}: SidebarRowProps) {
  const hasActions = Boolean(actions);
  const showTrailing = Boolean(trailing) && (!hasActions || !showActionsByDefault);

  return (
    <div className={cn('group/sidebar-row flex items-center py-[1px]', className)} {...props}>
      {indentWidth > 0 ? (
        <div style={{ width: indentWidth }} className="shrink-0" />
      ) : null}

      <div
        className={cn(
          'relative mx-1 flex min-h-9 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all duration-150 ease-out',
          props.onClick && 'cursor-pointer',
          isActive ? activeClassName : inactiveClassName,
          isDragOver && dragOverClassName,
        )}
      >
        {leading ? (
          <span
            className={cn(
              'flex size-[20px] shrink-0 items-center justify-center',
              leadingClassName,
            )}
          >
            {leading}
          </span>
        ) : null}

        <div
          className={cn('relative z-10 min-w-0 flex-1', hasActions && 'pr-8', contentClassName)}
        >
          {main}
        </div>

        {showTrailing ? (
          <div
            className={cn(
              'pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 transition-opacity duration-150',
              hasActions && 'group-hover/sidebar-row:opacity-0',
            )}
          >
            {trailing}
          </div>
        ) : null}

        {hasActions ? (
          <div
            className={cn(
              'absolute right-1 top-1/2 z-20 flex -translate-y-1/2 items-center transition-opacity duration-150',
              showActionsByDefault
                ? 'pointer-events-auto opacity-100'
                : 'pointer-events-none opacity-0 group-hover/sidebar-row:pointer-events-auto group-hover/sidebar-row:opacity-100',
            )}
          >
            <div
              className={cn(
                'pointer-events-none absolute right-full top-0 h-full w-8 bg-gradient-to-l to-transparent',
                actionFadeClassName,
              )}
            />
            {actions}
          </div>
        ) : null}

        {children}
      </div>
    </div>
  );
}
