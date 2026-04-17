import { memo, useRef } from 'react';
import { useAIUIStore } from '@/stores/ai/chatState';
import { cn, iconButtonStyles } from '@/lib/utils';
import { getSidebarLabelClass } from '@/components/layout/sidebar/sidebarLabelStyles';
import { ChatSidebarRow } from './ChatSidebarPrimitives';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DeleteIcon } from '@/components/common/DeleteIcon';
import { Icon } from '@/components/ui/icons';
import { SidebarInlineRenameInput } from '@/components/layout/sidebar/SidebarInlineRenameInput';
import type { ChatSession } from '@/lib/ai/types';

interface ChatSidebarSessionRowProps {
  session: ChatSession;
  isActive: boolean;
  isRenaming: boolean;
  renameDraft: string;
  onRenameDraftChange: (value: string) => void;
  onStartRename: (sessionId: string, title: string) => void;
  onCommitRename: (sessionId: string, title: string) => void;
  onCancelRename: () => void;
  onSwitch: (sessionId: string, isUnread: boolean) => void;
  onRequestDelete: (sessionId: string) => void;
  onTogglePin: (sessionId: string, isPinned?: boolean) => void;
  onHideSearch?: () => void;
  shouldHideSearchResults: boolean;
}

function ChatSidebarLoadingTitle({ title }: { title: string }) {
  return (
    <span className="chat-sidebar-loading-title">
      <span className="chat-sidebar-loading-title-base">{title}</span>
      <span className="chat-sidebar-loading-title-overlay" aria-hidden>
        {title}
      </span>
    </span>
  );
}

