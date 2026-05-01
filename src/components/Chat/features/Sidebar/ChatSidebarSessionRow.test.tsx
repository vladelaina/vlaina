import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatSession } from '@/lib/ai/types';
import { useAIUIStore } from '@/stores/ai/chatState';
import { ChatSidebarSessionRow } from './ChatSidebarSessionRow';

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
    useAIUIStore.setState({
      generatingSessions: {},
      unreadSessions: {},
    });
  });

  it('switches sessions when the row body is left-clicked', () => {
    const props = renderRow();

    fireEvent.click(screen.getByText('Alpha chat'));

    expect(props.onSwitch).toHaveBeenCalledWith('session-1', false);
  });

  it('does not switch sessions when the row action button is clicked', () => {
    const props = renderRow();

    fireEvent.click(screen.getByLabelText('Open chat session menu'));

    expect(props.onSwitch).not.toHaveBeenCalled();
  });

  it('opens the session menu from right click without switching sessions', () => {
    const props = renderRow();

    fireEvent.contextMenu(screen.getByText('Alpha chat'));

    expect(props.onSwitch).not.toHaveBeenCalled();
    expect(screen.getByText('Rename')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Rename'));

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
});
