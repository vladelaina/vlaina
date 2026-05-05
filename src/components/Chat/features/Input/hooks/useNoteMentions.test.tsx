import { act, renderHook } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNoteMentions } from './useNoteMentions';

const hoisted = vi.hoisted(() => {
  const loadFileTree = vi.fn();
  const storeRef: { state: any } = { state: null };

  const useNotesStore = ((selector?: (state: any) => any) => {
    return selector ? selector(storeRef.state) : storeRef.state;
  }) as any;
  useNotesStore.getState = () => storeRef.state;

  return { loadFileTree, storeRef, useNotesStore };
});

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: hoisted.useNotesStore,
}));

describe('useNoteMentions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    hoisted.loadFileTree.mockReset();
    hoisted.storeRef.state = {
      rootFolder: {
        children: [
          { isFolder: false, path: 'Today.md' },
          { isFolder: false, path: 'Tomorrow.md' },
          { isFolder: false, path: 'Archive.md' },
        ],
      },
      currentNote: { path: 'Today.md' },
      notesPath: '/vault',
      starredEntries: [],
      isLoading: false,
      loadFileTree: hoisted.loadFileTree,
      getDisplayName: (path: string) => path.replace(/\.md$/, ''),
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
    expect(result.current.linkedPageCandidates.map((item) => item.title)).toEqual(['Tomorrow']);
  });

  it('shows all candidates for a bare mention trigger', () => {
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
    expect(result.current.currentPageCandidates.map((item) => item.title)).toEqual(['Today']);
    expect(result.current.currentPageCandidates[0]?.icon).toBe('✨');
    expect(result.current.linkedPageCandidates.map((item) => item.title)).toEqual([
      'Archive',
      'Tomorrow',
    ]);
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

  it('keeps the mention picker visible when no notes match', () => {
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

    expect(result.current.showMentionPicker).toBe(true);
    expect(result.current.mentionPickerStatus).toBe('empty');
    expect(result.current.currentPageCandidates).toEqual([]);
    expect(result.current.linkedPageCandidates).toEqual([]);
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
    expect(result.current.mentionPickerStatus).toBe('empty');
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
});
