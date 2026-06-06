import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  persistWorkspaceSnapshot: vi.fn(),
  flushCurrentPendingEditorMarkdown: vi.fn(),
}));

vi.mock('../workspacePersistence', () => ({
  persistWorkspaceSnapshot: hoisted.persistWorkspaceSnapshot,
}));

vi.mock('../pendingEditorMarkdownFlusher', () => ({
  flushCurrentPendingEditorMarkdown: hoisted.flushCurrentPendingEditorMarkdown,
}));

import { createFileSystemSlice } from './fileSystemSlice';
import { getWorkspaceRestoreCandidatePaths } from './fileSystemSliceTreeActions';
import { replaceCurrentTabOrAppend } from './fileSystemSliceHelpers';
import { setCurrentVaultPath } from '../storage';

function createSliceHarness(overrides: Record<string, unknown> = {}) {
  let state: any;

  const set = (partial: any) => {
    const nextState = typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...nextState };
  };

  const get = () => state;
  const slice = createFileSystemSlice(set as never, get as never, {} as never);

  state = {
    ...slice,
    currentNote: null,
    currentNoteRevision: 0,
    isDirty: false,
    error: null,
    recentNotes: [],
    openTabs: [],
    noteContentsCache: new Map(),
    draftNotes: {},
    noteMetadata: null,
    displayNames: new Map(),
    saveNote: vi.fn(),
    ...overrides,
  };

  return {
    getState: () => state,
  };
}

