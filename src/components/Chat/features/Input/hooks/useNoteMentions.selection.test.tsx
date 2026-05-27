import { act, renderHook } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNoteMentions } from './useNoteMentions';

const hoisted = vi.hoisted(() => {
  const loadFileTree = vi.fn();
  const storeRef: { state: any } = { state: null };
  const vaultStoreRef: { state: any } = { state: null };
  let currentVaultPath: string | null = '/vault';

  const useNotesStore = ((selector?: (state: any) => any) => {
    return selector ? selector(storeRef.state) : storeRef.state;
  }) as any;
  useNotesStore.getState = () => storeRef.state;

  const useVaultStore = ((selector?: (state: any) => any) => {
    return selector ? selector(vaultStoreRef.state) : vaultStoreRef.state;
  }) as any;
  useVaultStore.getState = () => vaultStoreRef.state;

  return {
    loadFileTree,
    storeRef,
    useNotesStore,
    vaultStoreRef,
    useVaultStore,
    getCurrentVaultPath: vi.fn(() => currentVaultPath),
    setCurrentVaultPath: vi.fn((path: string | null) => {
      currentVaultPath = path;
    }),
    resetCurrentVaultPath: (path: string | null) => {
      currentVaultPath = path;
    },
  };
});

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: hoisted.useNotesStore,
}));

vi.mock('@/stores/useVaultStore', () => ({
  useVaultStore: hoisted.useVaultStore,
}));

vi.mock('@/stores/notes/storage', () => ({
  getCurrentVaultPath: hoisted.getCurrentVaultPath,
  setCurrentVaultPath: hoisted.setCurrentVaultPath,
}));

function renderMentions(initialMessage: string) {
  return renderHook(() => {
    const [message, setMessage] = useState(initialMessage);
    const textareaRef = useRef<HTMLTextAreaElement>(document.createElement('textarea'));
    const controller = useNoteMentions({
      message,
      textareaRef,
      handleMessageChange: setMessage,
    });

    return { ...controller, message };
  });
}

describe('useNoteMentions selection deletion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    hoisted.loadFileTree.mockReset();
    hoisted.getCurrentVaultPath.mockClear();
    hoisted.setCurrentVaultPath.mockClear();
    hoisted.resetCurrentVaultPath('/vault');
    hoisted.vaultStoreRef.state = {
      currentVault: { path: '/vault' },
    };
    hoisted.storeRef.state = {
      rootFolder: {
        children: [
          { isFolder: false, path: 'Today.md' },
          { isFolder: false, path: 'Archive.md' },
        ],
      },
      currentNote: { path: 'Today.md' },
      notesPath: '/vault',
      starredEntries: [],
      isLoading: false,
      loadFileTree: hoisted.loadFileTree,
      getDisplayName: (path: string) => path.split('/').pop()?.replace(/\.md$/, '') ?? path,
      getNoteIcon: () => undefined,
    };

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  it('deletes the full selected text range when it includes a mention', () => {
    const { result } = renderMentions('@To hello');

    act(() => {
      result.current.handleCaretChange(3);
    });

    act(() => {
      result.current.applyMentionCandidate({
        path: 'Today.md',
        title: 'Today',
        kind: 'note',
        isCurrent: true,
      });
    });

    expect(result.current.message).toBe('@Today hello');

    act(() => {
      const handled = result.current.handleMentionKeyDown({
        key: 'Backspace',
        currentTarget: { selectionStart: 0, selectionEnd: result.current.message.length },
        preventDefault: vi.fn(),
      } as any);
      expect(handled).toBe(true);
    });

    expect(result.current.message).toBe('');
    expect(result.current.noteMentions).toEqual([]);
  });

  it('handles Delete on a full selection that includes a mention', () => {
    const { result } = renderMentions('@To hello');

    act(() => {
      result.current.handleCaretChange(3);
    });

    act(() => {
      result.current.applyMentionCandidate({
        path: 'Today.md',
        title: 'Today',
        kind: 'note',
        isCurrent: true,
      });
    });

    act(() => {
      const handled = result.current.handleMentionKeyDown({
        key: 'Delete',
        currentTarget: { selectionStart: 0, selectionEnd: result.current.message.length },
        preventDefault: vi.fn(),
      } as any);
      expect(handled).toBe(true);
    });

    expect(result.current.message).toBe('');
    expect(result.current.noteMentions).toEqual([]);
  });

  it('keeps mentions outside the deleted selection', () => {
    const { result } = renderMentions('');

    act(() => {
      result.current.appendNoteMentions([
        { path: 'Today.md', title: 'Today', kind: 'note' },
        { path: 'Archive.md', title: 'Archive', kind: 'note' },
      ]);
    });

    expect(result.current.message).toBe('@Today @Archive ');

    act(() => {
      const handled = result.current.handleMentionKeyDown({
        key: 'Backspace',
        currentTarget: { selectionStart: 0, selectionEnd: '@Today '.length },
        preventDefault: vi.fn(),
      } as any);
      expect(handled).toBe(true);
    });

    expect(result.current.message).toBe('@Archive ');
    expect(result.current.noteMentions).toEqual([
      { path: 'Archive.md', title: 'Archive', kind: 'note' },
    ]);
  });
});
