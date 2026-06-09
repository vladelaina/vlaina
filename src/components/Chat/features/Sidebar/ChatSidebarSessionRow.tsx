import { memo, useCallback, useState, type MouseEvent } from 'react';
import { useAIUIStore } from '@/stores/ai/chatState';
import { actions as aiActions } from '@/stores/useAIStore';
import { cn, iconButtonStyles } from '@/lib/utils';
import { getSidebarLabelClass } from '@/components/layout/sidebar/sidebarLabelStyles';
import { SidebarRowActionButton } from '@/components/layout/sidebar/SidebarRow';
import { SidebarContextMenu } from '@/components/layout/sidebar/SidebarContextMenu';
import { useSidebarHoverPrefetch } from '@/components/layout/sidebar/useSidebarHoverPrefetch';
import { desktopWindow } from '@/lib/desktop/window';
import {
  SidebarContextMenuContent,
  type SidebarMenuEntry,
} from '@/components/layout/sidebar/context-menu/SidebarContextMenuContent';
import { getSidebarContextMenuPosition } from '@/components/layout/sidebar/sidebarMenuPosition';
import { ChatSidebarRow } from './ChatSidebarPrimitives';
import { DeleteIcon } from '@/components/common/DeleteIcon';
import { Icon } from '@/components/ui/icons';
import { SidebarInlineRenameInput } from '@/components/layout/sidebar/SidebarInlineRenameInput';
import type { ChatSession } from '@/lib/ai/types';
import { useI18n } from '@/lib/i18n';
import {
  CHAT_SIDEBAR_SESSION_ROW_VERTICAL_PADDING_CLASS,
  CHAT_SIDEBAR_TITLE_WRAP_CLASS,
} from './chatSidebarLayout';
import { themeIconTokens } from '@/styles/themeTokens';

interface ChatSidebarSessionRowProps {
  session: ChatSession;
  isActive: boolean;
  isKeyboardHighlighted?: boolean;
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

function getChatSessionTitleClass({
  isActive,
  isGenerating,
  isUnread,
}: {
  isActive: boolean;
  isGenerating: boolean;
  isUnread: boolean;
}) {
  return cn(
    isActive
      ? 'text-[var(--vlaina-sidebar-row-selected-text)]'
      : getSidebarLabelClass('chat', { emphasized: isGenerating || isUnread })
  );
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
  isKeyboardHighlighted = false,
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
  const { t } = useI18n();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ top: 0, left: 0 });
  const isGenerating = useAIUIStore((state) => !!state.generatingSessions[session.id]);
  const isUnread = useAIUIStore((state) => !!state.unreadSessions[session.id]);
  const displayTitle = session.title || 'New';
  const cancelHoverPrefetch = useCallback(() => {
    aiActions.cancelSessionPrefetch(session.id);
  }, [session.id]);
  const hoverPrefetch = useSidebarHoverPrefetch(
    useCallback(() => aiActions.prefetchSession(session.id), [session.id]),
    {
      enabled: !isActive && !isRenaming,
      cancel: cancelHoverPrefetch,
    },
  );
  const handleStartRename = () => {
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
  const handleRenameFromDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (
      isRenaming ||
      target?.closest('button,a,input,textarea,select,[role="button"]')
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onStartRename(session.id, session.title);
    setShowContextMenu(false);
  };
  const handleOpenInNewWindow = () => {
    void desktopWindow.create({
      viewMode: 'chat',
      chatSessionId: session.id,
    });
    if (isActive) {
      aiActions.openNewChat();
    }
    setShowContextMenu(false);
  };
  const contextMenuEntries: SidebarMenuEntry[] = [
    {
      key: 'rename',
      icon: <Icon name="common.rename" size="md" />,
      label: t('sidebar.rename'),
      onClick: handleStartRename,
    },
    {
      key: 'pin',
      icon: (
        <Icon
          name={session.isPinned ? 'common.unpinPrimer' : 'common.pinPrimer'}
          size={themeIconTokens.sizeRow}
        />
      ),
      label: session.isPinned ? t('sidebar.unpin') : t('sidebar.pin'),
      onClick: handleTogglePin,
    },
    {
      key: 'open-new-window',
      icon: <Icon name="file.folderOutput" size="md" />,
      label: t('sidebar.openInNewWindow'),
      onClick: handleOpenInNewWindow,
    },
    { kind: 'divider', key: 'delete-divider' },
    {
      key: 'delete',
      icon: <DeleteIcon className="text-current" />,
      label: t('sidebar.delete'),
      onClick: handleRequestDelete,
      danger: true,
    },
  ];
  const statusIndicator = isGenerating && !isActive ? (
    null
  ) : isUnread ? (
    <div className="h-2 w-2 rounded-full bg-[var(--vlaina-sidebar-chat-status-warning)]" />
  ) : session.isPinned ? (
    <Icon name="common.pinPrimer" size={themeIconTokens.sizeSm} className="text-[var(--vlaina-sidebar-chat-text)]" />
  ) : null;
  const titleClassName = getChatSessionTitleClass({
    isActive,
    isGenerating,
    isUnread,
  });

  return (
    <ChatSidebarRow
      isActive={isActive}
      showActionsByDefault={false}
      isHighlighted={showContextMenu || isKeyboardHighlighted}
      className={CHAT_SIDEBAR_SESSION_ROW_VERTICAL_PADDING_CLASS}
      aria-selected={isKeyboardHighlighted || undefined}
      data-chat-sidebar-session-row="true"
      onMouseEnter={hoverPrefetch.onMouseEnter}
      onMouseLeave={hoverPrefetch.onMouseLeave}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenuPosition(
          getSidebarContextMenuPosition(
            event.currentTarget.getBoundingClientRect(),
            event.clientY,
            event.clientX,
          ),
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
      onDoubleClick={handleRenameFromDoubleClick}
      main={
        isRenaming ? (
          <SidebarInlineRenameInput
            value={renameDraft}
            onValueChange={onRenameDraftChange}
            onSubmit={() => onCommitRename(session.id, displayTitle)}
            onCancel={onCancelRename}
            className={cn(
              'w-full min-w-0 border-none bg-transparent p-0 text-[var(--vlaina-font-base)] leading-5 outline-none',
              titleClassName
            )}
          />
        ) : isGenerating && !isActive ? (
          <span className={CHAT_SIDEBAR_TITLE_WRAP_CLASS}>
            <ChatSidebarLoadingTitle title={displayTitle} />
          </span>
        ) : (
          <span
            className={cn(
              CHAT_SIDEBAR_TITLE_WRAP_CLASS,
              'transition-opacity',
              titleClassName
            )}
          >
            {displayTitle}
          </span>
        )
      }
      trailing={statusIndicator}
      actions={
        <SidebarRowActionButton
          aria-label={t('sidebar.openChatSessionMenu')}
          onClick={(event) => {
            const rowElement = event.currentTarget.closest('[data-chat-sidebar-session-row="true"]');
            const rowRect = (rowElement ?? event.currentTarget).getBoundingClientRect();
            setContextMenuPosition(getSidebarContextMenuPosition(rowRect, event.clientY));
            setShowContextMenu((isOpen) => !isOpen);
          }}
          className={cn(
            'p-1 rounded-md focus:outline-none',
            iconButtonStyles,
            'text-[var(--vlaina-sidebar-chat-text)] hover:text-[var(--vlaina-accent)]',
          )}
        >
          <Icon name="common.more" size="md" />
        </SidebarRowActionButton>
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
    prevProps.isKeyboardHighlighted === nextProps.isKeyboardHighlighted &&
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