function ChatSidebarSessionRowInner({
  session,
  isActive,
  isRenaming,
  renameDraft,
  onRenameDraftChange,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onSwitch,
  onRequestDelete,
  onTogglePin,
  onHideSearch,
  shouldHideSearchResults,
}: ChatSidebarSessionRowProps) {
  const preventNextMenuAutoFocusRef = useRef(false);
  const isGenerating = useAIUIStore((state) => !!state.generatingSessions[session.id]);
  const isUnread = useAIUIStore((state) => !!state.unreadSessions[session.id]);
  const displayTitle = session.title || 'New Chat';
  const showMenuByDefault = isActive && !session.isPinned;
  const statusIndicator = isGenerating && !isActive ? (
    null
  ) : isUnread ? (
    <div className="h-2 w-2 rounded-full bg-[var(--chat-sidebar-status-warning)] shadow-[0_0_8px_rgba(245,158,11,0.45)]" />
  ) : session.isPinned ? (
    <Icon name="common.pinPrimer" size={14} className="text-[var(--chat-sidebar-pin)]" />
  ) : null;

  return (
    <ChatSidebarRow
      isActive={isActive}
      showActionsByDefault={showMenuByDefault}
      onClick={() => {
        if (isRenaming) {
          return;
        }
        onSwitch(session.id, isUnread);
        if (shouldHideSearchResults) {
          onHideSearch?.();
        }
      }}
      main={
        isRenaming ? (
          <SidebarInlineRenameInput
            value={renameDraft}
            onValueChange={onRenameDraftChange}
            onSubmit={() => onCommitRename(session.id, displayTitle)}
            onCancel={onCancelRename}
            className={cn(
              'w-full min-w-0 border-none bg-transparent p-0 text-sm leading-5 outline-none',
              getSidebarLabelClass('chat', { emphasized: isGenerating || isUnread })
            )}
          />
        ) : isGenerating && !isActive ? (
          <span className="block truncate">
            <ChatSidebarLoadingTitle title={displayTitle} />
          </span>
        ) : (
          <span
            className={cn(
              'block truncate transition-opacity',
              getSidebarLabelClass('chat', { emphasized: isGenerating || isUnread })
            )}
          >
            {displayTitle}
          </span>
        )
      }
      trailing={statusIndicator}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger
            onClick={(event) => {
              event.stopPropagation();
            }}
            className={cn(
              'p-1 rounded-md focus:outline-none',
              iconButtonStyles,
              isActive
                ? 'text-[var(--chat-sidebar-icon-hover)] hover:text-[var(--chat-sidebar-text)]'
                : 'text-[var(--chat-sidebar-icon)] hover:text-[var(--chat-sidebar-icon-hover)]'
            )}
          >
            <Icon name="common.more" size="md" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            onCloseAutoFocus={(event) => {
              if (!preventNextMenuAutoFocusRef.current) {
                return;
              }
              event.preventDefault();
              preventNextMenuAutoFocusRef.current = false;
            }}
            className={cn(
              'w-44 p-1.5 rounded-2xl bg-white dark:bg-neutral-800',
              'border border-neutral-100 dark:border-neutral-600/40',
              'backdrop-blur-lg shadow-xl',
              'animate-in fade-in-0 zoom-in-95 duration-75'
            )}
          >
            <DropdownMenuItem
              onSelect={() => {
                preventNextMenuAutoFocusRef.current = true;
                onStartRename(session.id, session.title);
              }}
              className={cn(
                'text-sm font-medium px-2.5 py-2 rounded-md cursor-pointer outline-none',
                'text-[var(--chat-sidebar-text)]',
                'hover:bg-[var(--chat-sidebar-row-hover)] focus:bg-[var(--chat-sidebar-row-hover)] data-[highlighted]:bg-[var(--chat-sidebar-row-hover)]',
                'focus:text-[var(--chat-sidebar-text)] data-[highlighted]:text-[var(--chat-sidebar-text)]'
              )}
            >
              <Icon name="common.rename" size="md" className="mr-2 text-[var(--chat-sidebar-icon)]" />
              <span>Rename</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation();
                onTogglePin(session.id, session.isPinned);
              }}
              className={cn(
                'text-sm font-medium px-2.5 py-2 rounded-md cursor-pointer outline-none',
                'text-[var(--chat-sidebar-text)]',
                'hover:bg-[var(--chat-sidebar-row-hover)] focus:bg-[var(--chat-sidebar-row-hover)] data-[highlighted]:bg-[var(--chat-sidebar-row-hover)]',
                'focus:text-[var(--chat-sidebar-text)] data-[highlighted]:text-[var(--chat-sidebar-text)]'
              )}
            >
              {session.isPinned ? (
                <Icon name="common.unpinPrimer" size={16} className="mr-2 text-[var(--chat-sidebar-icon)]" />
              ) : (
                <Icon name="common.pinPrimer" size={16} className="mr-2 text-[var(--chat-sidebar-icon)]" />
              )}
              <span>{session.isPinned ? 'Unpin' : 'Pin'}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-neutral-200 dark:bg-neutral-700 my-1 opacity-70" />
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation();
                onRequestDelete(session.id);
              }}
              className={cn(
                'text-sm font-medium px-2.5 py-2 rounded-md cursor-pointer outline-none',
                'text-red-600 dark:text-red-400',
                'hover:bg-[var(--chat-sidebar-row-hover)] focus:bg-[var(--chat-sidebar-row-hover)] data-[highlighted]:bg-[var(--chat-sidebar-row-hover)]',
                'focus:text-red-600 dark:focus:text-red-400 data-[highlighted]:text-red-600 dark:data-[highlighted]:text-red-400'
              )}
            >
              <DeleteIcon className="mr-2 text-current" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  );
}

export const ChatSidebarSessionRow = memo(
  ChatSidebarSessionRowInner,
  (prevProps, nextProps) =>
    prevProps.session === nextProps.session &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isRenaming === nextProps.isRenaming &&
    prevProps.onRenameDraftChange === nextProps.onRenameDraftChange &&
    prevProps.onStartRename === nextProps.onStartRename &&
    prevProps.onCommitRename === nextProps.onCommitRename &&
    prevProps.onCancelRename === nextProps.onCancelRename &&
    prevProps.onSwitch === nextProps.onSwitch &&
    prevProps.onRequestDelete === nextProps.onRequestDelete &&
    prevProps.onTogglePin === nextProps.onTogglePin &&
    prevProps.onHideSearch === nextProps.onHideSearch &&
    prevProps.shouldHideSearchResults === nextProps.shouldHideSearchResults &&
    (!prevProps.isRenaming || prevProps.renameDraft === nextProps.renameDraft)
);
