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

describe('useNoteMentions', () => {
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
          {
            isFolder: true,
            name: 'Projects',
            path: 'Projects',
            children: [
              { isFolder: false, path: 'Projects/Plan.md' },
            ],
          },
          { isFolder: false, path: 'Tomorrow.md' },
          { isFolder: false, path: 'Archive.md' },
        ],
      },
      currentNote: { path: 'Today.md' },
      notesPath: '/vault',
      starredEntries: [],
      isLoading: false,
      loadFileTree: hoisted.loadFileTree,
      getDisplayName: (path: string) => (
        path.split('/').pop()?.replace(/\.md$/, '') ?? path.replace(/\.md$/, '')
      ),
      getNoteIcon: (path: string) => (path === 'Today.md' ? '✨' : undefined),
    };

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  it('surfaces current-page candidates ahead of linked pages', () => {
    const { result } = renderHook(() => {
      const [message, setMessage] = useState('@To');
      const textareaRef = useRef<HTMLTextAreaElement>(document.createElement('textarea'));
      const controller = useNoteMentions({
        message,
        textareaRef,
        handleMessageChange: setMessage,
      });

      return { ...controller, message };
    });

    act(() => {
      result.current.handleCaretChange(3);
    });

    expect(result.current.showMentionPicker).toBe(true);
    expect(result.current.currentPageCandidates.map((item) => item.title)).toEqual(['Today']);
    expect(result.current.folderCandidates.map((item) => item.title)).toEqual([]);
    expect(result.current.linkedPageCandidates.map((item) => item.title)).toEqual(['Tomorrow']);
  });

  it('loads the note tree for mentions even before notesPath is initialized', () => {
    hoisted.storeRef.state = {
      ...hoisted.storeRef.state,
      rootFolder: null,
      notesPath: '',
      isLoading: false,
    };

    const { result } = renderHook(() => {
      const [message, setMessage] = useState('@');
      const textareaRef = useRef<HTMLTextAreaElement>(document.createElement('textarea'));
      const controller = useNoteMentions({
        message,
        textareaRef,
        handleMessageChange: setMessage,
      });

      return { ...controller, message };
    });

    act(() => {
      result.current.handleCaretChange(1);
    });

    expect(result.current.showMentionPicker).toBe(true);
    expect(result.current.mentionPickerStatus).toBe('loading');
    expect(hoisted.loadFileTree).toHaveBeenCalledTimes(1);
  });

  it('keeps a bare mention trigger quiet when no vault is available', () => {
    hoisted.resetCurrentVaultPath(null);
    hoisted.vaultStoreRef.state = {
      currentVault: null,
    };
    hoisted.storeRef.state = {
      ...hoisted.storeRef.state,
      rootFolder: null,
      notesPath: '',
      isLoading: false,
    };

    const { result } = renderHook(() => {
      const [message, setMessage] = useState('@');
      const textareaRef = useRef<HTMLTextAreaElement>(document.createElement('textarea'));
      const controller = useNoteMentions({
        message,
        textareaRef,
        handleMessageChange: setMessage,
      });

      return { ...controller, message };
    });

    act(() => {
      result.current.handleCaretChange(1);
    });

    expect(result.current.showMentionPicker).toBe(false);
    expect(result.current.mentionPickerStatus).toBeNull();
    expect(hoisted.loadFileTree).not.toHaveBeenCalled();
  });

  it('keeps a bare mention trigger quiet when there are no candidate notes', () => {
    hoisted.storeRef.state = {
      ...hoisted.storeRef.state,
      rootFolder: { children: [] },
    };

    const { result } = renderHook(() => {
      const [message, setMessage] = useState('@');
      const textareaRef = useRef<HTMLTextAreaElement>(document.createElement('textarea'));
      const controller = useNoteMentions({
        message,
        textareaRef,
        handleMessageChange: setMessage,
      });

      return { ...controller, message };
    });

    act(() => {
      result.current.handleCaretChange(1);
    });

    expect(result.current.showMentionPicker).toBe(false);
    expect(result.current.mentionPickerStatus).toBeNull();
  });

  it('hides the mention picker when no notes match', () => {
    const { result } = renderHook(() => {
      const [message, setMessage] = useState('@missing');
      const textareaRef = useRef<HTMLTextAreaElement>(document.createElement('textarea'));
      const controller = useNoteMentions({
        message,
        textareaRef,
        handleMessageChange: setMessage,
      });

      return { ...controller, message };
    });

    act(() => {
      result.current.handleCaretChange(8);
    });

    expect(result.current.showMentionPicker).toBe(false);
    expect(result.current.mentionPickerStatus).toBe('empty');
    expect(result.current.currentPageCandidates).toEqual([]);
    expect(result.current.linkedPageCandidates).toEqual([]);
  });

  it('keeps the mention picker visible when the app window loses focus', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);

    const { result } = renderHook(() => {
      const [message, setMessage] = useState('@');
      const textareaRef = useRef<HTMLTextAreaElement>(document.createElement('textarea'));
      const controller = useNoteMentions({
        message,
        textareaRef,
        handleMessageChange: setMessage,
      });

      return { ...controller, message };
    });

    act(() => {
      result.current.handleCaretChange(1);
    });

    expect(result.current.showMentionPicker).toBe(true);

    act(() => {
      result.current.handleCaretBlur();
    });

    expect(result.current.showMentionPicker).toBe(true);
  });

  it('includes starred notes from other vaults as mention candidates', () => {
    hoisted.storeRef.state = {
      ...hoisted.storeRef.state,
      rootFolder: null,
      starredEntries: [
        {
          id: 'starred-external',
          kind: 'note',
          vaultPath: '/other-vault',
          relativePath: 'refs/External.md',
          addedAt: 1,
        },
      ],
    };

    const { result } = renderHook(() => {
      const [message, setMessage] = useState('@Ext');
      const textareaRef = useRef<HTMLTextAreaElement>(document.createElement('textarea'));
      const controller = useNoteMentions({
        message,
        textareaRef,
        handleMessageChange: setMessage,
      });

      return { ...controller, message };
    });

    act(() => {
      result.current.handleCaretChange(4);
    });

    expect(result.current.showMentionPicker).toBe(true);
    expect(result.current.linkedPageCandidates).toMatchObject([
      {
        path: '/other-vault/refs/External.md',
        title: 'External',
        isCurrent: false,
        notePath: 'refs/External.md',
        vaultPath: '/other-vault',
      },
    ]);
  });

  it('does not expose stale starred mention candidates inside internal folders', () => {
    hoisted.storeRef.state = {
      ...hoisted.storeRef.state,
      rootFolder: null,
      starredEntries: [
        {
          id: 'starred-dot-note',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: '.notes/Daily.md',
          addedAt: 1,
        },
        {
          id: 'starred-internal-relative',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: '.git/config.md',
          addedAt: 2,
        },
        {
          id: 'starred-internal-vault',
          kind: 'note',
          vaultPath: '/other-vault/.vlaina',
          relativePath: 'workspace.md',
          addedAt: 3,
        },
      ],
    };

    const { result } = renderHook(() => {
      const [message, setMessage] = useState('@');
      const textareaRef = useRef<HTMLTextAreaElement>(document.createElement('textarea'));
      const controller = useNoteMentions({
        message,
        textareaRef,
        handleMessageChange: setMessage,
      });

      return { ...controller, message };
    });

    act(() => {
      result.current.handleCaretChange(1);
    });

    expect(result.current.linkedPageCandidates.map((candidate) => candidate.path)).toEqual([
      '.notes/Daily.md',
    ]);
  });

  it('does not repeatedly reload the note tree for the same mention trigger', () => {
    hoisted.storeRef.state = {
      ...hoisted.storeRef.state,
      rootFolder: null,
      notesPath: '',
      isLoading: false,
    };

    const { result, rerender } = renderHook(() => {
      const [message, setMessage] = useState('@');
      const textareaRef = useRef<HTMLTextAreaElement>(document.createElement('textarea'));
      const controller = useNoteMentions({
        message,
        textareaRef,
        handleMessageChange: setMessage,
      });

      return { ...controller, message };
    });

    act(() => {
      result.current.handleCaretChange(1);
    });

    hoisted.storeRef.state = {
      ...hoisted.storeRef.state,
      isLoading: true,
    };
    rerender();

    hoisted.storeRef.state = {
      ...hoisted.storeRef.state,
      isLoading: false,
    };
    rerender();

    expect(hoisted.loadFileTree).toHaveBeenCalledTimes(1);
    expect(result.current.mentionPickerStatus).toBeNull();
  });

  it('applies the active candidate on Enter', () => {
    const { result } = renderHook(() => {
      const [message, setMessage] = useState('@To');
      const textareaRef = useRef<HTMLTextAreaElement>(document.createElement('textarea'));
      const controller = useNoteMentions({
        message,
        textareaRef,
        handleMessageChange: setMessage,
      });

      return { ...controller, message };
    });

    act(() => {
      result.current.handleCaretChange(3);
    });

    act(() => {
      const handled = result.current.handleMentionKeyDown({
        key: 'Enter',
        shiftKey: false,
        currentTarget: { selectionStart: 3, selectionEnd: 3 },
        preventDefault: vi.fn(),
      } as any);
      expect(handled).toBe(true);
    });

    expect(result.current.message).toBe('@Today ');
    expect(result.current.mentionPreviewParts.some((part) => part.type === 'mention')).toBe(true);
  });

  it('removes a mention token on Backspace when the caret is inside it', () => {
    const { result } = renderHook(() => {
      const [message, setMessage] = useState('@To');
      const textareaRef = useRef<HTMLTextAreaElement>(document.createElement('textarea'));
      const controller = useNoteMentions({
        message,
        textareaRef,
        handleMessageChange: setMessage,
      });

      return { ...controller, message };
    });

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
        key: 'Backspace',
        currentTarget: { selectionStart: 2, selectionEnd: 2 },
        preventDefault: vi.fn(),
      } as any);
      expect(handled).toBe(true);
    });

    expect(result.current.message.trim()).toBe('');
    expect(result.current.mentionPreviewParts.some((part) => part.type === 'mention')).toBe(false);
  });

  it('moves the active mention candidate with arrow keys', () => {
    const { result } = renderHook(() => {
      const [message, setMessage] = useState('@');
      const textareaRef = useRef<HTMLTextAreaElement>(document.createElement('textarea'));
      const controller = useNoteMentions({
        message,
        textareaRef,
        handleMessageChange: setMessage,
      });

      return { ...controller, message };
    });

    act(() => {
      result.current.handleCaretChange(1);
    });

    expect(result.current.activeCandidatePath).toBe('Today.md');

    act(() => {
      const handled = result.current.handleMentionKeyDown({
        key: 'ArrowDown',
        currentTarget: { selectionStart: 1, selectionEnd: 1 },
        preventDefault: vi.fn(),
      } as any);
      expect(handled).toBe(true);
    });

    expect(result.current.activeCandidatePath).toBe('Projects');

    act(() => {
      const handled = result.current.handleMentionKeyDown({
        key: 'Enter',
        shiftKey: false,
        currentTarget: { selectionStart: 1, selectionEnd: 1 },
        preventDefault: vi.fn(),
      } as any);
      expect(handled).toBe(true);
    });

    expect(result.current.message).toBe('@Projects/ ');
    expect(result.current.noteMentions).toEqual([
      { path: 'Projects', title: 'Projects/', kind: 'folder' },
    ]);
  });

  it('removes a mention token on Backspace from its trailing insertion space', () => {
    const { result } = renderHook(() => {
      const [message, setMessage] = useState('@To');
      const textareaRef = useRef<HTMLTextAreaElement>(document.createElement('textarea'));
      const controller = useNoteMentions({
        message,
        textareaRef,
        handleMessageChange: setMessage,
      });

      return { ...controller, message };
    });

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

    expect(result.current.message).toBe('@Today ');

    act(() => {
      const handled = result.current.handleMentionKeyDown({
        key: 'Backspace',
        currentTarget: { selectionStart: 7, selectionEnd: 7 },
        preventDefault: vi.fn(),
      } as any);
      expect(handled).toBe(true);
    });

    expect(result.current.message).toBe('');
    expect(result.current.showMentionPicker).toBe(false);
    expect(result.current.mentionPreviewParts.some((part) => part.type === 'mention')).toBe(false);
  });
});
