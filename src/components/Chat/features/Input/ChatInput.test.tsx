import type { ComponentProps } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInput } from './ChatInput';
import { FILE_TREE_CHAT_DROP_EVENT } from '@/components/Notes/features/FileTree/hooks/fileTreePointerDragState';
import { getDroppedExternalPaths } from '@/components/Notes/hooks/externalDropPayload';
import { setCurrentNotesRootPath, useNotesStore } from '@/stores/notes/useNotesStore';
import { useNotesRootStore } from '@/stores/useNotesRootStore';

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/hooks/usePredictedTextareaHeight', () => ({
  usePredictedTextareaHeight: () => ({ syncHeight: vi.fn() }),
}));

vi.mock('@/lib/navigation/externalLinks', () => ({
  openExternalHref: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/billing/returnRefresh', () => ({
  markBillingReturnRefreshPending: vi.fn(),
}));

vi.mock('@/components/Notes/hooks/externalDropPayload', () => ({
  getDroppedExternalPaths: vi.fn(() => []),
}));

type ChatInputProps = ComponentProps<typeof ChatInput>;
const getDroppedExternalPathsMock = vi.mocked(getDroppedExternalPaths);

function getTestDisplayName(path: string): string {
  return path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? path;
}

function renderChatInput(overrides: Partial<ChatInputProps> = {}) {
  const noop = vi.fn();
  const props: ChatInputProps = {
    active: true,
    onSend: vi.fn(),
    onStop: noop,
    isLoading: false,
    hasSelectedModel: true,
    sentUserMessages: [],
    ...overrides,
  };

  return {
    ...render(<ChatInput {...props} />),
    props,
  };
}

describe('ChatInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDroppedExternalPathsMock.mockReturnValue([]);
    setCurrentNotesRootPath(null);
    useNotesRootStore.setState({ currentNotesRoot: null });
    useNotesStore.setState({
      notesPath: '',
      getDisplayName: getTestDisplayName,
    });
  });

  it('keeps the composer editable and lets submit retry quota refresh while managed quota is shown', async () => {
    const onSend = vi.fn(async () => false);

    renderChatInput({
      onSend,
      isManagedQuotaExhausted: true,
    });

    const textarea = screen.getByPlaceholderText('chat.composerPlaceholder') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'still editable' } });

    expect(textarea).not.toBeDisabled();
    expect(textarea.value).toBe('still editable');
    expect(screen.getByRole('button', { name: 'chat.openActions' })).not.toBeDisabled();

    const sendButton = screen.getByRole('button', { name: 'common.send' });
    expect(sendButton).not.toBeDisabled();
    expect(sendButton).not.toHaveClass('opacity-[var(--vlaina-opacity-60)]');

    await act(async () => {
      fireEvent.click(sendButton);
      await Promise.resolve();
    });
    expect(onSend).toHaveBeenCalledWith('still editable', [], []);
    expect(textarea.value).toBe('still editable');
  });

  it('renders the managed quota notice as part of an expanded composer frame', () => {
    const { container } = renderChatInput({
      isManagedQuotaExhausted: true,
    });

    const banner = container.querySelector('[data-managed-quota-banner="true"]');
    const frame = container.querySelector('[data-chat-input="true"]')?.parentElement;
    expect(banner).not.toBeNull();
    expect(frame).toHaveClass('bg-[var(--vlaina-color-accent-soft)]');
    expect(frame).toHaveClass('overflow-hidden');
    expect(banner).toHaveClass('min-h-[var(--vlaina-size-32px)]');
    expect(banner).not.toHaveClass('absolute');
  });

  it('adds a note mention when a file tree item is dropped into chat', async () => {
    renderChatInput();

    act(() => {
      window.dispatchEvent(new CustomEvent(FILE_TREE_CHAT_DROP_EVENT, {
        detail: {
          path: 'docs/Source.md',
          kind: 'note',
        },
      }));
    });

    const textarea = screen.getByPlaceholderText('chat.composerPlaceholder') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(textarea.value).toBe('@Source ');
    });
    expect(document.querySelector('[data-mention-preview-token="true"]')).toHaveTextContent('@Source');
  });

  it('adds note mentions when opened folder markdown files are dropped into chat', async () => {
    getDroppedExternalPathsMock.mockReturnValue([
      '/notesRoot/docs/Source.md',
      '/notesRoot/docs/Source.md',
      '/notesRoot/docs/Skipped.txt',
      '/other-notesRoot/Outside.txt',
    ]);
    useNotesStore.setState({
      notesPath: '/notesRoot',
      getDisplayName: getTestDisplayName,
    });
    renderChatInput();

    const dropTarget = document.querySelector('[data-chat-input="true"]');
    expect(dropTarget).not.toBeNull();
    fireEvent.drop(dropTarget!, {
      dataTransfer: {
        files: [new File(['body'], 'Source.md', { type: 'text/markdown' })],
        items: [],
        types: ['Files'],
      },
    });

    const textarea = screen.getByPlaceholderText('chat.composerPlaceholder') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(textarea.value).toBe('@Source ');
    });
    expect(document.querySelector('[data-mention-preview-token="true"]')).toHaveTextContent('@Source');
  });

  it('adds note mentions when external markdown files are dropped into chat', async () => {
    getDroppedExternalPathsMock.mockReturnValue(['/outside/Untitled.md']);
    useNotesStore.setState({
      notesPath: '/notesRoot',
      getDisplayName: getTestDisplayName,
    });
    renderChatInput();

    const dropTarget = document.querySelector('[data-chat-input="true"]');
    expect(dropTarget).not.toBeNull();
    fireEvent.drop(dropTarget!, {
      dataTransfer: {
        files: [new File(['body'], 'Untitled.md', { type: 'text/markdown' })],
        items: [],
        types: ['Files'],
      },
    });

    const textarea = screen.getByPlaceholderText('chat.composerPlaceholder') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(textarea.value).toBe('@Untitled ');
    });
    expect(document.querySelector('[data-mention-preview-token="true"]')).toHaveTextContent('@Untitled');
  });

  it('uses the active opened folder path when the notes store path is not initialized yet', async () => {
    getDroppedExternalPathsMock.mockReturnValue(['/notesRoot/docs/Fallback.md']);
    useNotesRootStore.setState({
      currentNotesRoot: {
        id: 'notesRoot',
        name: 'NotesRoot',
        path: '/notesRoot',
        lastOpened: Date.now(),
      },
    });
    renderChatInput();

    const dropTarget = document.querySelector('[data-chat-input="true"]');
    expect(dropTarget).not.toBeNull();
    fireEvent.drop(dropTarget!, {
      dataTransfer: {
        files: [new File(['body'], 'Fallback.md', { type: 'text/markdown' })],
        items: [],
        types: ['Files'],
      },
    });

    const textarea = screen.getByPlaceholderText('chat.composerPlaceholder') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(textarea.value).toBe('@Fallback ');
    });
    expect(document.querySelector('[data-mention-preview-token="true"]')).toHaveTextContent('@Fallback');
  });
});
