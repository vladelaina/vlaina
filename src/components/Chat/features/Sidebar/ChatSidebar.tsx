import { useMemo, useEffect, useRef, useState } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { cn, iconButtonStyles } from '@/lib/utils';
import { isTemporarySession } from '@/lib/ai/temporaryChat';
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

type DateGroup = 'Pinned' | 'Today' | 'Yesterday' | 'Previous 7 Days' | 'Previous 30 Days' | 'Older';

const GROUP_ORDER: DateGroup[] = [
  'Pinned',
  'Today',
  'Yesterday',
  'Previous 7 Days',
  'Previous 30 Days',
  'Older'
];

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

  const groupedSessions = useMemo(() => {
    const groups: Record<DateGroup, typeof sessions> = {
      'Pinned': [],
      'Today': [],
      'Yesterday': [],
      'Previous 7 Days': [],
      'Previous 30 Days': [],
      'Older': []
    };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const weekStart = todayStart - 6 * 86400000;
    const monthStart = todayStart - 29 * 86400000;

    [...visibleSessions].sort((a, b) => b.updatedAt - a.updatedAt).forEach(session => {
      if (session.isPinned) {
        groups['Pinned'].push(session);
        return;
      }

      const time = session.updatedAt;
      if (time >= todayStart) {
        groups['Today'].push(session);
      } else if (time >= yesterdayStart) {
        groups['Yesterday'].push(session);
      } else if (time >= weekStart) {
        groups['Previous 7 Days'].push(session);
      } else if (time >= monthStart) {
        groups['Previous 30 Days'].push(session);
      } else {
        groups['Older'].push(session);
      }
    });

    return groups;
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
      <div className={cn(
        "h-full flex flex-col bg-white dark:bg-[#171717]",
        isPeeking ? 'opacity-95' : ''
      )}>
        <div className="flex-1 overflow-y-auto px-2 py-2 neko-scrollbar">
          {!hasSessions ? (
             <div className="px-4 py-8 text-center text-xs text-gray-400">
                No conversations yet
              </div>
          ) : (
            <div className="flex flex-col gap-4">
              {GROUP_ORDER.map(groupName => {
                const groupSessions = groupedSessions[groupName];
                if (groupSessions.length === 0) return null;

                return (
                  <div key={groupName} className="flex flex-col gap-0.5">
                    {groupSessions.map(session => {
                      const isActive = currentSessionId === session.id;
                      const isGenerating = isSessionLoading(session.id);
                      const isUnread = isSessionUnread(session.id);
                      const isRenaming = renamingSessionId === session.id;
                      const displayTitle = session.title || 'New Chat';
                      const statusIndicator = isGenerating && !isActive ? (
                        <div className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)] animate-pulse" />
                      ) : isUnread ? (
                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm" />
                      ) : null;

                      return (
                        <div
                          key={session.id}
                          className={cn(
                            "group relative flex items-center px-3 py-2 rounded-lg text-sm cursor-pointer transition-all duration-200 ease-out",
                            isActive 
                              ? "bg-[#f5f5f5] dark:bg-[#222] text-gray-900 dark:text-gray-100 font-medium" 
                              : "text-gray-600 dark:text-gray-400 hover:bg-[#F9F9FA] dark:hover:bg-[#1E1E1E]"
                          )}
                          onClick={() => {
                            if (isRenaming) {
                              return;
                            }
                            handleSwitch(session.id, isUnread);
                          }}
                        >
                          <div className="flex-1 truncate relative z-10 pr-8">
                            {isRenaming ? (
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
                                  "w-full min-w-0 bg-transparent border-none outline-none p-0 m-0",
                                  "text-sm leading-5",
                                  (isGenerating || isUnread)
                                    ? "font-medium text-gray-900 dark:text-gray-100"
                                    : "text-gray-600 dark:text-gray-400"
                                )}
                              />
                            ) : (
                              <span className={cn(
                                  "truncate transition-opacity block", 
                                  (isGenerating || isUnread) && "font-medium text-gray-900 dark:text-gray-100"
                              )}>
                                  {displayTitle}
                              </span>
                            )}
                          </div>

                          {statusIndicator && !isActive ? (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 pointer-events-none group-hover:opacity-0">
                              {statusIndicator}
                            </div>
                          ) : null}

                          <div 
                            className={cn(
                              "absolute right-1 top-1/2 -translate-y-1/2 flex items-center z-20",
                              "transition-opacity duration-200",
                              isActive
                                ? "opacity-100 pointer-events-auto"
                                : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
                            )}
                            onClick={(e) => e.stopPropagation()} 
                          >
                             <div className={cn(
                                "absolute right-full top-0 h-full w-8 bg-gradient-to-l pointer-events-none",
                                isActive 
                                  ? "from-[#f5f5f5] to-transparent dark:from-[#222]" 
                                  : "from-white to-transparent dark:from-[#171717] group-hover:from-[#F9F9FA] dark:group-hover:from-[#1E1E1E]"
                            )} />
                            
                            <DropdownMenu>
                                <DropdownMenuTrigger 
                                    onClick={(e) => { e.stopPropagation(); }}
                                    className={cn(
                                        "p-1 rounded-md focus:outline-none",
                                        iconButtonStyles,
                                        isActive 
                                          ? "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" 
                                          : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
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
                                        <Icon name="common.pin" size="md" className="mr-2 text-neutral-500 dark:text-neutral-400" />
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
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
