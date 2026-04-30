import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SidebarRowProps extends HTMLAttributes<HTMLDivElement> {
  indentWidth?: number;
  leading?: ReactNode;
  leadingClassName?: string;
  rowClassName?: string;
  main: ReactNode;
  trailing?: ReactNode;
  actions?: ReactNode;
  isActive?: boolean;
  isHighlighted?: boolean;
  isDragOver?: boolean;
  showActionsByDefault?: boolean;
  contentClassName?: string;
  actionFadeClassName?: string;
  activeClassName: string;
  highlightClassName?: string;
  inactiveClassName: string;
  dragOverClassName?: string;
}

export function SidebarRow({
  indentWidth = 0,
  leading,
  leadingClassName,
  rowClassName,
  main,
  trailing,
  actions,
  isActive = false,
  isHighlighted = false,
  isDragOver = false,
  showActionsByDefault = false,
  className,
  contentClassName,
  actionFadeClassName,
  activeClassName,
  highlightClassName,
  inactiveClassName,
  dragOverClassName,
  children,
  ...props
}: SidebarRowProps) {
  const hasActions = Boolean(actions);
  const showTrailing = Boolean(trailing) && (!hasActions || !showActionsByDefault);
  const rowStyle = indentWidth > 0 ? { paddingLeft: `calc(0.75rem + ${indentWidth}px)` } : undefined;

  return (
    <div
      className={cn(
        'group/sidebar-row flex items-center py-[1px]',
        props.onClick && 'cursor-pointer',
        className,
      )}
      {...props}
    >
      <div
        style={rowStyle}
        className={cn(
          'relative flex h-[30px] flex-1 items-center gap-2 rounded-md px-3 py-1 text-sm transition-all duration-150 ease-out',
          rowClassName,
          props.onClick && 'cursor-pointer',
          isHighlighted
            ? highlightClassName ?? inactiveClassName
            : isActive
              ? activeClassName
              : inactiveClassName,
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
