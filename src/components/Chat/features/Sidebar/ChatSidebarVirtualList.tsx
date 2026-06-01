import { useEffect, useLayoutEffect, useMemo, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ChatSession } from '@/lib/ai/types';
import { ChatSidebarSessionRow } from './ChatSidebarSessionRow';
import {
  CHAT_SIDEBAR_ESTIMATED_SESSION_ROW_HEIGHT,
  CHAT_SIDEBAR_VIRTUALIZATION_THRESHOLD,
} from './chatSidebarLayout';
import { themeDomStyleTokens, themeImageBlockStyleTokens } from '@/styles/themeTokens';

interface ChatSidebarVirtualListProps {
  active?: boolean;
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
  highlightedSessionId?: string | null;
}

export function ChatSidebarVirtualList({
  active = true,
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
  highlightedSessionId,
}: ChatSidebarVirtualListProps) {
  const sessionIds = useMemo(() => sessions.map((session) => session.id), [sessions]);
  const shouldVirtualize = sessions.length > CHAT_SIDEBAR_VIRTUALIZATION_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: sessions.length,
    enabled: active && shouldVirtualize,
    getScrollElement: () => scrollRootRef.current,
    estimateSize: () => CHAT_SIDEBAR_ESTIMATED_SESSION_ROW_HEIGHT,
    overscan: 8,
  });

  useEffect(() => {
    if (!active || !resetKey) {
      return;
    }

    scrollRootRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [active, resetKey, scrollRootRef]);

  useLayoutEffect(() => {
    if (!active || !shouldVirtualize) {
      return;
    }

    virtualizer.measure();
  }, [active, sessionIds, shouldVirtualize, virtualizer]);

  useEffect(() => {
    if (!active || !highlightedSessionId) {
      return;
    }

    const highlightedIndex = sessionIds.indexOf(highlightedSessionId);
    if (highlightedIndex < 0) {
      return;
    }

    if (shouldVirtualize) {
      virtualizer.scrollToIndex(highlightedIndex, { align: 'auto' });
      return;
    }

    const row = Array.from(
      scrollRootRef.current?.querySelectorAll<HTMLElement>('[data-chat-sidebar-session-id]') ?? [],
    ).find((element) => element.dataset.chatSidebarSessionId === highlightedSessionId);
    row?.scrollIntoView?.({ block: 'nearest' });
  }, [active, highlightedSessionId, scrollRootRef, sessionIds, shouldVirtualize, virtualizer]);

  if (sessions.length === 0) {
    return null;
  }

  const renderSessionRow = (session: ChatSession) => (
    <ChatSidebarSessionRow
      session={session}
      isActive={currentSessionId === session.id}
      isKeyboardHighlighted={highlightedSessionId === session.id}
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
  );

  if (!shouldVirtualize) {
    return (
      <>
        {sessions.map((session) => (
          <div key={session.id} data-chat-sidebar-session-id={session.id}>
            {renderSessionRow(session)}
          </div>
        ))}
      </>
    );
  }

  return (
    <div
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        position: themeDomStyleTokens.positionRelative,
        width: themeImageBlockStyleTokens.widthFull,
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
            data-index={virtualRow.index}
            data-chat-sidebar-session-id={session.id}
            ref={virtualizer.measureElement}
            style={{
              left: themeDomStyleTokens.numericZero,
              position: themeDomStyleTokens.positionAbsolute,
              top: themeDomStyleTokens.numericZero,
              transform: `translateY(${virtualRow.start}px)`,
              width: themeImageBlockStyleTokens.widthFull,
            }}
          >
            {renderSessionRow(session)}
          </div>
        );
      })}
    </div>
  );
}
