import { act, renderHook } from '@testing-library/react';
import { editorViewCtx, serializerCtx } from '@milkdown/kit/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotesStore } from '@/stores/useNotesStore';
import { usePendingMarkdownAutosave } from './usePendingMarkdownAutosave';

describe('usePendingMarkdownAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useNotesStore.setState({
      currentNote: { path: 'docs/alpha.md', content: '# alpha' },
      isDirty: false,
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
      notesPath: '/vault',
    });
  });

  afterEach(() => {
    delete (globalThis as { __VL_TEST_CONTENT_COMMIT_THROTTLE_MS__?: number })
      .__VL_TEST_CONTENT_COMMIT_THROTTLE_MS__;
    vi.useRealTimers();
  });

  it('treats editor echoes after a disk revision change as non-user updates', () => {
    const updateContent = vi.fn();
    const debouncedSave = vi.fn();
    const editorView = { dom: document.createElement('div') };
    const ctx = { get: vi.fn() };

    const { result, rerender } = renderHook(
      ({ diskRevision, content }) => usePendingMarkdownAutosave({
        currentNotePath: 'docs/alpha.md',
        currentNoteDiskRevision: diskRevision,
        currentNoteContent: content,
        updateContent,
        debouncedSave,
      }),
      { initialProps: { diskRevision: 0, content: '# alpha' } },
    );

    act(() => {
      result.current.createUserInputMarker(editorView as never, null)(new KeyboardEvent('keydown'));
      result.current.configureMarkdownListener(ctx, '# alpha')('# user edit');
      vi.advanceTimersByTime(16);
    });

    expect(updateContent).toHaveBeenCalledTimes(1);

    useNotesStore.setState({
      currentNote: { path: 'docs/alpha.md', content: '# external edit' },
      isDirty: false,
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# external edit', modifiedAt: 2 }]]),
    });

    rerender({ diskRevision: 1, content: '# external edit' });

    act(() => {
      result.current.configureMarkdownListener(ctx, '# external edit')('# stale editor echo');
      vi.advanceTimersByTime(16);
    });

    expect(updateContent).toHaveBeenCalledTimes(1);
    expect(debouncedSave).toHaveBeenCalledTimes(1);
  });

  it('treats block drag user input events as saveable edits', () => {
    const updateContent = vi.fn();
    const debouncedSave = vi.fn();
    const editorView = { dom: document.createElement('div') };
    const ctx = { get: vi.fn() };

    const { result } = renderHook(() => usePendingMarkdownAutosave({
      currentNotePath: 'docs/alpha.md',
      currentNoteDiskRevision: 0,
      currentNoteContent: '# alpha',
      updateContent,
      debouncedSave,
    }));

    act(() => {
      result.current.createUserInputMarker(editorView as never, null)(
        new CustomEvent('vlaina:block-user-input')
      );
      result.current.configureMarkdownListener(ctx, '# alpha')('# moved');
      vi.advanceTimersByTime(16);
    });

    expect(updateContent).toHaveBeenCalledWith('# moved');
    expect(debouncedSave).toHaveBeenCalledTimes(1);
  });

  it('skips same-content editor echoes without scheduling autosave work', () => {
    const updateContent = vi.fn();
    const debouncedSave = vi.fn();
    const editorView = { dom: document.createElement('div') };
    const ctx = { get: vi.fn() };

    const { result } = renderHook(() => usePendingMarkdownAutosave({
      currentNotePath: 'docs/alpha.md',
      currentNoteDiskRevision: 0,
      currentNoteContent: '# alpha',
      updateContent,
      debouncedSave,
    }));

    act(() => {
      result.current.createUserInputMarker(editorView as never, null)(new KeyboardEvent('keydown'));
      result.current.configureMarkdownListener(ctx, '# alpha')('# alpha');
      vi.advanceTimersByTime(16);
    });

    expect(updateContent).not.toHaveBeenCalled();
    expect(debouncedSave).not.toHaveBeenCalled();
  });

  it('coalesces rapid editor updates and applies only the latest markdown on the next frame', () => {
    const updateContent = vi.fn((content: string) => {
      useNotesStore.setState((state) => ({
        currentNote: state.currentNote ? { ...state.currentNote, content } : state.currentNote,
      }));
    });
    const debouncedSave = vi.fn();
    const editorView = { dom: document.createElement('div') };
    const ctx = { get: vi.fn() };

    const { result } = renderHook(() => usePendingMarkdownAutosave({
      currentNotePath: 'docs/alpha.md',
      currentNoteDiskRevision: 0,
      currentNoteContent: '# alpha',
      updateContent,
      debouncedSave,
    }));

    act(() => {
      result.current.createUserInputMarker(editorView as never, null)(new KeyboardEvent('keydown'));
      const listener = result.current.configureMarkdownListener(ctx, '# alpha');
      listener('# alpha a');
      listener('# alpha ab');
      listener('# alpha abc');
    });

    expect(updateContent).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(updateContent).toHaveBeenCalledTimes(1);
    expect(updateContent).toHaveBeenCalledWith('# alpha abc');
    expect(debouncedSave).toHaveBeenCalledTimes(1);
  });

  it('flushes the latest pending raw markdown when unmounted before the next frame', () => {
    const updateContent = vi.fn();
    const debouncedSave = vi.fn();
    const editorView = { dom: document.createElement('div') };
    const ctx = { get: vi.fn() };

    const { result, unmount } = renderHook(() => usePendingMarkdownAutosave({
      currentNotePath: 'docs/alpha.md',
      currentNoteDiskRevision: 0,
      currentNoteContent: '# alpha',
      updateContent,
      debouncedSave,
    }));

    act(() => {
      result.current.createUserInputMarker(editorView as never, null)(new KeyboardEvent('keydown'));
      result.current.configureMarkdownListener(ctx, '# alpha')('# pending before unmount');
    });

    unmount();

    expect(useNotesStore.getState().currentNote).toEqual({
      path: 'docs/alpha.md',
      content: '# pending before unmount',
    });
    expect(updateContent).not.toHaveBeenCalled();
    expect(debouncedSave).not.toHaveBeenCalled();
  });

  it('flushes delayed pending markdown before the commit throttle elapses', () => {
    (globalThis as { __VL_TEST_CONTENT_COMMIT_THROTTLE_MS__?: number })
      .__VL_TEST_CONTENT_COMMIT_THROTTLE_MS__ = 120;
    const updateContent = vi.fn((content: string) => {
      useNotesStore.setState((state) => ({
        currentNote: state.currentNote ? { ...state.currentNote, content } : state.currentNote,
      }));
    });
    const debouncedSave = vi.fn();
    const editorView = { dom: document.createElement('div') };
    const ctx = { get: vi.fn() };

    const { result, unmount } = renderHook(() => usePendingMarkdownAutosave({
      currentNotePath: 'docs/alpha.md',
      currentNoteDiskRevision: 0,
      currentNoteContent: '# alpha',
      updateContent,
      debouncedSave,
    }));

    act(() => {
      result.current.createUserInputMarker(editorView as never, null)(new KeyboardEvent('keydown'));
      result.current.configureMarkdownListener(ctx, '# alpha')('# delayed');
      vi.advanceTimersByTime(16);
    });

    expect(updateContent).not.toHaveBeenCalled();
    expect(useNotesStore.getState().currentNote?.content).toBe('# alpha');

    unmount();

    expect(useNotesStore.getState().currentNote).toEqual({
      path: 'docs/alpha.md',
      content: '# delayed',
    });
    expect(updateContent).not.toHaveBeenCalled();
    expect(debouncedSave).not.toHaveBeenCalled();
  });

  it('does not restore stale editor content while unmounting after an external disk reload', () => {
    const updateContent = vi.fn();
    const debouncedSave = vi.fn();
    const editorView = {
      dom: document.createElement('div'),
      state: { doc: {} },
    };
    const serializer = vi.fn(() => '# stale editor content');
    const editor = {
      ctx: {
        get: vi.fn((token) => {
          if (token === editorViewCtx) return editorView;
          if (token === serializerCtx) return serializer;
          return null;
        }),
      },
    };

    const { result, unmount } = renderHook(() => usePendingMarkdownAutosave({
      currentNotePath: 'docs/alpha.md',
      currentNoteDiskRevision: 0,
      currentNoteContent: '# alpha',
      updateContent,
      debouncedSave,
    }));

    act(() => {
      result.current.setEditorGetter(() => editor as never);
      result.current.createUserInputMarker(editorView as never, serializer)(new KeyboardEvent('keydown'));
    });
    serializer.mockClear();

    useNotesStore.setState({
      currentNote: { path: 'docs/alpha.md', content: '# external edit' },
      isDirty: false,
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# external edit', modifiedAt: 2 }]]),
    });

    unmount();

    expect(useNotesStore.getState().currentNote).toEqual({
      path: 'docs/alpha.md',
      content: '# external edit',
    });
    expect(useNotesStore.getState().isDirty).toBe(false);
    expect(useNotesStore.getState().openTabs).toEqual([
      { path: 'docs/alpha.md', name: 'alpha', isDirty: false },
    ]);
    expect(serializer).not.toHaveBeenCalled();
  });

  it('does not save IME composition text when the editor is unmounted mid-composition', () => {
    const updateContent = vi.fn();
    const debouncedSave = vi.fn();
    const editorView = {
      dom: document.createElement('div'),
      composing: true,
      state: { doc: {} },
    };
    const serializer = vi.fn(() => '# alpha cuo w');
    const ctx = {
      get: vi.fn((token) => {
        if (token === editorViewCtx) return editorView;
        if (token === serializerCtx) return serializer;
        return null;
      }),
    };

    const { result, unmount } = renderHook(() => usePendingMarkdownAutosave({
      currentNotePath: 'docs/alpha.md',
      currentNoteDiskRevision: 0,
      currentNoteContent: '# alpha',
      updateContent,
      debouncedSave,
    }));

    act(() => {
      result.current.setEditorGetter(() => ({ ctx } as never));
      const markUserInput = result.current.createUserInputMarker(editorView as never, serializer);
      markUserInput(new Event('compositionstart'));
      result.current.configureMarkdownListener(ctx as never, '# alpha')('# alpha cuo w');
    });

    unmount();

    expect(useNotesStore.getState().currentNote).toEqual({
      path: 'docs/alpha.md',
      content: '# alpha',
    });
    expect(updateContent).not.toHaveBeenCalled();
    expect(debouncedSave).not.toHaveBeenCalled();
    expect(serializer).not.toHaveBeenCalled();
  });

  it('saves the committed IME text after composition ends', () => {
    const updateContent = vi.fn((content: string) => {
      useNotesStore.setState((state) => ({
        currentNote: state.currentNote ? { ...state.currentNote, content } : state.currentNote,
      }));
    });
    const debouncedSave = vi.fn();
    const editorView = {
      dom: document.createElement('div'),
      composing: false,
      state: { doc: {} },
    };
    const ctx = {
      get: vi.fn((token) => {
        if (token === editorViewCtx) return editorView;
        return null;
      }),
    };

    const { result } = renderHook(() => usePendingMarkdownAutosave({
      currentNotePath: 'docs/alpha.md',
      currentNoteDiskRevision: 0,
      currentNoteContent: '# alpha',
      updateContent,
      debouncedSave,
    }));

    act(() => {
      const markUserInput = result.current.createUserInputMarker(editorView as never, null);
      markUserInput(new Event('compositionstart'));
      editorView.composing = true;
      result.current.configureMarkdownListener(ctx as never, '# alpha')('# alpha cuo w');
      editorView.composing = false;
      markUserInput(new Event('compositionend'));
      result.current.configureMarkdownListener(ctx as never, '# alpha')('# alpha 错误');
      vi.advanceTimersByTime(240);
      vi.advanceTimersByTime(16);
    });

    expect(updateContent).toHaveBeenCalledTimes(1);
    expect(updateContent).toHaveBeenCalledWith('# alpha 错误');
    expect(debouncedSave).toHaveBeenCalledTimes(1);
  });

  it('waits for the final IME markdown snapshot after compositionend emits stale romanized text first', () => {
    const updateContent = vi.fn((content: string) => {
      useNotesStore.setState((state) => ({
        currentNote: state.currentNote ? { ...state.currentNote, content } : state.currentNote,
      }));
    });
    const debouncedSave = vi.fn();
    const editorView = {
      dom: document.createElement('div'),
      composing: false,
      state: { doc: {} },
    };
    const ctx = {
      get: vi.fn((token) => {
        if (token === editorViewCtx) return editorView;
        return null;
      }),
    };

    const { result } = renderHook(() => usePendingMarkdownAutosave({
      currentNotePath: 'docs/alpha.md',
      currentNoteDiskRevision: 0,
      currentNoteContent: '# alpha',
      updateContent,
      debouncedSave,
    }));

    act(() => {
      const markUserInput = result.current.createUserInputMarker(editorView as never, null);
      markUserInput(new Event('compositionstart'));
      editorView.composing = true;
      result.current.configureMarkdownListener(ctx as never, '# alpha')('# alpha c');
      editorView.composing = false;
      markUserInput(new Event('compositionend'));
      result.current.configureMarkdownListener(ctx as never, '# alpha')('# alpha cuo w');
      vi.advanceTimersByTime(80);
      result.current.configureMarkdownListener(ctx as never, '# alpha')('# alpha 错误');
      vi.advanceTimersByTime(240);
      vi.advanceTimersByTime(16);
    });

    expect(updateContent).toHaveBeenCalledTimes(1);
    expect(updateContent).toHaveBeenCalledWith('# alpha 错误');
    expect(debouncedSave).toHaveBeenCalledTimes(1);
  });

  it('does not save stale romanized composition markdown if the committed text snapshot never arrives', () => {
    const updateContent = vi.fn();
    const debouncedSave = vi.fn();
    const editorView = {
      dom: document.createElement('div'),
      composing: false,
      state: { doc: {} },
    };
    const ctx = {
      get: vi.fn((token) => {
        if (token === editorViewCtx) return editorView;
        return null;
      }),
    };

    const { result, unmount } = renderHook(() => usePendingMarkdownAutosave({
      currentNotePath: 'docs/alpha.md',
      currentNoteDiskRevision: 0,
      currentNoteContent: '# alpha',
      updateContent,
      debouncedSave,
    }));

    act(() => {
      const markUserInput = result.current.createUserInputMarker(editorView as never, null);
      markUserInput(new Event('compositionstart'));
      editorView.composing = true;
      markUserInput(new InputEvent('beforeinput', { inputType: 'insertCompositionText', data: 'cuo w' }));
      result.current.configureMarkdownListener(ctx as never, '# alpha')('# alpha cuo w');
      markUserInput(new InputEvent('beforeinput', { inputType: 'insertCompositionText', data: '错误' }));
      editorView.composing = false;
      markUserInput(new Event('compositionend'));
      result.current.configureMarkdownListener(ctx as never, '# alpha')('# alpha cuo w');
      vi.advanceTimersByTime(240);
      vi.advanceTimersByTime(16);
    });

    expect(updateContent).not.toHaveBeenCalled();
    expect(debouncedSave).not.toHaveBeenCalled();
    expect(useNotesStore.getState().currentNote?.content).toBe('# alpha');
    unmount();
  });

  it('does not save composition markdown just because the settle timer fires before compositionend', () => {
    const updateContent = vi.fn();
    const debouncedSave = vi.fn();
    const editorView = {
      dom: document.createElement('div'),
      composing: true,
      state: { doc: {} },
    };
    const ctx = {
      get: vi.fn((token) => {
        if (token === editorViewCtx) return editorView;
        return null;
      }),
    };

    const { result, unmount } = renderHook(() => usePendingMarkdownAutosave({
      currentNotePath: 'docs/alpha.md',
      currentNoteDiskRevision: 0,
      currentNoteContent: '# alpha',
      updateContent,
      debouncedSave,
    }));

    act(() => {
      const markUserInput = result.current.createUserInputMarker(editorView as never, null);
      markUserInput(new Event('compositionstart'));
      markUserInput(new InputEvent('beforeinput', { inputType: 'insertCompositionText', data: 'cuo' }));
      result.current.configureMarkdownListener(ctx as never, '# alpha')('# alpha cuo');
      vi.advanceTimersByTime(240);
      vi.advanceTimersByTime(16);
    });

    expect(updateContent).not.toHaveBeenCalled();
    expect(debouncedSave).not.toHaveBeenCalled();
    expect(useNotesStore.getState().currentNote?.content).toBe('# alpha');
    unmount();
  });

  it('flushes committed IME markdown when switching away before the settle window elapses', () => {
    const updateContent = vi.fn();
    const debouncedSave = vi.fn();
    const editorView = {
      dom: document.createElement('div'),
      composing: false,
      state: { doc: {} },
    };
    const ctx = {
      get: vi.fn((token) => {
        if (token === editorViewCtx) return editorView;
        return null;
      }),
    };

    const { result, unmount } = renderHook(() => usePendingMarkdownAutosave({
      currentNotePath: 'docs/alpha.md',
      currentNoteDiskRevision: 0,
      currentNoteContent: '# alpha',
      updateContent,
      debouncedSave,
    }));

    act(() => {
      const markUserInput = result.current.createUserInputMarker(editorView as never, null);
      markUserInput(new Event('compositionstart'));
      editorView.composing = true;
      markUserInput(new InputEvent('beforeinput', { inputType: 'insertCompositionText', data: '错误' }));
      editorView.composing = false;
      markUserInput(new Event('compositionend'));
      result.current.configureMarkdownListener(ctx as never, '# alpha')('# alpha 错误');
      vi.advanceTimersByTime(40);
    });

    unmount();

    expect(useNotesStore.getState().currentNote).toEqual({
      path: 'docs/alpha.md',
      content: '# alpha 错误',
    });
    expect(updateContent).not.toHaveBeenCalled();
    expect(debouncedSave).not.toHaveBeenCalled();
  });

  it('does not flush stale romanized IME markdown when switching away before settle', () => {
    const updateContent = vi.fn();
    const debouncedSave = vi.fn();
    const editorView = {
      dom: document.createElement('div'),
      composing: false,
      state: { doc: {} },
    };
    const ctx = {
      get: vi.fn((token) => {
        if (token === editorViewCtx) return editorView;
        return null;
      }),
    };

    const { result, unmount } = renderHook(() => usePendingMarkdownAutosave({
      currentNotePath: 'docs/alpha.md',
      currentNoteDiskRevision: 0,
      currentNoteContent: '# alpha',
      updateContent,
      debouncedSave,
    }));

    act(() => {
      const markUserInput = result.current.createUserInputMarker(editorView as never, null);
      markUserInput(new Event('compositionstart'));
      editorView.composing = true;
      markUserInput(new InputEvent('beforeinput', { inputType: 'insertCompositionText', data: '错误' }));
      editorView.composing = false;
      markUserInput(new Event('compositionend'));
      result.current.configureMarkdownListener(ctx as never, '# alpha')('# alpha cuo w');
      vi.advanceTimersByTime(40);
    });

    unmount();

    expect(useNotesStore.getState().currentNote).toEqual({
      path: 'docs/alpha.md',
      content: '# alpha',
    });
    expect(updateContent).not.toHaveBeenCalled();
    expect(debouncedSave).not.toHaveBeenCalled();
  });

  it('does not apply an older pending snapshot after newer typing starts before the debounce fires', () => {
    (globalThis as { __VL_TEST_CONTENT_COMMIT_THROTTLE_MS__?: number })
      .__VL_TEST_CONTENT_COMMIT_THROTTLE_MS__ = 120;
    const updateContent = vi.fn((content: string) => {
      useNotesStore.setState((state) => ({
        currentNote: state.currentNote ? { ...state.currentNote, content } : state.currentNote,
      }));
    });
    const debouncedSave = vi.fn();
    const editorView = {
      dom: document.createElement('div'),
      composing: false,
      state: { doc: {} },
    };
    const ctx = {
      get: vi.fn((token) => {
        if (token === editorViewCtx) return editorView;
        return null;
      }),
    };

    useNotesStore.setState({
      currentNote: { path: 'docs/alpha.md', content: '# alpha stale' },
      noteContentsCache: new Map([['docs/alpha.md', { content: '# alpha stale', modifiedAt: 1 }]]),
    });

    const { result } = renderHook(() => usePendingMarkdownAutosave({
      currentNotePath: 'docs/alpha.md',
      currentNoteDiskRevision: 0,
      currentNoteContent: '# alpha stale',
      updateContent,
      debouncedSave,
    }));

    act(() => {
      const markUserInput = result.current.createUserInputMarker(editorView as never, null);
      const listener = result.current.configureMarkdownListener(ctx as never, '# alpha stale');

      markUserInput(new KeyboardEvent('keydown', { key: 'Backspace' }));
      listener('# alpha');
      vi.advanceTimersByTime(16);

      markUserInput(new KeyboardEvent('keydown', { key: 'c' }));
      markUserInput(new InputEvent('beforeinput', { inputType: 'insertText', data: 'c' }));
      vi.advanceTimersByTime(120);

      listener('# alphac');
      vi.advanceTimersByTime(16);
      vi.advanceTimersByTime(120);
    });

    expect(updateContent).toHaveBeenCalledTimes(1);
    expect(updateContent).toHaveBeenCalledWith('# alphac');
    expect(debouncedSave).toHaveBeenCalledTimes(1);
  });

  it('does not reset user-input tracking just because local content props changed', () => {
    const updateContent = vi.fn((content: string) => {
      useNotesStore.setState((state) => ({
        currentNote: state.currentNote ? { ...state.currentNote, content } : state.currentNote,
      }));
    });
    const debouncedSave = vi.fn();
    const editorView = {
      dom: document.createElement('div'),
      composing: false,
      state: { doc: {} },
    };
    const ctx = {
      get: vi.fn((token) => {
        if (token === editorViewCtx) return editorView;
        return null;
      }),
    };

    const { result, rerender } = renderHook(
      ({ content }) => usePendingMarkdownAutosave({
        currentNotePath: 'docs/alpha.md',
        currentNoteDiskRevision: 0,
        currentNoteContent: content,
        updateContent,
        debouncedSave,
      }),
      { initialProps: { content: '# alpha' } },
    );

    act(() => {
      const markUserInput = result.current.createUserInputMarker(editorView as never, null);
      const listener = result.current.configureMarkdownListener(ctx as never, '# alpha');
      markUserInput(new KeyboardEvent('keydown', { key: 'a' }));
      listener('# alpha a');
      vi.advanceTimersByTime(16);
    });

    rerender({ content: '# alpha a' });

    act(() => {
      result.current.createUserInputMarker(editorView as never, null)(
        new KeyboardEvent('keydown', { key: 'b' })
      );
      result.current.configureMarkdownListener(ctx as never, '# alpha')('# alpha ab');
      vi.advanceTimersByTime(16);
    });

    expect(updateContent).toHaveBeenCalledTimes(2);
    expect(updateContent).toHaveBeenLastCalledWith('# alpha ab');
    expect(debouncedSave).toHaveBeenCalledTimes(2);
  });
});
