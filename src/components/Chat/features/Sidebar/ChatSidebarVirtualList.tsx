import { useEffect, useMemo, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ChatSession } from '@/lib/ai/types';
import { ChatSidebarSessionRow } from './ChatSidebarSessionRow';

const CHAT_SIDEBAR_ROW_HEIGHT = 38;

interface ChatSidebarVirtualListProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  renamingSessionId: string | null;
  renameDraft: string;
  shouldHideSearchResults: boolean;
  scrollRootRef: RefObject<HTMLDivElement | null>;
  onRenameDraftChange: (value: string) => void;
  onStartRename: (sessionId: string, title: string) => void;
  onCommitRename: (sessionId: string, title: string) => void;
  onCancelRename: () => void;
  onSwitch: (sessionId: string, isUnread: boolean) => void;
  onRequestDelete: (sessionId: string) => void;
  onTogglePin: (sessionId: string, isPinned?: boolean) => void;
  onHideSearch?: () => void;
  resetKey?: string;
}

export function ChatSidebarVirtualList({
  sessions,
  currentSessionId,
  renamingSessionId,
  renameDraft,
  shouldHideSearchResults,
  scrollRootRef,
  onRenameDraftChange,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onSwitch,
  onRequestDelete,
  onTogglePin,
  onHideSearch,
  resetKey,
}: ChatSidebarVirtualListProps) {
  const sessionIds = useMemo(() => sessions.map((session) => session.id), [sessions]);
  const virtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => scrollRootRef.current,
    estimateSize: () => CHAT_SIDEBAR_ROW_HEIGHT,
    overscan: 8,
  });

  useEffect(() => {
    if (!resetKey) {
      return;
    }

    scrollRootRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [resetKey, scrollRootRef]);

  useEffect(() => {
    virtualizer.measure();
  }, [sessionIds, virtualizer]);

  if (sessions.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        position: 'relative',
        width: '100%',
      }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const session = sessions[virtualRow.index];
        if (!session) {
          return null;
        }

        return (
          <div
            key={session.id}
            style={{
              height: `${virtualRow.size}px`,
              left: 0,
              position: 'absolute',
              top: 0,
              transform: `translateY(${virtualRow.start}px)`,
              width: '100%',
            }}
          >
            <ChatSidebarSessionRow
              session={session}
              isActive={currentSessionId === session.id}
              isRenaming={renamingSessionId === session.id}
              renameDraft={renameDraft}
              onRenameDraftChange={onRenameDraftChange}
              onStartRename={onStartRename}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onSwitch={onSwitch}
              onRequestDelete={onRequestDelete}
              onTogglePin={onTogglePin}
              onHideSearch={onHideSearch}
              shouldHideSearchResults={shouldHideSearchResults}
            />
          </div>
        );
      })}
    </div>
  );
}
