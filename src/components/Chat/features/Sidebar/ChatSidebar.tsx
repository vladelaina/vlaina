import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { useUIStore } from '@/stores/uiSlice';
import { cn, iconButtonStyles } from '@/lib/utils';
import type { ChatSession } from '@/lib/ai/types';
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
import { focusComposerInput } from '@/lib/ui/composerFocusRegistry';
import { ChatSidebarTopActions } from './ChatSidebarTopActions';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { buildDuplicateLabelRegistry } from '@/lib/labels/disambiguation';
import {
  SidebarSearchDrawer,
  useSidebarSearchDrawerState,
} from '@/components/layout/sidebar/SidebarSearchDrawer';
import { SidebarInlineRenameInput } from '@/components/layout/sidebar/SidebarInlineRenameInput';

interface ChatSidebarProps {
  isPeeking?: boolean;
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

function formatChatDisambiguationDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
}

function formatChatDisambiguationTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function buildChatSessionDisambiguationRegistry(sessions: ChatSession[]) {
  return buildDuplicateLabelRegistry(
    sessions.map((session) => ({
      id: session.id,
      label: session.title || 'New Chat',
      hintSegments: [
        session.id.slice(-4).toUpperCase(),
        formatChatDisambiguationDate(session.createdAt),
        formatChatDisambiguationTime(session.createdAt),
      ],
    }))
  );
}

