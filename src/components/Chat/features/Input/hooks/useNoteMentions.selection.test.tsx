import { act, renderHook } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNoteMentions } from './useNoteMentions';

const hoisted = vi.hoisted(() => {
  const loadFileTree = vi.fn();
  const storeRef: { state: any } = { state: null };
  const notesRootStoreRef: { state: any } = { state: null };
  let currentNotesRootPath: string | null = '/notesRoot';

  const useNotesStore = ((selector?: (state: any) => any) => {
    return selector ? selector(storeRef.state) : storeRef.state;
  }) as any;
  useNotesStore.getState = () => storeRef.state;

  const useNotesRootStore = ((selector?: (state: any) => any) => {
    return selector ? selector(notesRootStoreRef.state) : notesRootStoreRef.state;
  }) as any;
  useNotesRootStore.getState = () => notesRootStoreRef.state;

  return {
    loadFileTree,
    storeRef,
    useNotesStore,
    notesRootStoreRef,
    useNotesRootStore,
    getCurrentNotesRootPath: vi.fn(() => currentNotesRootPath),
    setCurrentNotesRootPath: vi.fn((path: string | null) => {
      currentNotesRootPath = path;
    }),
    resetCurrentNotesRootPath: (path: string | null) => {
      currentNotesRootPath = path;
    },
  };
});

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: hoisted.useNotesStore,
}));

vi.mock('@/stores/useNotesRootStore', () => ({
  useNotesRootStore: hoisted.useNotesRootStore,
}));

vi.mock('@/stores/notes/storage', () => ({
  getCurrentNotesRootPath: hoisted.getCurrentNotesRootPath,
  setCurrentNotesRootPath: hoisted.setCurrentNotesRootPath,
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

    return { ...controller, message, textarea: textareaRef.current };
  });
}

describe('useNoteMentions selection deletion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    hoisted.loadFileTree.mockReset();
    hoisted.getCurrentNotesRootPath.mockClear();
    hoisted.setCurrentNotesRootPath.mockClear();
    hoisted.resetCurrentNotesRootPath('/notesRoot');
    hoisted.notesRootStoreRef.state = {
      currentNotesRoot: { path: '/notesRoot' },
    };
    hoisted.storeRef.state = {
      rootFolder: {
        children: [
          { isFolder: false, path: 'Today.md' },
          { isFolder: false, path: 'Archive.md' },
        ],
      },
      currentNote: { path: 'Today.md' },
      notesPath: '/notesRoot',
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

  it('preserves non-collapsed selections instead of turning them into a caret', () => {
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

    const textarea = result.current.textarea;
    textarea.value = result.current.message;
    textarea.setSelectionRange(0, result.current.message.length);

    act(() => {
      result.current.handleCaretChange(0, result.current.message.length);
    });

    expect(result.current.showMentionPicker).toBe(false);
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(result.current.message.length);
  });

  it('removes a mention together with the explicit trailing space range', () => {
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
      result.current.removeNoteMention('Today.md', 0, '@Today '.length);
    });

    expect(result.current.message).toBe('hello');
    expect(result.current.noteMentions).toEqual([]);
  });
});
