import { render, screen } from '@testing-library/react';
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
}));

vi.mock('@/stores/uiSlice', () => ({
  useUIStore: (selector: (state: { appViewMode: 'chat' | 'notes' }) => unknown) =>
    selector({ appViewMode: hoisted.appViewMode }),
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
    SidebarSearchDrawer: () => null,
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
  ChatSidebarVirtualList: ({ sessions }: { sessions: ChatSession[] }) => (
    <div data-testid="session-list">
      {sessions.map((session) => (
        <div key={session.id}>{session.title}</div>
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
});