describe('createFileSystemSlice draft flows', () => {
  beforeEach(() => {
    setCurrentVaultPath(null);
    vi.clearAllMocks();
    hoisted.flushCurrentPendingEditorMarkdown.mockReturnValue(false);
  });

  it('creates an unsaved draft note when no vault is selected', async () => {
    const harness = createSliceHarness();

    const draftPath = await harness.getState().createNote();
    const state = harness.getState();

    expect(draftPath).toMatch(/^draft:/);
    expect(state.notesPath).toBe('');
    expect(state.currentNote).toEqual({ path: draftPath, content: '' });
    expect(state.openTabs).toEqual([{ path: draftPath, name: '', isDirty: false }]);
    expect(state.draftNotes[draftPath]).toEqual({
      parentPath: null,
      name: '',
      originNotesPath: '',
      kind: 'scratch',
    });
    expect(state.displayNames.get(draftPath)).toBe('');
    expect(state.noteContentsCache.get(draftPath)).toEqual({ content: '', modifiedAt: null });
    expect(state.saveNote).not.toHaveBeenCalled();
  });

  it('does not create a draft note when creating a folder without a selected vault', async () => {
    const harness = createSliceHarness();

    const result = await harness.getState().createFolder('');
    const state = harness.getState();

    expect(result).toBeNull();
    expect(state.notesPath).toBe('');
    expect(state.currentNote).toBeNull();
    expect(state.openTabs).toEqual([]);
    expect(state.draftNotes).toEqual({});
    expect(state.displayNames.size).toBe(0);
  });

  it('does not surface a notes error when loading the file tree without a selected vault', async () => {
    const harness = createSliceHarness({
      isLoading: false,
      error: 'previous error',
      rootFolder: null,
    });

    await harness.getState().loadFileTree();

    const state = harness.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.rootFolder).toBeNull();
  });

  it('creates another draft tab without saving or replacing the dirty current draft', async () => {
    const harness = createSliceHarness();
    const cache = new Map([['draft:current', { content: 'draft text', modifiedAt: null }]]);
    harness.getState().currentNote = { path: 'draft:current', content: 'draft text' };
    harness.getState().isDirty = true;
    harness.getState().openTabs = [{ path: 'draft:current', name: '', isDirty: true }];
    harness.getState().draftNotes = {
      'draft:current': { parentPath: null, name: '' },
    };
    harness.getState().noteContentsCache = cache;

    const draftPath = await harness.getState().createNote();
    const state = harness.getState();

    expect(state.saveNote).not.toHaveBeenCalled();
    expect(state.currentNote).toEqual({ path: draftPath, content: '' });
    expect(state.openTabs).toEqual([
      { path: 'draft:current', name: '', isDirty: true },
      { path: draftPath, name: '', isDirty: false },
    ]);
    expect(state.noteContentsCache.get('draft:current')).toEqual({
      content: 'draft text',
      modifiedAt: null,
    });
  });

  it('flushes pending editor markdown before deciding whether to save on create', async () => {
    const harness = createSliceHarness({
      notesPath: '/vault',
      currentNote: { path: 'alpha.md', content: 'Old alpha' },
      isDirty: false,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['alpha.md', { content: 'Old alpha', modifiedAt: 1 }]]),
      saveNote: vi.fn(async () => {
        harness.getState().isDirty = false;
        harness.getState().openTabs = harness.getState().openTabs.map((tab: { path: string; isDirty: boolean }) =>
          tab.path === 'alpha.md' ? { ...tab, isDirty: false } : tab
        );
      }),
    });
    hoisted.flushCurrentPendingEditorMarkdown.mockImplementation(() => {
      harness.getState().currentNote = { path: 'alpha.md', content: 'New alpha' };
      harness.getState().isDirty = true;
      harness.getState().openTabs = [{ path: 'alpha.md', name: 'alpha', isDirty: true }];
      harness.getState().noteContentsCache = new Map([['alpha.md', { content: 'New alpha', modifiedAt: 1 }]]);
      return true;
    });

    await harness.getState().createNote(undefined, { asDraft: true });

    expect(hoisted.flushCurrentPendingEditorMarkdown).toHaveBeenCalledTimes(1);
    expect(harness.getState().saveNote).toHaveBeenCalledTimes(1);
  });

  it('can create an in-memory draft even when a vault is selected', async () => {
    const harness = createSliceHarness({
      notesPath: '/vault',
    });

    const draftPath = await harness.getState().createNote(undefined, { asDraft: true });
    const state = harness.getState();

    expect(draftPath).toMatch(/^draft:/);
    expect(state.notesPath).toBe('/vault');
    expect(state.currentNote).toEqual({ path: draftPath, content: '' });
    expect(state.openTabs).toEqual([{ path: draftPath, name: '', isDirty: false }]);
    expect(state.draftNotes[draftPath]).toEqual({
      parentPath: null,
      name: '',
      originNotesPath: '/vault',
      kind: 'vault',
    });
    expect(state.saveNote).not.toHaveBeenCalled();
  });

  it('creates an in-memory draft without replacing the dirty current tab when saving does not clear dirty state', async () => {
    const harness = createSliceHarness({
      notesPath: '/vault',
      currentNote: { path: 'alpha.md', content: 'Unsaved alpha' },
      isDirty: true,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: true }],
      noteContentsCache: new Map([['alpha.md', { content: 'Unsaved alpha', modifiedAt: 1 }]]),
      saveNote: vi.fn(async () => {
        harness.getState().isDirty = true;
        harness.getState().openTabs = [{ path: 'alpha.md', name: 'alpha', isDirty: true }];
      }),
    });

    const draftPath = await harness.getState().createNote(undefined, { asDraft: true });
    const state = harness.getState();

    expect(state.saveNote).toHaveBeenCalledTimes(1);
    expect(draftPath).toMatch(/^draft:/);
    expect(state.currentNote).toEqual({ path: draftPath, content: '' });
    expect(state.openTabs).toEqual([
      { path: 'alpha.md', name: 'alpha', isDirty: true },
      { path: draftPath, name: '', isDirty: false },
    ]);
    expect(state.noteContentsCache.get('alpha.md')).toEqual({
      content: 'Unsaved alpha',
      modifiedAt: 1,
    });
  });
});

