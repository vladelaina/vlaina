import { useMemo, useEffect, useState } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
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

    [...sessions].sort((a, b) => b.updatedAt - a.updatedAt).forEach(session => {
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
  }, [sessions]);

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

  const hasSessions = sessions.length > 0;

  return (
    <>
      <div className={cn(
        "h-full flex flex-col bg-white dark:bg-[#171717]",
        isPeeking ? 'opacity-95' : ''
      )}>
        <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-none">
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
                          <div className="flex-1 truncate relative z-10 flex items-center gap-2">
                             {isGenerating && !isActive ? (
                                <div className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)] animate-pulse flex-shrink-0" title="Generating..." />
                            ) : isUnread ? (
                                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm flex-shrink-0" title="New messages" />
                            ) : null}
                            
                            <span className={cn(
                                "truncate transition-opacity block", 
                                (isGenerating || isUnread) && "font-medium text-gray-900 dark:text-gray-100"
                            )}>
                                {session.title || 'New Chat'}
                            </span>
                          </div>

                          <div 
                            className={cn(
                              "absolute right-1 top-1/2 -translate-y-1/2 flex items-center z-20",
                              "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                              isActive && "opacity-100"
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
                                        "p-1 rounded-md transition-colors focus:outline-none",
                                        isActive 
                                          ? "text-gray-500 hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/10" 
                                          : "text-gray-400 hover:bg-gray-200/50 dark:hover:bg-zinc-700"
                                    )}
                                >
                                    <Icon name="common.more" size="md" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 bg-white dark:bg-[#1C1C1C]">
                                    <DropdownMenuItem onClick={(e) => {
                                        e.stopPropagation();
                                        handleRename(session.id, session.title);
                                    }}>
                                        <Icon name="ai.rename" className="mr-2 h-4 w-4 text-gray-500" />
                                        <span>Rename</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => {
                                        e.stopPropagation();
                                        handleTogglePin(session.id, session.isPinned);
                                    }}>
                                        <Icon name="ai.pin" className="mr-2 h-4 w-4 text-gray-500" />
                                        <span>{session.isPinned ? 'Unpin' : 'Pin'}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteId(session.id);
                                        }}
                                        className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                                    >
                                        <Icon name="common.delete" className="mr-2 h-4 w-4" />
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