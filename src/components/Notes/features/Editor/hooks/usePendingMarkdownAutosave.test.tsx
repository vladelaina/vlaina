import { act, renderHook } from '@testing-library/react';
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
});
