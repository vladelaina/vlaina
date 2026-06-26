import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatSession } from '@/lib/ai/types';
import { useAIUIStore } from '@/stores/ai/chatState';
import { ChatSidebarSessionRow } from './ChatSidebarSessionRow';

const mocked = vi.hoisted(() => ({
  createWindow: vi.fn(() => Promise.resolve()),
  openNewChat: vi.fn(),
  prefetchSession: vi.fn(),
  cancelSessionPrefetch: vi.fn(),
}));

vi.mock('@/lib/desktop/window', () => ({
  desktopWindow: {
    create: mocked.createWindow,
  },
}));

vi.mock('@/stores/useAIStore', () => ({
  actions: {
    openNewChat: mocked.openNewChat,
    prefetchSession: mocked.prefetchSession,
    cancelSessionPrefetch: mocked.cancelSessionPrefetch,
  },
}));

function buildSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: 'session-1',
    title: 'Alpha chat',
    modelId: 'model-1',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function renderRow(overrides: Partial<Parameters<typeof ChatSidebarSessionRow>[0]> = {}) {
  const props = {
    session: buildSession(),
    isActive: false,
    isRenaming: false,
    renameDraft: '',
    onRenameDraftChange: vi.fn(),
    onStartRename: vi.fn(),
    onCommitRename: vi.fn(),
    onCancelRename: vi.fn(),
    onSwitch: vi.fn(),
    onRequestDelete: vi.fn(),
    onTogglePin: vi.fn(),
    shouldHideSearchResults: false,
    ...overrides,
  };

  render(<ChatSidebarSessionRow {...props} />);
  return props;
}

describe('ChatSidebarSessionRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAIUIStore.setState({
      generatingSessions: {},
      unreadSessions: {},
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('switches sessions when the row body is left-clicked', () => {
    const props = renderRow();

    fireEvent.click(screen.getByText('Alpha chat'));

    expect(props.onSwitch).toHaveBeenCalledWith('session-1', false);
  });

  it('prefetches on sustained hover and cancels pending hover prefetch on leave', () => {
    vi.useFakeTimers();
    renderRow();
    const row = screen.getByText('Alpha chat').closest('[data-chat-sidebar-session-row="true"]');
    expect(row).toBeInstanceOf(HTMLElement);

    fireEvent.mouseEnter(row!);
    act(() => {
      vi.advanceTimersByTime(139);
    });
    expect(mocked.prefetchSession).not.toHaveBeenCalled();

    fireEvent.mouseLeave(row!);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(mocked.prefetchSession).not.toHaveBeenCalled();
    expect(mocked.cancelSessionPrefetch).toHaveBeenCalledWith('session-1');

    fireEvent.mouseEnter(row!);
    act(() => {
      vi.advanceTimersByTime(140);
    });
    expect(mocked.prefetchSession).toHaveBeenCalledWith('session-1');
  });

  it('does not switch sessions when the row action button is clicked', () => {
    const props = renderRow();

    fireEvent.click(screen.getByLabelText('Open chat session menu'));

    expect(props.onSwitch).not.toHaveBeenCalled();
  });

  it('opens a chat session in a new window and clears the current window', () => {
    renderRow({ isActive: true });

    fireEvent.contextMenu(screen.getByText('Alpha chat'));
    fireEvent.click(screen.getByText('Open in New Window'));

    expect(mocked.createWindow).toHaveBeenCalledWith({
      viewMode: 'chat',
      chatSessionId: 'session-1',
    });
    expect(mocked.openNewChat).toHaveBeenCalledTimes(1);
  });

  it('keeps the current window unchanged when opening an inactive session in a new window', () => {
    renderRow({ isActive: false });

    fireEvent.contextMenu(screen.getByText('Alpha chat'));
    fireEvent.click(screen.getByText('Open in New Window'));

    expect(mocked.createWindow).toHaveBeenCalledWith({
      viewMode: 'chat',
      chatSessionId: 'session-1',
    });
    expect(mocked.openNewChat).not.toHaveBeenCalled();
  });

  it('places open in new window below pin in the context menu', () => {
    renderRow();

    fireEvent.contextMenu(screen.getByText('Alpha chat'));

    const pin = screen.getByText('Pin');
    const openInNewWindow = screen.getByText('Open in New Window');

    expect(pin.compareDocumentPosition(openInNewWindow) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it('opens the session menu from right click without switching sessions', () => {
    const props = renderRow();

    fireEvent.contextMenu(screen.getByText('Alpha chat'));

    expect(props.onSwitch).not.toHaveBeenCalled();
    expect(screen.getByText('Rename')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Rename'));

    expect(props.onStartRename).toHaveBeenCalledWith('session-1', 'Alpha chat');
  });

  it('starts renaming when the row body is double-clicked', () => {
    const props = renderRow();

    fireEvent.doubleClick(screen.getByText('Alpha chat'));

    expect(props.onStartRename).toHaveBeenCalledWith('session-1', 'Alpha chat');
  });

  it('does not switch sessions while renaming', () => {
    const props = renderRow({
      isRenaming: true,
      renameDraft: 'Alpha chat',
    });

    fireEvent.click(screen.getByDisplayValue('Alpha chat'));

    expect(props.onSwitch).not.toHaveBeenCalled();
  });

  it('does not increase title weight for the active session', () => {
    renderRow({ isActive: true });

    const title = screen.getByText('Alpha chat');

    expect(title).toHaveClass('text-[var(--vlaina-sidebar-row-selected-text)]');
    expect(title).not.toHaveClass('font-[var(--vlaina-font-weight-semibold-plus)]');
    expect(title).not.toHaveClass('font-medium');
  });

  it('allows chat search result titles to wrap like outline entries', () => {
    const longTitle = 'alpha-super-long-chat-session-title-without-natural-breakpoints';

    renderRow({
      session: buildSession({ title: longTitle }),
      shouldHideSearchResults: true,
    });

    const title = screen.getByText(longTitle);

    expect(title).toHaveClass('block');
    expect(title).toHaveClass('w-full');
    expect(title).toHaveClass('whitespace-normal');
    expect(title).toHaveClass('break-words');
    expect(title).toHaveClass('[overflow-wrap:anywhere]');
    expect(title).not.toHaveClass('line-clamp-2');
  });

  it('keeps regular chat titles clamped to two lines', () => {
    renderRow();

    const title = screen.getByText('Alpha chat');

    expect(title).toHaveClass('line-clamp-2');
    expect(title).toHaveClass('[overflow-wrap:anywhere]');
    expect(title).not.toHaveClass('whitespace-normal');
  });
});
