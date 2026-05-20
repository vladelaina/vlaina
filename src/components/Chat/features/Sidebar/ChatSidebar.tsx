import { memo, useCallback, useEffect, useRef, useState } from 'react';
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
import {
  SidebarCapsulePanel,
  SIDEBAR_CAPSULE_SCROLLBAR_INSET_RIGHT,
} from '@/components/layout/sidebar/SidebarPrimitives';
import { ChatSidebarVirtualList } from './ChatSidebarVirtualList';
import { useChatSidebarSearch } from './useChatSidebarSearch';
import { useI18n } from '@/lib/i18n';

interface ChatSidebarProps {
  isPeeking?: boolean;
  embedded?: boolean;
  onRequestClose?: () => void;
}

export const ChatSidebar = memo(function ChatSidebar({ isPeeking = false, embedded = false, onRequestClose }: ChatSidebarProps) {
  const { t } = useI18n();
  const appViewMode = useUIStore((state) => state.appViewMode);
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
    enabled: embedded || appViewMode === 'chat',
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
    setRenameDraft(currentTitle || 'New');
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
    onRequestClose?.();
  }, [markSessionRead, onRequestClose]);

  const handleOpenNewChat = useCallback(() => {
    aiActions.openNewChat();
    onRequestClose?.();
    requestAnimationFrame(() => {
      if (focusComposerInput()) {
        return;
      }
      requestAnimationFrame(() => {
        focusComposerInput();
      });
    });
  }, [onRequestClose]);

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
          shouldShowTopActions={false}
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
          placeholder=""
          closeLabel={t('sidebar.closeChatSearch')}
          topActions={null}
        />

        <SidebarCapsulePanel>
          {!shouldShowSearchResults ? (
            <ChatSidebarTopActions
              onOpenNewChat={handleOpenNewChat}
            />
          ) : null}

          <ChatSidebarScrollArea
            ref={scrollRootRef}
            onScroll={handleScroll}
            scrollbarInsetRight={SIDEBAR_CAPSULE_SCROLLBAR_INSET_RIGHT}
          >
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
                <ChatSidebarHoverEmptyHint title={t('sidebar.noConversations')} />
              ) : null}
            </div>
          </ChatSidebarScrollArea>
        </SidebarCapsulePanel>
      </ChatSidebarSurface>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            void aiActions.deleteSession(deleteId);
          }
        }}
        title={t('sidebar.deleteChatTitle')}
        description={t('sidebar.deleteChatDescription')}
        confirmText={t('sidebar.deleteChat')}
        variant="danger"
      />
    </>
  );
});
