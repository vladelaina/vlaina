import { useCallback, useEffect, useRef, useState } from 'react';
import { actions as aiActions } from '@/stores/useAIStore';
import { useAIUIStore } from '@/stores/ai/chatState';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useUIStore } from '@/stores/uiSlice';
import {
  ChatSidebarHoverEmptyHint,
  ChatSidebarList,
  ChatSidebarScrollArea,
  ChatSidebarSurface,
} from './ChatSidebarPrimitives';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { focusComposerInput } from '@/lib/ui/composerFocusRegistry';
import { ChatSidebarTopActions } from './ChatSidebarTopActions';
import { SidebarSearchDrawer } from '@/components/layout/sidebar/SidebarSearchDrawer';
import { ChatSidebarVirtualList } from './ChatSidebarVirtualList';
import { useChatSidebarSearch } from './useChatSidebarSearch';

interface ChatSidebarProps {
  isPeeking?: boolean;
}

export function ChatSidebar({ isPeeking = false }: ChatSidebarProps) {
  const appViewMode = useUIStore((state) => state.appViewMode);
  const setAppViewMode = useUIStore((state) => state.setAppViewMode);
  const sessions = useUnifiedStore((state) => state.data.ai?.sessions || []);
  const currentSessionId = useAIUIStore((state) => state.currentSessionId);
  const markSessionRead = useAIUIStore((state) => state.markSessionRead);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const sidebarRootRef = useRef<HTMLDivElement | null>(null);
  const {
    inputRef: searchInputRef,
    scrollRootRef,
    hideSearch,
    handleScroll,
    shouldShowSearchResults,
    isSearchOpen,
    searchQuery,
    deferredSearchQuery,
    setSearchQuery,
    filteredSessions,
    hasSessions,
    sessionsToRender,
  } = useChatSidebarSearch({
    enabled: appViewMode === 'chat',
    scopeRef: sidebarRootRef,
    sessions,
  });

  useEffect(() => {
    const handleDeleteChat = (event: Event) => {
      const customEvent = event as CustomEvent<{ id?: string }>;
      if (customEvent.detail?.id) {
        setDeleteId(customEvent.detail.id);
      }
    };

    window.addEventListener('vlaina-delete-chat', handleDeleteChat);
    return () => {
      window.removeEventListener('vlaina-delete-chat', handleDeleteChat);
    };
  }, []);

  const handleRename = useCallback((sessionId: string, currentTitle: string) => {
    setRenamingSessionId(sessionId);
    setRenameDraft(currentTitle || 'New Chat');
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingSessionId(null);
    setRenameDraft('');
  }, []);

  const commitRename = useCallback((sessionId: string, originalTitle: string) => {
    const nextTitle = renameDraft.trim();
    if (!nextTitle) {
      cancelRename();
      return;
    }
    if (nextTitle !== originalTitle) {
      aiActions.updateSession(sessionId, { title: nextTitle });
    }
    cancelRename();
  }, [cancelRename, renameDraft]);

  const handleTogglePin = useCallback((sessionId: string, isPinned?: boolean) => {
    aiActions.updateSession(sessionId, { isPinned: !isPinned });
  }, []);

  const handleSwitch = useCallback((sessionId: string, isUnread: boolean) => {
    if (isUnread) {
      markSessionRead(sessionId);
    }
    void aiActions.switchSession(sessionId);
  }, [markSessionRead]);

  const handleOpenNewChat = useCallback(() => {
    aiActions.openNewChat();
    requestAnimationFrame(() => {
      if (focusComposerInput()) {
        return;
      }
      requestAnimationFrame(() => {
        focusComposerInput();
      });
    });
  }, []);

  const handleRenameDraftChange = useCallback((value: string) => {
    setRenameDraft(value);
  }, []);

  const handleRequestDelete = useCallback((sessionId: string) => {
    setDeleteId(sessionId);
  }, []);

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
            handleSwitch(session.id, !!useAIUIStore.getState().unreadSessions[session.id]);
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

        <ChatSidebarScrollArea ref={scrollRootRef} onScroll={handleScroll}>
          <div className="relative min-h-full">
            {shouldShowSearchResults && filteredSessions.length === 0 ? null : !shouldShowSearchResults && !hasSessions ? null : (
              <ChatSidebarList>
                <ChatSidebarVirtualList
                  sessions={sessionsToRender}
                  currentSessionId={currentSessionId}
                  renamingSessionId={renamingSessionId}
                  renameDraft={renameDraft}
                  shouldHideSearchResults={shouldShowSearchResults}
                  scrollRootRef={scrollRootRef}
                  onRenameDraftChange={handleRenameDraftChange}
                  onStartRename={handleRename}
                  onCommitRename={commitRename}
                  onCancelRename={cancelRename}
                  onSwitch={handleSwitch}
                  onRequestDelete={handleRequestDelete}
                  onTogglePin={handleTogglePin}
                  onHideSearch={hideSearch}
                  resetKey={shouldShowSearchResults ? deferredSearchQuery.trim() : ''}
                />
              </ChatSidebarList>
            )}
            {!shouldShowSearchResults && !hasSessions ? (
              <ChatSidebarHoverEmptyHint title="No conversations yet" />
            ) : null}
          </div>
        </ChatSidebarScrollArea>
      </ChatSidebarSurface>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            void aiActions.deleteSession(deleteId);
          }
        }}
        title="Delete Chat?"
        description="Are you sure you want to delete this chat session? This action cannot be undone."
        confirmText="Delete Chat"
        variant="danger"
      />
    </>
  );
}