describe('createFileSystemSlice tree flows', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('expands folders immediately and defers workspace persistence', () => {
    const harness = createSliceHarness({
      notesPath: '/vault',
      rootFolderPath: '/vault',
      currentNote: { path: 'alpha.md', content: '# alpha' },
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [
          {
            id: 'docs',
            name: 'docs',
            path: 'docs',
            isFolder: true,
            expanded: false,
            children: [],
          },
        ],
      },
    });

    harness.getState().toggleFolder('docs');

    expect(harness.getState().rootFolder.children[0].expanded).toBe(true);
    expect(hoisted.persistWorkspaceSnapshot).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(hoisted.persistWorkspaceSnapshot).toHaveBeenCalledWith('/vault', expect.objectContaining({
      currentNotePath: 'alpha.md',
      rootFolder: expect.objectContaining({
        children: [
          expect.objectContaining({
            path: 'docs',
            expanded: true,
          }),
        ],
      }),
    }));
  });

  it('uses the latest current note when deferred folder persistence flushes', () => {
    const harness = createSliceHarness({
      notesPath: '/vault',
      rootFolderPath: '/vault',
      currentNote: { path: 'alpha.md', content: '# alpha' },
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [
          {
            id: 'docs',
            name: 'docs',
            path: 'docs',
            isFolder: true,
            expanded: false,
            children: [],
          },
        ],
      },
    });

    harness.getState().toggleFolder('docs');
    harness.getState().currentNote = { path: 'beta.md', content: '# beta' };

    vi.runOnlyPendingTimers();

    expect(hoisted.persistWorkspaceSnapshot).toHaveBeenCalledWith('/vault', expect.objectContaining({
      currentNotePath: 'beta.md',
    }));
  });

  it('does not persist a preserved previous-vault tree as the current workspace', () => {
    const harness = createSliceHarness({
      notesPath: '/vault-next',
      rootFolderPath: '/vault-old',
      currentNote: { path: 'alpha.md', content: '# alpha' },
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [
          {
            id: 'docs',
            name: 'docs',
            path: 'docs',
            isFolder: true,
            expanded: false,
            children: [],
          },
        ],
      },
    });

    harness.getState().toggleFolder('docs');
    vi.runOnlyPendingTimers();

    expect(hoisted.persistWorkspaceSnapshot).not.toHaveBeenCalled();
  });

  it('does not collapse an empty root folder', () => {
    const harness = createSliceHarness({
      notesPath: '/vault',
      rootFolderPath: '/vault',
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [],
      },
    });

    harness.getState().toggleFolder('');
    vi.runOnlyPendingTimers();

    expect(harness.getState().rootFolder.expanded).toBe(true);
    expect(hoisted.persistWorkspaceSnapshot).not.toHaveBeenCalled();
  });

  it('reopens an empty root folder if a stale collapsed state tries to toggle', () => {
    const harness = createSliceHarness({
      notesPath: '/vault',
      rootFolderPath: '/vault',
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: false,
        children: [],
      },
    });

    harness.getState().toggleFolder('');
    vi.runOnlyPendingTimers();

    expect(harness.getState().rootFolder.expanded).toBe(true);
    expect(hoisted.persistWorkspaceSnapshot).not.toHaveBeenCalled();
  });

  it('prioritizes persisted current note, then starred notes, then recent notes for workspace restore', () => {
    expect(getWorkspaceRestoreCandidatePaths({
      currentNotePath: 'docs/last-opened.md',
      starredNotes: ['docs/favorite.md', 'docs/recent.md'],
      recentNotes: ['docs/recent.md', 'docs/older.md'],
    })).toEqual([
      'docs/last-opened.md',
      'docs/favorite.md',
      'docs/recent.md',
      'docs/older.md',
    ]);
  });

  it('uses starred notes before recent notes when no persisted current note is available', () => {
    expect(getWorkspaceRestoreCandidatePaths({
      currentNotePath: null,
      starredNotes: ['docs/favorite.md'],
      recentNotes: ['docs/recent.md'],
    })).toEqual([
      'docs/favorite.md',
      'docs/recent.md',
    ]);
  });

  it('filters unsafe and non-Markdown workspace restore candidates before probing disk', () => {
    expect(getWorkspaceRestoreCandidatePaths({
      currentNotePath: '../secret.md',
      starredNotes: ['docs/favorite.md', '/tmp/outside.md', 'docs/raw.txt', 'docs/favorite.md'],
      recentNotes: ['docs/./recent.markdown', 'docs\\older.mkd', 'draft:local.md'],
    })).toEqual([
      'docs/favorite.md',
      'docs/recent.markdown',
      'docs/older.mkd',
    ]);
  });
});

describe('replaceCurrentTabOrAppend', () => {
  it('appends a new tab instead of replacing an external note tab', () => {
    expect(
      replaceCurrentTabOrAppend(
        [{ path: '/other-vault/starred.md', name: 'starred', isDirty: false }],
        '/other-vault/starred.md',
        { path: 'Untitled.md', name: 'Untitled', isDirty: false },
      ),
    ).toEqual([
      { path: '/other-vault/starred.md', name: 'starred', isDirty: false },
      { path: 'Untitled.md', name: 'Untitled', isDirty: false },
    ]);
  });
});
