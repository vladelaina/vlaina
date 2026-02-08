import { useMemo, useEffect, useState } from 'react';
import { MdMoreHoriz, MdDriveFileRenameOutline, MdPushPin, MdDelete } from 'react-icons/md';
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

interface ChatSidebarProps {
  isPeeking?: boolean;
}

export function ChatSidebar({ isPeeking = false }: ChatSidebarProps) {
  const { 
      sessions, 
      currentSessionId, 
      createSession, 
      openNewChat, // Added openNewChat
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
            openNewChat(); // Use lazy open
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
  }, [createSession]);

  const sortedSessions = useMemo(() => {
    return [...sessions]
        .filter(s => s.title && s.title.trim() !== '')
        .sort((a, b) => {
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
            return b.updatedAt - a.updatedAt;
        });
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

  return (
    <>
      <div className={cn(
        "h-full flex flex-col bg-white dark:bg-[#171717]",
        isPeeking ? 'opacity-95' : ''
      )}>
        <div className="flex-1 overflow-y-auto px-2 py-3 scrollbar-none">
          <div className="space-y-[2px]">
            {sortedSessions.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-gray-400">
                No conversations yet
              </div>
            ) : (
              sortedSessions.map(session => {
                const isActive = currentSessionId === session.id;
                const isGenerating = isSessionLoading(session.id);
                const isUnread = isSessionUnread(session.id);
                
                return (
                  <div
                    key={session.id}
                    className={cn(
                      "group relative flex items-center px-3 py-2 rounded-lg text-sm cursor-pointer transition-all duration-200 ease-out",
                      isActive 
                        ? "bg-[#F4F4F5] dark:bg-[#222] text-gray-800 dark:text-gray-200 font-medium" 
                        : "text-gray-600 dark:text-gray-400 hover:bg-[#F9F9FA] dark:hover:bg-[#1E1E1E]"
                    )}
                    onClick={() => handleSwitch(session.id, isUnread)}
                  >
                    <div className="flex-1 truncate relative z-10 flex items-center gap-2">
                      {isGenerating && !isActive ? (
                          <div className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)] animate-pulse flex-shrink-0" title="Generating in background..." />
                      ) : isUnread ? (
                          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)] flex-shrink-0" title="New messages" />
                      ) : session.isPinned ? (
                          <MdPushPin className="w-3 h-3 flex-shrink-0 text-gray-400" />
                      ) : null}
                      
                      <span className={cn(
                          "truncate transition-opacity", 
                          (isGenerating || isUnread) && "font-medium text-gray-900 dark:text-gray-100"
                      )}>
                          {session.title || 'New Chat'}
                      </span>
                    </div>

                    <div 
                      className={cn(
                        "absolute right-1 top-1/2 -translate-y-1/2 flex items-center z-20",
                        "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      )}
                      onClick={(e) => e.stopPropagation()} 
                    >
                      <div className={cn(
                          "absolute right-full top-0 h-full w-6 bg-gradient-to-l pointer-events-none",
                          isActive 
                            ? "from-[#F4F4F5] to-transparent dark:from-[#222]" 
                            : "from-white to-transparent dark:from-[#171717] group-hover:from-[#F9F9FA] dark:group-hover:from-[#1E1E1E]"
                      )} />
                      
                      <DropdownMenu>
                          <DropdownMenuTrigger 
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                  "p-1 rounded transition-colors focus:outline-none",
                                  isActive ? "text-gray-500 hover:bg-black/5" : "text-gray-400 hover:bg-gray-200/50 dark:hover:bg-zinc-700"
                              )}
                          >
                              <MdMoreHoriz className="w-4 h-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32 bg-white dark:bg-[#1C1C1C]">
                              <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  handleRename(session.id, session.title);
                              }}>
                                  <MdDriveFileRenameOutline className="mr-2 h-3.5 w-3.5 text-gray-500" />
                                  <span>Rename</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  handleTogglePin(session.id, session.isPinned);
                              }}>
                                  <MdPushPin className="mr-2 h-3.5 w-3.5 text-gray-500" />
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
                                  <MdDelete className="mr-2 h-3.5 w-3.5" />
                                  <span>Delete</span>
                              </DropdownMenuItem>
                          </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })
            )}
          </div>
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