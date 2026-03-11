import { useMemo, useEffect, useRef, useState } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { cn, iconButtonStyles } from '@/lib/utils';
import { isTemporarySession } from '@/lib/ai/temporaryChat';
import { ChatSidebarList, ChatSidebarRow, ChatSidebarScrollArea, ChatSidebarSurface } from './ChatSidebarPrimitives';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DeleteIcon } from '@/components/common/DeleteIcon';
import { Icon } from '@/components/ui/icons';

interface ChatSidebarProps {
  isPeeking?: boolean;
}

export function ChatSidebar({ isPeeking = false }: ChatSidebarProps) {
  const {
      sessions,
      currentSessionId,
      openNewChat,
      switchSession,
      deleteSession,
      updateSession,
      isSessionLoading,
      isSessionUnread,
      markSessionRead
  } = useAIStore();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const preventNextMenuAutoFocusRef = useRef(false);
  const visibleSessions = useMemo(
    () => sessions.filter((session) => !isTemporarySession(session)),
    [sessions]
  );

  useEffect(() => {
    if (!renamingSessionId) {
      return;
    }
    const input = renameInputRef.current;
    if (!input) {
      return;
    }
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }, [renamingSessionId]);

  useEffect(() => {
    const handleCreateNew = (e: Event) => {
        const customEvent = e as CustomEvent;
        if (customEvent.detail?.view === 'chat') {
            openNewChat();
        }
    };

    const handleDeleteChat = (e: Event) => {
        const customEvent = e as CustomEvent;
        if (customEvent.detail?.id) {
            setDeleteId(customEvent.detail.id);
        }
    };

    window.addEventListener('neko-create-new', handleCreateNew);
    window.addEventListener('neko-delete-chat', handleDeleteChat);

    return () => {
        window.removeEventListener('neko-create-new', handleCreateNew);
        window.removeEventListener('neko-delete-chat', handleDeleteChat);
    };
  }, [openNewChat]);

  const sortedSessions = useMemo(() => {
    return [...visibleSessions].sort((a, b) => {
      const pinDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
      if (pinDiff !== 0) {
        return pinDiff;
      }
      return b.updatedAt - a.updatedAt;
    });
  }, [visibleSessions]);

  const handleRename = (sessionId: string, currentTitle: string) => {
      setRenamingSessionId(sessionId);
      setRenameDraft(currentTitle || 'New Chat');
  };

  const cancelRename = () => {
      setRenamingSessionId(null);
      setRenameDraft('');
  };

  const commitRename = (sessionId: string, originalTitle: string) => {
      const nextTitle = renameDraft.trim();
      if (!nextTitle) {
          cancelRename();
          return;
      }
      if (nextTitle !== originalTitle) {
          updateSession(sessionId, { title: nextTitle });
      }
      cancelRename();
  };

  const handleTogglePin = (sessionId: string, isPinned?: boolean) => {
      updateSession(sessionId, { isPinned: !isPinned });
  };

  const handleSwitch = (sessionId: string, isUnread: boolean) => {
      if (isUnread) markSessionRead(sessionId);
      switchSession(sessionId);
  };

  const hasSessions = visibleSessions.length > 0;

  return (
    <>
      <ChatSidebarSurface isPeeking={isPeeking}>
        <ChatSidebarScrollArea>
          {!hasSessions ? (
             <div className="px-4 py-8 text-center text-xs text-[var(--chat-sidebar-text-soft)]">
                No conversations yet
              </div>
          ) : (
            <ChatSidebarList>
              {sortedSessions.map(session => {
                const isActive = currentSessionId === session.id;
                const isGenerating = isSessionLoading(session.id);
                const isUnread = isSessionUnread(session.id);
                const isRenaming = renamingSessionId === session.id;
                const displayTitle = session.title || 'New Chat';
                const showMenuByDefault = isActive && !session.isPinned;
                const statusIndicator = isGenerating && !isActive ? (
                  <div className="h-2 w-2 rounded-full bg-[var(--chat-sidebar-status-warning)] shadow-[0_0_8px_rgba(245,158,11,0.45)] animate-pulse" />
                ) : isUnread ? (
                  <div className="h-2 w-2 rounded-full bg-[var(--chat-sidebar-status-info)] shadow-sm" />
                ) : session.isPinned ? (
                  <Icon name="common.pinPrimer" size={14} className="text-[var(--chat-sidebar-pin)]" />
                ) : null;

                return (
                  <ChatSidebarRow
                    key={session.id}
                    isActive={isActive}
                    showActionsByDefault={showMenuByDefault}
                    onClick={() => {
                      if (isRenaming) {
                        return;
                      }
                      handleSwitch(session.id, isUnread);
                    }}
                    main={
                      isRenaming ? (
                        <input
                          ref={renameInputRef}
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                          onBlur={() => commitRename(session.id, displayTitle)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              commitRename(session.id, displayTitle);
                            }
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              cancelRename();
                            }
                          }}
                          className={cn(
                            'w-full min-w-0 border-none bg-transparent p-0 text-sm leading-5 outline-none',
                            isGenerating || isUnread
                              ? 'font-medium text-[var(--chat-sidebar-text)]'
                              : 'text-[var(--chat-sidebar-text-muted)]'
                          )}
                        />
                      ) : (
                        <span
                          className={cn(
                            'block truncate transition-opacity',
                            isGenerating || isUnread
                              ? 'font-medium text-[var(--chat-sidebar-text)]'
                              : undefined
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
                              onClick={(e) => { e.stopPropagation(); }}
                              className={cn(
                                  "p-1 rounded-md focus:outline-none",
                                  iconButtonStyles,
                                  isActive
                                    ? "text-[var(--chat-sidebar-icon-hover)] hover:text-[var(--chat-sidebar-text)]"
                                    : "text-[var(--chat-sidebar-icon)] hover:text-[var(--chat-sidebar-icon-hover)]"
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
                                  "w-44 p-1.5 rounded-2xl bg-white dark:bg-neutral-800",
                                  "border border-neutral-100 dark:border-neutral-600/40",
                                  "backdrop-blur-lg shadow-xl",
                                  "animate-in fade-in-0 zoom-in-95 duration-75"
                              )}
                          >
                              <DropdownMenuItem
                                  onSelect={() => {
                                      preventNextMenuAutoFocusRef.current = true;
                                      handleRename(session.id, session.title);
                                  }}
                                  className={cn(
                                    "text-sm font-medium px-2.5 py-2 rounded-md cursor-pointer outline-none",
                                    "text-neutral-700 dark:text-neutral-200",
                                    "hover:bg-neutral-100 focus:bg-neutral-100 dark:hover:bg-neutral-700/60 dark:focus:bg-neutral-700/60"
                                  )}
                              >
                                  <Icon name="common.rename" size="md" className="mr-2 text-neutral-500 dark:text-neutral-400" />
                                  <span>Rename</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      handleTogglePin(session.id, session.isPinned);
                                  }}
                                  className={cn(
                                    "text-sm font-medium px-2.5 py-2 rounded-md cursor-pointer outline-none",
                                    "text-neutral-700 dark:text-neutral-200",
                                    "hover:bg-neutral-100 focus:bg-neutral-100 dark:hover:bg-neutral-700/60 dark:focus:bg-neutral-700/60"
                                  )}
                              >
                                  {session.isPinned ? (
                                    <Icon name="common.unpinPrimer" size={16} className="mr-2 text-neutral-500 dark:text-neutral-400" />
                                  ) : (
                                    <Icon name="common.pinPrimer" size={16} className="mr-2 text-neutral-500 dark:text-neutral-400" />
                                  )}
                                  <span>{session.isPinned ? 'Unpin' : 'Pin'}</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-neutral-200 dark:bg-neutral-700 my-1 opacity-70" />
                              <DropdownMenuItem
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteId(session.id);
                                  }}
                                  className={cn(
                                    "text-sm font-medium px-2.5 py-2 rounded-md cursor-pointer outline-none",
                                    "text-red-600 dark:text-red-400",
                                    "hover:bg-red-50 focus:bg-red-50 dark:hover:bg-red-900/20 dark:focus:bg-red-900/20"
                                  )}
                              >
                                  <DeleteIcon className="mr-2" />
                                  <span>Delete</span>
                              </DropdownMenuItem>
                          </DropdownMenuContent>
                      </DropdownMenu>
                    }
                  />
                );
              })}
            </ChatSidebarList>
          )}
        </ChatSidebarScrollArea>
      </ChatSidebarSurface>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
            if (deleteId) deleteSession(deleteId);
        }}
        title="Delete Chat"
        description="Are you sure you want to delete this chat session? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </>
  );
}
