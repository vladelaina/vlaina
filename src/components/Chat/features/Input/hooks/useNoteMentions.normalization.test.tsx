import { act, renderHook } from '@testing-library/react';
import { useRef, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_NOTE_MENTION_PATH_CHARS,
  MAX_NOTE_MENTION_TITLE_RAW_CHARS,
} from '@/lib/ai/noteMentions';
import { useNoteMentions } from './useNoteMentions';

const hoisted = vi.hoisted(() => {
  const loadFileTree = vi.fn();
  const storeRef: { state: any } = { state: null };
  const notesRootStoreRef: { state: any } = { state: null };

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
  };
});

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: hoisted.useNotesStore,
}));

vi.mock('@/stores/useNotesRootStore', () => ({
  useNotesRootStore: hoisted.useNotesRootStore,
}));

vi.mock('@/stores/notes/storage', () => ({
  getCurrentNotesRootPath: vi.fn(() => '/notesRoot'),
  setCurrentNotesRootPath: vi.fn(),
}));

function renderMentions() {
  return renderHook(() => {
    const [message, setMessage] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(document.createElement('textarea'));
    const controller = useNoteMentions({
      message,
      textareaRef,
      handleMessageChange: setMessage,
    });

    return { ...controller, message };
  });
}

describe('useNoteMentions mention normalization', () => {
  beforeEach(() => {
    hoisted.loadFileTree.mockReset();
    hoisted.notesRootStoreRef.state = {
      currentNotesRoot: { path: '/notesRoot' },
    };
    hoisted.storeRef.state = {
      rootFolder: { children: [] },
      currentNote: null,
      notesPath: '/notesRoot',
      starredEntries: [],
      isLoading: false,
      loadFileTree: hoisted.loadFileTree,
      getDisplayName: (path: string) => path,
      getNoteIcon: () => undefined,
    };

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  it('rejects overlong raw mention paths before trimming restored state', () => {
    const { result } = renderMentions();
    const overlongPaddedPath = `${' '.repeat(MAX_NOTE_MENTION_PATH_CHARS)}docs/alpha.md`;

    act(() => {
      result.current.restoreNoteMentions([
        { path: overlongPaddedPath, title: 'Alpha', kind: 'note' },
      ]);
    });

    expect(result.current.noteMentions).toEqual([]);
  });

  it('falls back to the path for overlong raw mention titles when appending state', () => {
    const { result } = renderMentions();
    const path = 'docs/alpha.md';

    act(() => {
      result.current.appendNoteMentions([
        { path, title: `${' '.repeat(MAX_NOTE_MENTION_TITLE_RAW_CHARS)}Alpha`, kind: 'note' },
      ]);
    });

    expect(result.current.noteMentions).toEqual([
      { path, title: path, kind: 'note' },
    ]);
    expect(result.current.message).toBe(`@${path} `);
  });
});
