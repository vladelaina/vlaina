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
      isLoading: false,
      loadFileTree: hoisted.loadFileTree,
      getDisplayName: (path: string) => path.replace(/\.md$/, ''),
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
