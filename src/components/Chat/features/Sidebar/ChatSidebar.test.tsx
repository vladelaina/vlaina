import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatSession } from '@/lib/ai/types';
import type { ReactNode } from 'react';
import { ChatSidebar } from './ChatSidebar';

const hoisted = vi.hoisted(() => ({
  appViewMode: 'chat' as 'chat' | 'notes',
  currentSessionId: 's1',
  markSessionRead: vi.fn(),
  sessions: [] as ChatSession[],
  openNewChat: vi.fn(),
  switchSession: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  sidebarSearchOpen: false,
  setSidebarSearchOpen: vi.fn((open: boolean) => {
    hoisted.sidebarSearchOpen = open;
  }),
  toggleSidebarSearch: vi.fn(() => {
    hoisted.sidebarSearchOpen = !hoisted.sidebarSearchOpen;
  }),
}));

vi.mock('@/stores/uiSlice', () => ({
  useUIStore: (selector: (state: {
    appViewMode: 'chat' | 'notes';
    sidebarSearchOpen: boolean;
    setSidebarSearchOpen: (open: boolean) => void;
    toggleSidebarSearch: () => void;
  }) => unknown) =>
    selector({
      appViewMode: hoisted.appViewMode,
      sidebarSearchOpen: hoisted.sidebarSearchOpen,
      setSidebarSearchOpen: hoisted.setSidebarSearchOpen,
      toggleSidebarSearch: hoisted.toggleSidebarSearch,
    }),
}));

vi.mock('@/stores/unified/useUnifiedStore', () => ({
  useUnifiedStore: (selector: (state: { data: { ai: { sessions: ChatSession[] } } }) => unknown) =>
    selector({ data: { ai: { sessions: hoisted.sessions } } }),
}));

vi.mock('@/stores/ai/chatState', () => {
  const getState = () => ({
    currentSessionId: hoisted.currentSessionId,
    markSessionRead: hoisted.markSessionRead,
    unreadSessions: {},
  });
  const useAIUIStore = Object.assign(
    (selector: (state: ReturnType<typeof getState>) => unknown) => selector(getState()),
    { getState },
  );
  return { useAIUIStore };
});

vi.mock('@/stores/useAIStore', () => ({
  actions: {
    deleteSession: hoisted.deleteSession,
    openNewChat: hoisted.openNewChat,
    switchSession: hoisted.switchSession,
    updateSession: hoisted.updateSession,
  },
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/ui/composerFocusRegistry', () => ({
  focusComposerInput: vi.fn(() => true),
}));

vi.mock('@/components/common/ConfirmDialog', () => ({
  ConfirmDialog: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="confirm-dialog" /> : null,
}));

vi.mock('@/components/layout/sidebar/SidebarSearchDrawer', async () => {
  const actual = await vi.importActual<typeof import('@/components/layout/sidebar/SidebarSearchDrawer')>(
    '@/components/layout/sidebar/SidebarSearchDrawer',
  );
  return {
    ...actual,
    SidebarSearchDrawer: ({
      searchQuery,
      setSearchQuery,
      canSubmit,
      onSubmit,
      canSelectPrevious,
      canSelectNext,
      onSelectPrevious,
      onSelectNext,
    }: {
      searchQuery: string;
      setSearchQuery: (value: string) => void;
      canSubmit: boolean;
      onSubmit: () => void;
      canSelectPrevious?: boolean;
      canSelectNext?: boolean;
      onSelectPrevious?: () => void;
      onSelectNext?: () => void;
    }) => (
      <input
        aria-label="chat-search"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' && canSelectPrevious) {
            onSelectPrevious?.();
          }
          if (event.key === 'ArrowDown' && canSelectNext) {
            onSelectNext?.();
          }
          if (event.key === 'Enter' && canSubmit) {
            onSubmit();
          }
        }}
      />
    ),
  };
});

vi.mock('./ChatSidebarPrimitives', () => ({
  ChatSidebarHoverEmptyHint: ({ title }: { title: string }) => <div data-testid="empty-hint">{title}</div>,
  ChatSidebarList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ChatSidebarScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ChatSidebarSurface: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('./ChatSidebarTopActions', () => ({
  ChatSidebarTopActions: () => <div data-testid="top-actions" />,
}));

vi.mock('@/components/layout/sidebar/SidebarPrimitives', () => ({
  SidebarCapsulePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SIDEBAR_CAPSULE_SCROLLBAR_INSET_RIGHT: 0,
}));

vi.mock('./ChatSidebarVirtualList', () => ({
  ChatSidebarVirtualList: ({
    sessions,
    highlightedSessionId,
  }: {
    sessions: ChatSession[];
    highlightedSessionId?: string | null;
  }) => (
    <div data-testid="session-list">
      {sessions.map((session) => (
        <div
          key={session.id}
          data-highlighted={highlightedSessionId === session.id ? 'true' : undefined}
        >
          {session.title}
        </div>
      ))}
    </div>
  ),
}));

function buildSession(id: string, title: string): ChatSession {
  return {
    id,
    title,
    modelId: 'model',
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('ChatSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.appViewMode = 'chat';
    hoisted.currentSessionId = 's1';
    hoisted.sidebarSearchOpen = false;
    hoisted.sessions = [
      buildSession('s1', 'Alpha'),
      buildSession('s2', 'Beta'),
    ];
  });

  it('keeps the last active session list rendered while inactive', () => {
    const { rerender } = render(<ChatSidebar active />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();

    hoisted.appViewMode = 'notes';
    hoisted.sessions = [];
    rerender(<ChatSidebar active={false} />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-hint')).not.toBeInTheDocument();
  });

  it('uses arrow key selection when submitting chat search results', async () => {
    hoisted.sidebarSearchOpen = true;
    hoisted.sessions = [
      buildSession('s1', 'Alpha'),
      buildSession('s2', 'Alpine'),
      buildSession('s3', 'Beta'),
    ];

    render(<ChatSidebar active />);

    const input = screen.getByLabelText('chat-search');
    fireEvent.change(input, { target: { value: 'Al' } });

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toHaveAttribute('data-highlighted', 'true');
    });

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    await waitFor(() => {
      expect(screen.getByText('Alpine')).toHaveAttribute('data-highlighted', 'true');
    });

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(hoisted.switchSession).toHaveBeenCalledWith('s2');
  });
});
