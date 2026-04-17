import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef, type RefObject } from 'react';
import { ChatSidebarVirtualList } from './ChatSidebarVirtualList';
import type { ChatSession } from '@/lib/ai/types';

const measureMock = vi.fn();

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 34,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        size: 34,
        start: index * 34,
      })),
    measure: measureMock,
  }),
}));

vi.mock('./ChatSidebarSessionRow', () => ({
  ChatSidebarSessionRow: ({
    session,
    isActive,
    isRenaming,
  }: {
    session: ChatSession;
    isActive: boolean;
    isRenaming: boolean;
  }) => (
    <div
      data-testid={`session-row-${session.id}`}
      data-active={isActive ? 'true' : 'false'}
      data-renaming={isRenaming ? 'true' : 'false'}
    >
      {session.title}
    </div>
  ),
}));

function buildSession(id: string, title: string): ChatSession {
  return {
    id,
    title,
    modelId: 'model-1',
    createdAt: 1,
    updatedAt: 1,
  };
}

function renderList({
  sessions = [buildSession('s1', 'Alpha'), buildSession('s2', 'Beta')],
  currentSessionId = 's1',
  renamingSessionId = 's2',
  resetKey = '',
  scrollRootRef = createRef<HTMLDivElement>(),
}: {
  sessions?: ChatSession[];
  currentSessionId?: string | null;
  renamingSessionId?: string | null;
  resetKey?: string;
  scrollRootRef?: RefObject<HTMLDivElement | null>;
}) {
  return render(
    <ChatSidebarVirtualList
      sessions={sessions}
      currentSessionId={currentSessionId}
      renamingSessionId={renamingSessionId}
      renameDraft=""
      shouldHideSearchResults={false}
      scrollRootRef={scrollRootRef}
      onRenameDraftChange={() => {}}
      onStartRename={() => {}}
      onCommitRename={() => {}}
      onCancelRename={() => {}}
      onSwitch={() => {}}
      onRequestDelete={() => {}}
      onTogglePin={() => {}}
      resetKey={resetKey}
    />,
  );
}

describe('ChatSidebarVirtualList', () => {
  beforeEach(() => {
    measureMock.mockClear();
  });

  it('renders rows and forwards active and renaming state', () => {
    renderList({});

    expect(screen.getByTestId('session-row-s1')).toHaveTextContent('Alpha');
    expect(screen.getByTestId('session-row-s1')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('session-row-s2')).toHaveAttribute('data-renaming', 'true');
    expect(measureMock).toHaveBeenCalled();
  });

  it('resets scroll position when resetKey changes', () => {
    const scrollRoot = document.createElement('div');
    const scrollToMock = vi.fn();
    scrollRoot.scrollTo = scrollToMock;
    const scrollRootRef = createRef<HTMLDivElement>();
    scrollRootRef.current = scrollRoot;

    const { rerender } = render(
      <ChatSidebarVirtualList
        sessions={[buildSession('s1', 'Alpha')]}
        currentSessionId="s1"
        renamingSessionId={null}
        renameDraft=""
        shouldHideSearchResults={false}
        scrollRootRef={scrollRootRef}
        onRenameDraftChange={() => {}}
        onStartRename={() => {}}
        onCommitRename={() => {}}
        onCancelRename={() => {}}
        onSwitch={() => {}}
        onRequestDelete={() => {}}
        onTogglePin={() => {}}
        resetKey=""
      />,
    );

    scrollToMock.mockClear();

    rerender(
      <ChatSidebarVirtualList
        sessions={[buildSession('s1', 'Alpha')]}
        currentSessionId="s1"
        renamingSessionId={null}
        renameDraft=""
        shouldHideSearchResults={false}
        scrollRootRef={scrollRootRef}
        onRenameDraftChange={() => {}}
        onStartRename={() => {}}
        onCommitRename={() => {}}
        onCancelRename={() => {}}
        onSwitch={() => {}}
        onRequestDelete={() => {}}
        onTogglePin={() => {}}
        resetKey="alpha"
      />,
    );

    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('renders nothing for an empty session list', () => {
    const { container } = renderList({ sessions: [] });
    expect(container).toBeEmptyDOMElement();
  });
});
