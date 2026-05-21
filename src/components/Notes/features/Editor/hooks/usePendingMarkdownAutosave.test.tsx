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
});
