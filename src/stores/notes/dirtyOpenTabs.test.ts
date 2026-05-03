import { beforeEach, describe, expect, it, vi } from 'vitest';

const openStoredNotePath = vi.hoisted(() => vi.fn());

vi.mock('./openNotePath', () => ({
  openStoredNotePath,
}));

import { useNotesStore } from '@/stores/useNotesStore';
import { saveDirtyRegularOpenTabs } from './dirtyOpenTabs';
import {
  flushPendingEditorMarkdown,
  setPendingEditorMarkdownFlusher,
} from './pendingEditorMarkdown';

describe('saveDirtyRegularOpenTabs', () => {
  beforeEach(() => {
    setPendingEditorMarkdownFlusher(null);
    openStoredNotePath.mockReset();
    openStoredNotePath.mockImplementation(async (path: string) => {
      useNotesStore.setState((state) => ({
        currentNote: {
          path,
          content: state.noteContentsCache.get(path)?.content ?? '',
        },
        isDirty: Boolean(state.openTabs.find((tab) => tab.path === path)?.isDirty),
      }));
    });

    useNotesStore.setState({
      currentNote: null,
      isDirty: false,
      openTabs: [],
      noteContentsCache: new Map(),
      draftNotes: {},
    });
  });

  it('saves dirty regular tabs even when they are in the background', async () => {
    const saveNote = vi.fn(async () => {
      const path = useNotesStore.getState().currentNote?.path;
      useNotesStore.setState((state) => ({
        isDirty: false,
        openTabs: state.openTabs.map((tab) =>
          tab.path === path ? { ...tab, isDirty: false } : tab
        ),
      }));
    });
    useNotesStore.setState({
      currentNote: { path: 'beta.md', content: '# beta' },
      isDirty: false,
      saveNote,
      openTabs: [
        { path: 'alpha.md', name: 'alpha', isDirty: true },
        { path: 'beta.md', name: 'beta', isDirty: false },
      ],
      noteContentsCache: new Map([
        ['alpha.md', { content: 'Unsaved alpha', modifiedAt: 1 }],
        ['beta.md', { content: '# beta', modifiedAt: 2 }],
      ]),
    });

    const saved = await saveDirtyRegularOpenTabs();

    expect(saved).toBe(true);
    expect(openStoredNotePath).toHaveBeenCalledWith(
      'alpha.md',
      expect.objectContaining({
        openNote: expect.any(Function),
        openNoteByAbsolutePath: expect.any(Function),
      })
    );
    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(useNotesStore.getState().openTabs).toEqual([
      { path: 'alpha.md', name: 'alpha', isDirty: false },
      { path: 'beta.md', name: 'beta', isDirty: false },
    ]);
  });

  it('does not save dirty drafts through the regular tab flush', async () => {
    const saveNote = vi.fn();
    useNotesStore.setState({
      currentNote: { path: 'beta.md', content: '# beta' },
      saveNote,
      openTabs: [
        { path: 'draft:alpha', name: '', isDirty: true },
        { path: 'beta.md', name: 'beta', isDirty: false },
      ],
    });

    const saved = await saveDirtyRegularOpenTabs();

    expect(saved).toBe(true);
    expect(openStoredNotePath).not.toHaveBeenCalled();
    expect(saveNote).not.toHaveBeenCalled();
  });

  it('saves the current dirty regular note even if the tab state was not marked dirty', async () => {
    const saveNote = vi.fn(async () => {
      useNotesStore.setState({ isDirty: false });
    });
    useNotesStore.setState({
      currentNote: { path: 'alpha.md', content: 'Unsaved alpha' },
      isDirty: true,
      saveNote,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['alpha.md', { content: 'Unsaved alpha', modifiedAt: 1 }]]),
    });

    const saved = await saveDirtyRegularOpenTabs();

    expect(saved).toBe(true);
    expect(openStoredNotePath).not.toHaveBeenCalled();
    expect(saveNote).toHaveBeenCalledTimes(1);
  });

  it('flushes pending editor markdown before collecting dirty regular tabs', async () => {
    const saveNote = vi.fn(async () => {
      const path = useNotesStore.getState().currentNote?.path;
      useNotesStore.setState((state) => ({
        isDirty: false,
        openTabs: state.openTabs.map((tab) =>
          tab.path === path ? { ...tab, isDirty: false } : tab
        ),
      }));
    });
    useNotesStore.setState({
      currentNote: { path: 'alpha.md', content: 'Old alpha' },
      isDirty: false,
      saveNote,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['alpha.md', { content: 'Old alpha', modifiedAt: 1 }]]),
    });
    setPendingEditorMarkdownFlusher(() =>
      flushPendingEditorMarkdown('alpha.md', 'Unsaved alpha')
    );

    const saved = await saveDirtyRegularOpenTabs();

    expect(saved).toBe(true);
    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(useNotesStore.getState().noteContentsCache.get('alpha.md')?.content).toBe(
      'Unsaved alpha'
    );
  });
});
