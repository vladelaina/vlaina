import { getSidebarLabelClass } from '@/components/layout/sidebar/sidebarLabelStyles';
import { cn } from '@/lib/utils';

export function getChatSessionTitleClass({
  isActive,
  isMenuTarget,
  isGenerating,
  isUnread,
}: {
  isActive: boolean;
  isMenuTarget: boolean;
  isGenerating: boolean;
  isUnread: boolean;
}) {
  return cn(
    isActive || isMenuTarget
      ? 'text-[var(--vlaina-sidebar-row-selected-text)]'
      : getSidebarLabelClass('chat', { emphasized: isGenerating || isUnread })
  );
}

export function ChatSidebarLoadingTitle({
  title,
  fullWrap = false,
  selected = false,
}: {
  title: string;
  fullWrap?: boolean;
  selected?: boolean;
}) {
  return (
    <span className={cn('chat-sidebar-loading-title', fullWrap && 'chat-sidebar-loading-title-unclamped')}>
      <span className={cn(
        'chat-sidebar-loading-title-base',
        selected && '!text-[var(--vlaina-sidebar-row-selected-text)]',
      )}>
        {title}
      </span>
      <span
        className={cn(
          'chat-sidebar-loading-title-overlay',
          selected && '!text-[var(--vlaina-sidebar-row-selected-text)]',
        )}
        aria-hidden
      >
        {title}
      </span>
    </span>
  );
}
