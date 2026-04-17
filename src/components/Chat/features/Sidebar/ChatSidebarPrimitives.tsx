import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { getSidebarToneStyles } from '@/components/layout/sidebar/sidebarLabelStyles';
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
        'group/chat-sidebar-surface flex h-full flex-col bg-[var(--chat-sidebar-surface)] text-[var(--chat-sidebar-text)]',
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
  const styles = getSidebarToneStyles('chat');

  return (
    <SidebarRow
      main={main}
      trailing={trailing}
      actions={actions}
      isActive={isActive}
      showActionsByDefault={showActionsByDefault}
      className={className}
      activeClassName={styles.activeRow}
      inactiveClassName={styles.inactiveRow}
      actionFadeClassName={cn(
        styles.fade,
        isActive && styles.fadeActive,
        !isActive && styles.groupFadeHover
      )}
      {...props}
    >
      {children}
    </SidebarRow>
  );
}

interface ChatSidebarHoverEmptyHintProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
}

export function ChatSidebarHoverEmptyHint({
  title,
  className,
  ...props
}: ChatSidebarHoverEmptyHintProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute left-1/2 top-[38.2%] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center opacity-0 transition-opacity duration-150 group-hover/chat-sidebar-surface:opacity-100',
        className,
      )}
      {...props}
    >
      <span className="max-w-[170px] px-4 text-center text-[13px] text-[var(--chat-sidebar-text-soft)]">
        {title}
      </span>
    </div>
  );
}