export function ChatSidebar({ isPeeking = false }: ChatSidebarProps) {
  const appViewMode = useUIStore((s) => s.appViewMode);
  const setAppViewMode = useUIStore((s) => s.setAppViewMode);
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const sidebarRootRef = useRef<HTMLDivElement | null>(null);
  const preventNextMenuAutoFocusRef = useRef(false);

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);
  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
  }, []);
  const toggleSearch = useCallback(() => {
    setIsSearchOpen((previous) => {
      const next = !previous;
      if (!next) {
        setSearchQuery('');
      }
      return next;
    });
  }, []);
  const {
    inputRef: searchInputRef,
    scrollRootRef,
    hideSearch,
    handleScroll,
    shouldShowSearchResults,
  } = useSidebarSearchDrawerState({
    isOpen: isSearchOpen,
    query: searchQuery,
    onOpen: openSearch,
    onClose: closeSearch,
    scopeRef: sidebarRootRef,
  });

  const visibleSessions = useMemo(
    () => sessions.filter((session) => !isTemporarySession(session)),
    [sessions]
  );

  useEffect(() => {
    const handleDeleteChat = (e: Event) => {
        const customEvent = e as CustomEvent;
        if (customEvent.detail?.id) {
            setDeleteId(customEvent.detail.id);
        }
    };

    window.addEventListener('vlaina-delete-chat', handleDeleteChat);

    return () => {
        window.removeEventListener('vlaina-delete-chat', handleDeleteChat);
    };
  }, []);

  useGlobalSearch(toggleSearch, appViewMode === 'chat');

  const sortedSessions = useMemo(() => {
    return [...visibleSessions].sort((a, b) => {
      const pinDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
      if (pinDiff !== 0) {
        return pinDiff;
      }
      return b.updatedAt - a.updatedAt;
    });
  }, [visibleSessions]);

  const filteredSessions = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    if (!trimmedQuery) {
      return [];
    }

    return sortedSessions.filter((session) =>
      (session.title || 'New Chat').toLowerCase().includes(trimmedQuery)
    );
  }, [searchQuery, sortedSessions]);

  const sessionDisambiguationRegistry = useMemo(
    () => buildChatSessionDisambiguationRegistry(visibleSessions),
    [visibleSessions]
  );

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

  const handleOpenNewChat = () => {
    openNewChat();
    requestAnimationFrame(() => {
      if (focusComposerInput()) {
        return;
      }
      requestAnimationFrame(() => {
        focusComposerInput();
      });
    });
  };

  const hasSessions = visibleSessions.length > 0;
  const sessionsToRender = shouldShowSearchResults ? filteredSessions : sortedSessions;

  return (
    <>
      <ChatSidebarSurface ref={sidebarRootRef} isPeeking={isPeeking}>
        <SidebarSearchDrawer
          isSearchOpen={isSearchOpen}
          shouldShowTopActions={!shouldShowSearchResults}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          inputRef={searchInputRef}
          hideSearch={hideSearch}
          canSubmit={Boolean(filteredSessions[0])}
          onSubmit={() => {
            const session = filteredSessions[0];
            if (!session) {
              return;
            }
            handleSwitch(session.id, isSessionUnread(session.id));
            hideSearch();
          }}
          placeholder="Search conversations..."
          closeLabel="Close chat search"
          topActions={(
            <ChatSidebarTopActions
              onOpenNewChat={handleOpenNewChat}
              onOpenNotes={() => setAppViewMode('notes')}
            />
          )}
        />

        <ChatSidebarScrollArea
          ref={scrollRootRef}
          onScroll={handleScroll}
        >
          {shouldShowSearchResults && filteredSessions.length === 0 ? null : !shouldShowSearchResults && !hasSessions ? null : (
            <ChatSidebarList>
              {sessionsToRender.map(session => {
                const isActive = currentSessionId === session.id;
                const isGenerating = isSessionLoading(session.id);
                const isUnread = isSessionUnread(session.id);
                const isRenaming = renamingSessionId === session.id;
                const displayTitle = session.title || 'New Chat';
                const disambiguation = sessionDisambiguationRegistry.get(session.id) ?? null;
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
                    key={session.id}
                    isActive={isActive}
                    showActionsByDefault={showMenuByDefault}
                    onClick={() => {
                      if (isRenaming) {
                        return;
                      }
                      handleSwitch(session.id, isUnread);
                      if (shouldShowSearchResults) {
                        hideSearch();
                      }
                    }}
                    main={
                      isRenaming ? (
                        <SidebarInlineRenameInput
                          value={renameDraft}
                          onValueChange={setRenameDraft}
                          onSubmit={() => commitRename(session.id, displayTitle)}
                          onCancel={cancelRename}
                          className={cn(
                            'w-full min-w-0 border-none bg-transparent p-0 text-sm leading-5 outline-none',
                            isGenerating || isUnread
                              ? 'font-medium text-[var(--chat-sidebar-text)]'
                              : 'text-[var(--chat-sidebar-text-muted)]'
                          )}
                        />
                      ) : (
                        isGenerating && !isActive ? (
                          <span className="block truncate">
                            <ChatSidebarLoadingTitle title={displayTitle} />
                            {disambiguation ? (
                              <span className="text-[11px] text-[var(--chat-sidebar-text-muted)]/80">{` · ${disambiguation}`}</span>
                            ) : null}
                          </span>
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
                            {disambiguation ? (
                              <span className="text-[11px] text-current/65">{` · ${disambiguation}`}</span>
                            ) : null}
                          </span>
                        )
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
                                    "text-[var(--chat-sidebar-text)]",
                                    "hover:bg-[var(--chat-sidebar-row-hover)] focus:bg-[var(--chat-sidebar-row-hover)] data-[highlighted]:bg-[var(--chat-sidebar-row-hover)]",
                                    "focus:text-[var(--chat-sidebar-text)] data-[highlighted]:text-[var(--chat-sidebar-text)]"
                                  )}
                              >
                                  <Icon name="common.rename" size="md" className="mr-2 text-[var(--chat-sidebar-icon)]" />
                                  <span>Rename</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      handleTogglePin(session.id, session.isPinned);
                                  }}
                                  className={cn(
                                    "text-sm font-medium px-2.5 py-2 rounded-md cursor-pointer outline-none",
                                    "text-[var(--chat-sidebar-text)]",
                                    "hover:bg-[var(--chat-sidebar-row-hover)] focus:bg-[var(--chat-sidebar-row-hover)] data-[highlighted]:bg-[var(--chat-sidebar-row-hover)]",
                                    "focus:text-[var(--chat-sidebar-text)] data-[highlighted]:text-[var(--chat-sidebar-text)]"
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
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteId(session.id);
                                  }}
                                  className={cn(
                                    "text-sm font-medium px-2.5 py-2 rounded-md cursor-pointer outline-none",
                                    "text-red-600 dark:text-red-400",
                                    "hover:bg-[var(--chat-sidebar-row-hover)] focus:bg-[var(--chat-sidebar-row-hover)] data-[highlighted]:bg-[var(--chat-sidebar-row-hover)]",
                                    "focus:text-red-600 dark:focus:text-red-400 data-[highlighted]:text-red-600 dark:data-[highlighted]:text-red-400"
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
        title="Delete Chat?"
        description="Are you sure you want to delete this chat session? This action cannot be undone."
        confirmText="Delete Chat"
        variant="danger"
      />
    </>
  );
}
