import { useMemo, useEffect, useState } from 'react';
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
  const visibleSessions = useMemo(
    () => sessions.filter((session) => !isTemporarySession(session)),
    [sessions]
  );

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
      const newTitle = window.prompt("Rename chat", currentTitle);
      if (newTitle && newTitle.trim()) {
          updateSession(sessionId, { title: newTitle.trim() });
      }
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
                          onClick={() => handleSwitch(session.id, isUnread)}
                        >
                          <div className="flex-1 truncate relative z-10 pr-8">
                            <span className={cn(
                                "truncate transition-opacity block", 
                                (isGenerating || isUnread) && "font-medium text-gray-900 dark:text-gray-100"
                            )}>
                                {session.title || 'New Chat'}
                            </span>
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
                                    className={cn(
                                        "w-40 p-1 rounded-lg bg-[var(--neko-bg-primary)] dark:bg-[#1C1C1C]",
                                        "border border-[var(--neko-border)] shadow-xl",
                                        "animate-in fade-in-0 zoom-in-95"
                                    )}
                                >
                                    <DropdownMenuItem 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRename(session.id, session.title);
                                        }}
                                        className="text-xs px-2 py-1.5 rounded-md cursor-pointer hover:bg-[var(--neko-hover)] focus:bg-[var(--neko-hover)] outline-none"
                                    >
                                        <Icon name="common.rename" size="md" className="mr-2 text-[var(--neko-text-secondary)]" />
                                        <span className="text-[var(--neko-text-primary)]">Rename</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleTogglePin(session.id, session.isPinned);
                                        }}
                                        className="text-xs px-2 py-1.5 rounded-md cursor-pointer hover:bg-[var(--neko-hover)] focus:bg-[var(--neko-hover)] outline-none"
                                    >
                                        <Icon name="common.pin" size="md" className="mr-2 text-[var(--neko-text-secondary)]" />
                                        <span className="text-[var(--neko-text-primary)]">{session.isPinned ? 'Unpin' : 'Pin'}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-[var(--neko-border)] my-1 opacity-50" />
                                    <DropdownMenuItem 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteId(session.id);
                                        }}
                                        className="text-xs px-2 py-1.5 rounded-md cursor-pointer text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 focus:bg-red-50 outline-none"
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
