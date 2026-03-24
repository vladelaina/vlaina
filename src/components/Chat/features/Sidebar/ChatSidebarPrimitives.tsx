import type { HTMLAttributes, ReactNode } from 'react';
import { OverlayScrollArea } from '@/components/ui/overlay-scroll-area';
import { cn } from '@/lib/utils';

interface ChatSidebarSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  isPeeking?: boolean;
}

interface ChatSidebarRowProps extends HTMLAttributes<HTMLDivElement> {
  main: ReactNode;
  trailing?: ReactNode;
  actions?: ReactNode;
  isActive?: boolean;
  showActionsByDefault?: boolean;
}

export function ChatSidebarSurface({
  className,
  isPeeking = false,
  ...props
}: ChatSidebarSurfaceProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col bg-[var(--chat-sidebar-surface)] text-[var(--chat-sidebar-text)]',
        isPeeking && 'opacity-95',
        className
      )}
      {...props}
    />
  );
}

export function ChatSidebarScrollArea({
  onMouseEnter,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <OverlayScrollArea
      viewportClassName={cn('px-2 py-2', className)}
      onMouseEnter={onMouseEnter}
      {...props}
    />
  );
}

export function ChatSidebarList({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-0.5', className)} {...props} />;
}

export function ChatSidebarRow({
  main,
  trailing,
  actions,
  isActive = false,
  showActionsByDefault = false,
  className,
  children,
  ...props
}: ChatSidebarRowProps) {
  const hasActions = Boolean(actions);
  const showTrailing = Boolean(trailing) && (!hasActions || !showActionsByDefault);

  return (
    <div className={cn('group/chat-sidebar-row flex items-center py-[1px]', className)} {...props}>
      <div
        className={cn(
          'relative mx-1 flex min-h-9 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all duration-150 ease-out',
          isActive
            ? 'bg-[var(--chat-sidebar-row-active)] text-[var(--chat-sidebar-text)]'
            : 'text-[var(--chat-sidebar-text-muted)] hover:bg-[var(--chat-sidebar-row-hover)]'
        )}
      >
        <div className={cn('relative z-10 min-w-0 flex-1', hasActions && 'pr-8')}>{main}</div>

        {showTrailing ? (
          <div
            className={cn(
              'pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 transition-opacity duration-150',
              hasActions && 'group-hover/chat-sidebar-row:opacity-0'
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
                : 'pointer-events-none opacity-0 group-hover/chat-sidebar-row:pointer-events-auto group-hover/chat-sidebar-row:opacity-100'
            )}
          >
            <div
              className={cn(
                'pointer-events-none absolute right-full top-0 h-full w-8 bg-gradient-to-l from-[var(--chat-sidebar-fade)] to-transparent',
                isActive && 'from-[var(--chat-sidebar-row-active)]',
                !isActive && 'group-hover/chat-sidebar-row:from-[var(--chat-sidebar-row-hover)]'
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
