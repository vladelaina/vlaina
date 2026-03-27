import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  SidebarList,
  SidebarScrollArea,
  SidebarSurface,
} from '@/components/layout/sidebar/SidebarPrimitives';
import { SidebarRow } from '@/components/layout/sidebar/SidebarRow';

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

export const ChatSidebarSurface = forwardRef<HTMLDivElement, ChatSidebarSurfaceProps>(function ChatSidebarSurface({
  className,
  isPeeking = false,
  ...props
}, ref) {
  return (
    <SidebarSurface
      ref={ref}
      className={cn(
        'flex h-full flex-col bg-[var(--chat-sidebar-surface)] text-[var(--chat-sidebar-text)]',
        className
      )}
      isPeeking={isPeeking}
      {...props}
    />
  );
});

export const ChatSidebarScrollArea = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function ChatSidebarScrollArea({
  onMouseEnter,
  className,
  ...props
}, ref) {
  return (
    <SidebarScrollArea
      ref={ref}
      onMouseEnter={onMouseEnter}
      viewportClassName={className}
      {...props}
    />
  );
});

export function ChatSidebarList({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <SidebarList className={className} {...props} />;
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
  return (
    <SidebarRow
      main={main}
      trailing={trailing}
      actions={actions}
      isActive={isActive}
      showActionsByDefault={showActionsByDefault}
      className={className}
      activeClassName="bg-[var(--chat-sidebar-row-active)] text-[var(--chat-sidebar-text)]"
      inactiveClassName="text-[var(--chat-sidebar-text-muted)] hover:bg-[var(--chat-sidebar-row-hover)]"
      actionFadeClassName={cn(
        'from-[var(--chat-sidebar-fade)]',
        isActive && 'from-[var(--chat-sidebar-row-active)]',
        !isActive && 'group-hover/sidebar-row:from-[var(--chat-sidebar-row-hover)]'
      )}
      {...props}
    >
      {children}
    </SidebarRow>
  );
}
