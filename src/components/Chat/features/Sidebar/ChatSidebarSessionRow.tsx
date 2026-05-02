import { memo, useCallback, useRef, useState } from 'react';
import { useAIUIStore } from '@/stores/ai/chatState';
import { actions as aiActions } from '@/stores/useAIStore';
import { cn, iconButtonStyles } from '@/lib/utils';
import { getSidebarLabelClass } from '@/components/layout/sidebar/sidebarLabelStyles';
import { SidebarRowActionButton } from '@/components/layout/sidebar/SidebarRow';
import { SidebarContextMenu } from '@/components/layout/sidebar/SidebarContextMenu';
import { useSidebarHoverPrefetch } from '@/components/layout/sidebar/useSidebarHoverPrefetch';
import {
  SidebarContextMenuContent,
  type SidebarMenuEntry,
} from '@/components/layout/sidebar/context-menu/SidebarContextMenuContent';
import { MENU_PANEL_CLASS_NAME } from '@/components/layout/sidebar/context-menu/shared';
import { getSidebarContextMenuPosition } from '@/components/layout/sidebar/sidebarMenuPosition';
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
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ top: 0, left: 0 });
  const isGenerating = useAIUIStore((state) => !!state.generatingSessions[session.id]);
  const isUnread = useAIUIStore((state) => !!state.unreadSessions[session.id]);
  const displayTitle = session.title || 'New Chat';
  const showMenuByDefault = isActive && !session.isPinned;
  const hoverPrefetch = useSidebarHoverPrefetch(
    useCallback(() => aiActions.prefetchSession(session.id), [session.id]),
    { enabled: !isActive && !isRenaming },
  );
  const handleStartRename = () => {
    preventNextMenuAutoFocusRef.current = true;
    onStartRename(session.id, session.title);
    setShowContextMenu(false);
  };
  const handleTogglePin = () => {
    onTogglePin(session.id, session.isPinned);
    setShowContextMenu(false);
  };
  const handleRequestDelete = () => {
    onRequestDelete(session.id);
    setShowContextMenu(false);
  };
  const contextMenuEntries: SidebarMenuEntry[] = [
    {
      key: 'rename',
      icon: <Icon name="common.rename" size="md" />,
      label: 'Rename',
      onClick: handleStartRename,
    },
    {
      key: 'pin',
      icon: (
        <Icon
          name={session.isPinned ? 'common.unpinPrimer' : 'common.pinPrimer'}
          size={16}
        />
      ),
      label: session.isPinned ? 'Unpin' : 'Pin',
      onClick: handleTogglePin,
    },
    { kind: 'divider', key: 'delete-divider' },
    {
      key: 'delete',
      icon: <DeleteIcon className="text-current" />,
      label: 'Delete',
      onClick: handleRequestDelete,
      danger: true,
    },
  ];
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
      isHighlighted={showContextMenu}
      onMouseEnter={hoverPrefetch.onMouseEnter}
      onMouseLeave={hoverPrefetch.onMouseLeave}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenuPosition(
          getSidebarContextMenuPosition(event.currentTarget.getBoundingClientRect(), event.clientY),
        );
        setShowContextMenu(true);
      }}
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
              'w-full min-w-0 border-none bg-transparent p-0 text-[16px] leading-5 outline-none',
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
          <DropdownMenuTrigger asChild>
            <SidebarRowActionButton
              aria-label="Open chat session menu"
              className={cn(
                'p-1 rounded-md focus:outline-none',
                iconButtonStyles,
                isActive
                  ? 'text-[var(--chat-sidebar-icon-hover)] hover:text-[var(--chat-sidebar-text)]'
                  : 'text-[var(--chat-sidebar-icon)] hover:text-[var(--chat-sidebar-icon-hover)]'
              )}
            >
              <Icon name="common.more" size="md" />
            </SidebarRowActionButton>
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
              MENU_PANEL_CLASS_NAME,
              'w-44 !rounded-2xl !shadow-[var(--notes-sidebar-menu-shadow)] backdrop-blur-lg',
              'animate-in fade-in-0 zoom-in-95 duration-75'
            )}
          >
            <DropdownMenuItem
              onSelect={handleStartRename}
              className={cn(
                'text-[16px] font-medium px-2.5 py-2 rounded-md cursor-pointer outline-none',
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
                handleTogglePin();
              }}
              className={cn(
                'text-[16px] font-medium px-2.5 py-2 rounded-md cursor-pointer outline-none',
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
                handleRequestDelete();
              }}
              className={cn(
                'text-[16px] font-medium px-2.5 py-2 rounded-md cursor-pointer outline-none',
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
    >
      <SidebarContextMenu
        isOpen={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        position={contextMenuPosition}
      >
        <SidebarContextMenuContent entries={contextMenuEntries} />
      </SidebarContextMenu>
    </ChatSidebarRow>
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
