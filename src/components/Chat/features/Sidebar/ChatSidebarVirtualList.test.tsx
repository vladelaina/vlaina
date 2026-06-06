import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef, type RefObject } from 'react';
import {
  ChatSidebarVirtualList,
  findChatSidebarSessionRow,
  MAX_CHAT_SIDEBAR_SESSION_ROW_SCAN_ELEMENTS,
} from './ChatSidebarVirtualList';
import type { ChatSession } from '@/lib/ai/types';
import {
  CHAT_SIDEBAR_ESTIMATED_SESSION_ROW_HEIGHT,
  CHAT_SIDEBAR_VIRTUALIZATION_THRESHOLD,
} from './chatSidebarLayout';

const measureMock = vi.fn();
const measureElementMock = vi.fn();
const scrollToIndexMock = vi.fn();

const virtualizerOptionsMock = vi.fn();

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { count: number; enabled?: boolean }) => {
    virtualizerOptionsMock(options);
    return {
      getTotalSize: () => options.count * CHAT_SIDEBAR_ESTIMATED_SESSION_ROW_HEIGHT,
      getVirtualItems: () =>
        Array.from({ length: options.count }, (_, index) => ({
          index,
          size: CHAT_SIDEBAR_ESTIMATED_SESSION_ROW_HEIGHT,
          start: index * CHAT_SIDEBAR_ESTIMATED_SESSION_ROW_HEIGHT,
      })),
      measure: measureMock,
      measureElement: measureElementMock,
      scrollToIndex: scrollToIndexMock,
    };
  },
}));

vi.mock('./ChatSidebarSessionRow', () => ({
  ChatSidebarSessionRow: ({
    session,
    isActive,
    isRenaming,
    isKeyboardHighlighted,
  }: {
    session: ChatSession;
    isActive: boolean;
    isRenaming: boolean;
    isKeyboardHighlighted?: boolean;
  }) => (
    <div
      data-testid={`session-row-${session.id}`}
      data-active={isActive ? 'true' : 'false'}
      data-renaming={isRenaming ? 'true' : 'false'}
      data-highlighted={isKeyboardHighlighted ? 'true' : 'false'}
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

function buildSessions(count: number): ChatSession[] {
  return Array.from({ length: count }, (_, index) => buildSession(`s${index + 1}`, `Session ${index + 1}`));
}

function renderList({
  sessions = [buildSession('s1', 'Alpha'), buildSession('s2', 'Beta')],
  currentSessionId = 's1',
  renamingSessionId = 's2',
  resetKey = '',
  scrollRootRef = createRef<HTMLDivElement>(),
  active = true,
  highlightedSessionId = null,
}: {
  sessions?: ChatSession[];
  currentSessionId?: string | null;
  renamingSessionId?: string | null;
  resetKey?: string;
  scrollRootRef?: RefObject<HTMLDivElement | null>;
  active?: boolean;
  highlightedSessionId?: string | null;
}) {
  return render(
    <ChatSidebarVirtualList
      active={active}
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
      highlightedSessionId={highlightedSessionId}
    />,
  );
}

describe('ChatSidebarVirtualList', () => {
  beforeEach(() => {
    measureMock.mockClear();
    measureElementMock.mockClear();
    scrollToIndexMock.mockClear();
    virtualizerOptionsMock.mockClear();
  });

  it('renders rows and forwards active and renaming state', () => {
    renderList({});

    expect(screen.getByTestId('session-row-s1')).toHaveTextContent('Alpha');
    expect(screen.getByTestId('session-row-s1')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('session-row-s2')).toHaveAttribute('data-renaming', 'true');
    expect(measureMock).not.toHaveBeenCalled();
    expect(virtualizerOptionsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it('enables virtualization for long session lists and uses the shared row estimate', () => {
    renderList({ sessions: buildSessions(CHAT_SIDEBAR_VIRTUALIZATION_THRESHOLD + 1) });

    expect(measureMock).toHaveBeenCalled();
    expect(virtualizerOptionsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true }),
    );
    expect(virtualizerOptionsMock.mock.lastCall?.[0].estimateSize()).toBe(
      CHAT_SIDEBAR_ESTIMATED_SESSION_ROW_HEIGHT,
    );
  });

  it('pauses measurement and scroll resets while inactive', () => {
    const scrollRoot = document.createElement('div');
    const scrollToMock = vi.fn();
    scrollRoot.scrollTo = scrollToMock;
    const scrollRootRef = createRef<HTMLDivElement>();
    scrollRootRef.current = scrollRoot;

    renderList({ active: false, resetKey: 'alpha', scrollRootRef });

    expect(measureMock).not.toHaveBeenCalled();
    expect(scrollToMock).not.toHaveBeenCalled();
    expect(virtualizerOptionsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
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

  it('highlights and scrolls the keyboard-selected session into view', () => {
    renderList({
      sessions: [
        buildSession('s1', 'Alpha'),
        buildSession('s2', 'Beta'),
        buildSession('s3', 'Gamma'),
      ],
      highlightedSessionId: 's3',
    });

    expect(screen.getByTestId('session-row-s3')).toHaveAttribute('data-highlighted', 'true');
    expect(scrollToIndexMock).not.toHaveBeenCalled();
  });

  it('scrolls the keyboard-selected session through the virtualizer for long lists', () => {
    renderList({
      sessions: buildSessions(CHAT_SIDEBAR_VIRTUALIZATION_THRESHOLD + 1),
      highlightedSessionId: 's81',
    });

    expect(screen.getByTestId('session-row-s81')).toHaveAttribute('data-highlighted', 'true');
    expect(scrollToIndexMock).toHaveBeenCalledWith(80, { align: 'auto' });
  });

  it('finds sidebar session rows without materializing row queries', () => {
    const root = document.createElement('div');
    const row = document.createElement('div');
    row.dataset.chatSidebarSessionId = 's2';
    root.appendChild(document.createElement('div'));
    root.appendChild(row);
    const querySelectorAllSpy = vi.spyOn(root, 'querySelectorAll');
    const arrayFromSpy = vi.spyOn(Array, 'from').mockImplementation(() => {
      throw new Error('Array.from should not be used');
    });

    try {
      expect(findChatSidebarSessionRow(root, 's2')).toBe(row);
      expect(querySelectorAllSpy).not.toHaveBeenCalled();
    } finally {
      arrayFromSpy.mockRestore();
      querySelectorAllSpy.mockRestore();
    }
  });

  it('stops sidebar session row lookup at the scan budget', () => {
    const root = document.createElement('div');
    for (let index = 0; index < MAX_CHAT_SIDEBAR_SESSION_ROW_SCAN_ELEMENTS + 1; index += 1) {
      root.appendChild(document.createElement('div'));
    }
    const lateRow = document.createElement('div');
    lateRow.dataset.chatSidebarSessionId = 'late';
    root.appendChild(lateRow);

    expect(findChatSidebarSessionRow(root, 'late')).toBeNull();
  });

  it('renders nothing for an empty session list', () => {
    const { container } = renderList({ sessions: [] });
    expect(container).toBeEmptyDOMElement();
  });
});
