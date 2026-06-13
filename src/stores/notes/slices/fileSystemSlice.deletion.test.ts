import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  deleteNoteImpl: vi.fn(),
  deleteFolderImpl: vi.fn(),
  cancelPendingSystemTrash: vi.fn(),
  isPendingSystemTrashCommitting: vi.fn(),
  restoreNoteItemFromPendingTrash: vi.fn(),
  schedulePendingSystemTrash: vi.fn(),
  getStateForPathDeletion: vi.fn(),
  getStateForPathRename: vi.fn(),
  persistWorkspaceSnapshot: vi.fn(),
  saveStarredRegistry: vi.fn(),
  flushCurrentPendingEditorMarkdown: vi.fn(),
}));

vi.mock('../utils/fs/deleteOperations', () => ({
  deleteNoteImpl: hoisted.deleteNoteImpl,
  deleteFolderImpl: hoisted.deleteFolderImpl,
}));

vi.mock('../utils/fs/trashOperations', () => ({
  cancelPendingSystemTrash: hoisted.cancelPendingSystemTrash,
  isPendingSystemTrashCommitting: hoisted.isPendingSystemTrashCommitting,
  restoreNoteItemFromPendingTrash: hoisted.restoreNoteItemFromPendingTrash,
  schedulePendingSystemTrash: hoisted.schedulePendingSystemTrash,
}));

vi.mock('../utils/fs/pathStateEffects', () => ({
  getStateForPathDeletion: hoisted.getStateForPathDeletion,
  getStateForPathRename: hoisted.getStateForPathRename,
}));

vi.mock('../workspacePersistence', () => ({
  persistWorkspaceSnapshot: hoisted.persistWorkspaceSnapshot,
}));

vi.mock('../pendingEditorMarkdownFlusher', () => ({
  flushCurrentPendingEditorMarkdown: hoisted.flushCurrentPendingEditorMarkdown,
}));

vi.mock('../starred', async () => {
  const actual = await vi.importActual<typeof import('../starred')>('../starred');
  return {
    ...actual,
    saveStarredRegistry: hoisted.saveStarredRegistry,
  };
});

import { createFileSystemSlice } from './fileSystemSlice';

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
    notesPath: '/vault',
    currentNote: null,
    currentNoteRevision: 0,
    isDirty: true,
    error: null,
    recentNotes: [],
    openTabs: [],
    noteContentsCache: new Map(),
    draftNotes: {},
    noteMetadata: null,
    displayNames: new Map(),
    starredEntries: [],
    starredNotes: [],
    starredFolders: [],
    openNote: vi.fn(),
    saveNote: vi.fn(async () => {
      state = { ...state, isDirty: false };
    }),
    loadFileTree: vi.fn().mockResolvedValue(undefined),
    pendingDeletedItems: [],
    discardDraftNote: vi.fn(),
    ...overrides,
  };

  return {
    getState: () => state,
    setState: (partial: Record<string, unknown>) => {
      state = { ...state, ...partial };
    },
  };
}

function createPendingDeletedItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'delete-1',
    kind: 'file' as const,
    originalPath: 'alpha.md',
    originalFullPath: '/vault/alpha.md',
    stagingPath: '/app/pending-trash/delete-1/alpha.md',
    deletedAt: 1,
    previousCurrentNote: null,
    previousIsDirty: false,
    deletedStarredEntries: [],
    deletedMetadata: null,
    ...overrides,
  };
}

describe('createFileSystemSlice deletion flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.flushCurrentPendingEditorMarkdown.mockReturnValue(false);
    hoisted.schedulePendingSystemTrash.mockImplementation(() => undefined);
    hoisted.cancelPendingSystemTrash.mockReturnValue(true);
    hoisted.isPendingSystemTrashCommitting.mockReturnValue(false);
    hoisted.getStateForPathDeletion.mockImplementation(({ recentNotes, displayNames, noteContentsCache }) => ({
      nextRecentNotes: recentNotes,
      nextDisplayNames: displayNames,
      nextNoteContentsCache: noteContentsCache,
    }));
  });

  it('discards in-memory draft notes without touching the filesystem', async () => {
    const discardDraftNote = vi.fn();
    const harness = createSliceHarness({
      draftNotes: {
        'draft:blank': { parentPath: null, name: '' },
      },
      currentNote: { path: 'draft:blank', content: '' },
      openTabs: [{ path: 'draft:blank', name: '', isDirty: false }],
      discardDraftNote,
    });

    await harness.getState().deleteNote('draft:blank');

    expect(discardDraftNote).toHaveBeenCalledWith('draft:blank');
    expect(hoisted.deleteNoteImpl).not.toHaveBeenCalled();
    expect(hoisted.persistWorkspaceSnapshot).not.toHaveBeenCalled();
  });

  it('opens the resolved next note after deleting the current note', async () => {
    hoisted.deleteNoteImpl.mockResolvedValue({
      updatedTabs: [{ path: 'beta.md', name: 'beta', isDirty: false }],
      updatedStarredEntries: [],
      updatedStarredNotes: [],
      updatedStarredFolders: [],
      nextAction: { type: 'open', path: 'beta.md' },
      updatedMetadata: null,
      newChildren: [],
      trashedItem: {
        id: 'delete-1',
        kind: 'file',
        originalPath: 'alpha.md',
        originalFullPath: '/vault/alpha.md',
        stagingPath: '/app/pending-trash/delete-1/alpha.md',
        deletedAt: 1,
      },
    });

    const harness = createSliceHarness({
      currentNote: { path: 'alpha.md', content: 'alpha' },
      isDirty: true,
      openTabs: [
        { path: 'alpha.md', name: 'alpha', isDirty: false },
        { path: 'beta.md', name: 'beta', isDirty: false },
      ],
    });

    await harness.getState().deleteNote('alpha.md');

    const state = harness.getState();
    expect(state.openNote).toHaveBeenCalledWith('beta.md');
    expect(hoisted.persistWorkspaceSnapshot).toHaveBeenCalledWith('/vault', expect.objectContaining({
      currentNotePath: 'beta.md',
    }));
    expect(state.currentNote).toEqual({ path: 'alpha.md', content: 'alpha' });
    expect(state.isDirty).toBe(false);
    expect(state.pendingDeletedItems).toEqual([expect.objectContaining({
      originalPath: 'alpha.md',
      stagingPath: '/app/pending-trash/delete-1/alpha.md',
      previousCurrentNote: { path: 'alpha.md', content: 'alpha' },
      deletedStarredEntries: [],
      deletedMetadata: null,
    })]);
    expect(hoisted.schedulePendingSystemTrash).toHaveBeenCalledWith(
      expect.objectContaining({ originalPath: 'alpha.md' }),
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('flushes pending editor markdown before deciding whether to save on delete', async () => {
    hoisted.deleteNoteImpl.mockResolvedValue({
      updatedTabs: [],
      updatedStarredEntries: [],
      updatedStarredNotes: [],
      updatedStarredFolders: [],
      nextAction: null,
      updatedMetadata: null,
      newChildren: [],
      trashedItem: {
        id: 'delete-1',
        kind: 'file',
        originalPath: 'alpha.md',
        originalFullPath: '/vault/alpha.md',
        stagingPath: '/app/pending-trash/delete-1/alpha.md',
        deletedAt: 1,
      },
    });
    const harness = createSliceHarness({
      currentNote: { path: 'alpha.md', content: 'Old alpha' },
      isDirty: false,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['alpha.md', { content: 'Old alpha', modifiedAt: 1 }]]),
    });
    hoisted.flushCurrentPendingEditorMarkdown.mockImplementation(() => {
      harness.setState({
        currentNote: { path: 'alpha.md', content: 'New alpha' },
        isDirty: true,
        openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: true }],
        noteContentsCache: new Map([['alpha.md', { content: 'New alpha', modifiedAt: 1 }]]),
      });
      return true;
    });

    await harness.getState().deleteNote('alpha.md');

    expect(hoisted.flushCurrentPendingEditorMarkdown).toHaveBeenCalledTimes(1);
    expect(harness.getState().saveNote).toHaveBeenCalledTimes(1);
  });

  it('clears the current note after deleting it when no tab remains, even if another file exists in the tree', async () => {
    hoisted.deleteNoteImpl.mockResolvedValue({
      updatedTabs: [],
      updatedStarredEntries: [],
      updatedStarredNotes: [],
      updatedStarredFolders: [],
      nextAction: null,
      updatedMetadata: null,
      newChildren: [{ id: 'Untitled.md', name: 'Untitled', path: 'Untitled.md', isFolder: false }],
      trashedItem: {
        id: 'delete-1',
        kind: 'file',
        originalPath: 'alpha.md',
        originalFullPath: '/vault/alpha.md',
        stagingPath: '/app/pending-trash/delete-1/alpha.md',
        deletedAt: 1,
      },
    });

    const harness = createSliceHarness({
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [
          { id: 'alpha.md', name: 'alpha', path: 'alpha.md', isFolder: false },
          { id: 'Untitled.md', name: 'Untitled', path: 'Untitled.md', isFolder: false },
        ],
      },
      currentNote: { path: 'alpha.md', content: 'alpha' },
      isDirty: false,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
    });

    await harness.getState().deleteNote('alpha.md');

    const state = harness.getState();
    expect(state.openNote).not.toHaveBeenCalled();
    expect(state.currentNote).toBeNull();
    expect(state.isDirty).toBe(false);
    expect(state.openTabs).toEqual([]);
    expect(state.rootFolder.children).toEqual([
      { id: 'Untitled.md', name: 'Untitled', path: 'Untitled.md', isFolder: false },
    ]);
    expect(hoisted.persistWorkspaceSnapshot).toHaveBeenCalledWith('/vault', expect.objectContaining({
      currentNotePath: null,
    }));
  });

  it('does not write stale deletion state after the active vault changes', async () => {
    let resolveDelete: (value: Record<string, unknown>) => void;
    hoisted.deleteNoteImpl.mockImplementation(() => new Promise((resolve) => {
      resolveDelete = resolve;
    }));
    const harness = createSliceHarness({
      currentNote: { path: 'alpha.md', content: 'alpha' },
      isDirty: false,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
    });

    const deletion = harness.getState().deleteNote('alpha.md');
    harness.setState({
      notesPath: '/vault-next',
      currentNote: null,
      openTabs: [],
      pendingDeletedItems: [],
    });
    resolveDelete!({
      updatedTabs: [],
      updatedStarredEntries: [],
      updatedStarredNotes: [],
      updatedStarredFolders: [],
      nextAction: null,
      updatedMetadata: null,
      newChildren: [],
      trashedItem: {
        id: 'delete-1',
        kind: 'file',
        originalPath: 'alpha.md',
        originalFullPath: '/vault/alpha.md',
        stagingPath: '/app/pending-trash/delete-1/alpha.md',
        deletedAt: 1,
      },
    });
    await deletion;

    expect(harness.getState().notesPath).toBe('/vault-next');
    expect(harness.getState().currentNote).toBeNull();
    expect(harness.getState().openTabs).toEqual([]);
    expect(harness.getState().pendingDeletedItems).toEqual([]);
    expect(hoisted.persistWorkspaceSnapshot).not.toHaveBeenCalled();
  });

  it('keeps edits made to another open note while deleting a background note', async () => {
    let resolveDelete: (value: Record<string, unknown>) => void;
    hoisted.deleteNoteImpl.mockImplementation(() => new Promise((resolve) => {
      resolveDelete = resolve;
    }));
    const harness = createSliceHarness({
      currentNote: { path: 'alpha.md', content: 'Old alpha' },
      isDirty: false,
      openTabs: [
        { path: 'alpha.md', name: 'alpha', isDirty: false },
        { path: 'beta.md', name: 'beta', isDirty: false },
      ],
      noteContentsCache: new Map([
        ['alpha.md', { content: 'Old alpha', modifiedAt: 1 }],
        ['beta.md', { content: 'Beta', modifiedAt: 1 }],
      ]),
    });

    const deletion = harness.getState().deleteNote('beta.md');
    await new Promise((resolve) => setTimeout(resolve, 0));
    harness.setState({
      currentNote: { path: 'alpha.md', content: 'New alpha' },
      isDirty: true,
      openTabs: [
        { path: 'alpha.md', name: 'alpha', isDirty: true },
        { path: 'beta.md', name: 'beta', isDirty: false },
      ],
      noteContentsCache: new Map([
        ['alpha.md', { content: 'New alpha', modifiedAt: 2 }],
        ['beta.md', { content: 'Beta', modifiedAt: 1 }],
      ]),
    });
    resolveDelete!({
      updatedTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
      updatedStarredEntries: [],
      updatedStarredNotes: [],
      updatedStarredFolders: [],
      nextAction: null,
      updatedMetadata: null,
      newChildren: [],
      trashedItem: {
        id: 'delete-1',
        kind: 'file',
        originalPath: 'beta.md',
        originalFullPath: '/vault/beta.md',
        stagingPath: '/app/pending-trash/delete-1/beta.md',
        deletedAt: 1,
      },
    });
    await deletion;

    const state = harness.getState();
    expect(state.currentNote).toEqual({ path: 'alpha.md', content: 'New alpha' });
    expect(state.isDirty).toBe(true);
    expect(state.openTabs).toEqual([{ path: 'alpha.md', name: 'alpha', isDirty: true }]);
    expect(state.noteContentsCache.get('alpha.md')).toEqual({
      content: 'New alpha',
      modifiedAt: 2,
    });
  });

  it('keeps newer edits made to the current note while deletion is in flight', async () => {
    let resolveDelete: (value: Record<string, unknown>) => void;
    hoisted.deleteNoteImpl.mockImplementation(() => new Promise((resolve) => {
      resolveDelete = resolve;
    }));
    const harness = createSliceHarness({
      currentNote: { path: 'alpha.md', content: 'Old alpha' },
      isDirty: false,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['alpha.md', { content: 'Old alpha', modifiedAt: 1 }]]),
    });

    const deletion = harness.getState().deleteNote('alpha.md');
    await new Promise((resolve) => setTimeout(resolve, 0));
    harness.setState({
      currentNote: { path: 'alpha.md', content: 'New alpha' },
      isDirty: true,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: true }],
      noteContentsCache: new Map([['alpha.md', { content: 'New alpha', modifiedAt: 2 }]]),
    });
    resolveDelete!({
      updatedTabs: [],
      updatedStarredEntries: [],
      updatedStarredNotes: [],
      updatedStarredFolders: [],
      nextAction: null,
      updatedMetadata: null,
      newChildren: [],
      trashedItem: {
        id: 'delete-1',
        kind: 'file',
        originalPath: 'alpha.md',
        originalFullPath: '/vault/alpha.md',
        stagingPath: '/app/pending-trash/delete-1/alpha.md',
        deletedAt: 1,
      },
    });
    await deletion;

    const state = harness.getState();
    expect(state.currentNote).toEqual({ path: 'alpha.md', content: 'New alpha' });
    expect(state.isDirty).toBe(true);
    expect(state.openTabs).toEqual([{ path: 'alpha.md', name: 'alpha', isDirty: true }]);
    expect(state.noteContentsCache.get('alpha.md')).toEqual({
      content: 'New alpha',
      modifiedAt: 2,
    });
    expect(state.openNote).not.toHaveBeenCalled();
    expect(hoisted.persistWorkspaceSnapshot).toHaveBeenCalledWith('/vault', expect.objectContaining({
      currentNotePath: 'alpha.md',
    }));
  });

  it('does not delete the current dirty note when saving fails first', async () => {
    const saveNote = vi.fn().mockResolvedValue(undefined);
    const harness = createSliceHarness({
      currentNote: { path: 'alpha.md', content: 'dirty alpha' },
      isDirty: true,
      saveNote,
    });

    await harness.getState().deleteNote('alpha.md');

    const state = harness.getState();
    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(hoisted.deleteNoteImpl).not.toHaveBeenCalled();
    expect(state.pendingDeletedItems).toEqual([]);
    expect(state.error).toBe('Failed to save current note before deleting it');
  });

  it('clears the current note when deleting a folder without a replacement note', async () => {
    hoisted.deleteFolderImpl.mockResolvedValue({
      updatedTabs: [],
      updatedStarredEntries: [],
      updatedStarredNotes: [],
      updatedStarredFolders: [],
      nextAction: null,
      updatedMetadata: null,
      newChildren: [],
      trashedItem: {
        id: 'delete-1',
        kind: 'folder',
        originalPath: 'docs',
        originalFullPath: '/vault/docs',
        stagingPath: '/app/pending-trash/delete-1/docs',
        deletedAt: 1,
      },
    });

    const harness = createSliceHarness({
      currentNote: { path: 'docs/alpha.md', content: 'alpha' },
      isDirty: true,
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
    });

    await harness.getState().deleteFolder('docs');

    const state = harness.getState();
    expect(state.openNote).not.toHaveBeenCalled();
    expect(state.currentNote).toBeNull();
    expect(state.isDirty).toBe(false);
    expect(hoisted.persistWorkspaceSnapshot).toHaveBeenCalledWith('/vault', expect.objectContaining({
      currentNotePath: null,
    }));
  });

  it('keeps newer edits made to the current note while folder deletion is in flight', async () => {
    let resolveDelete: (value: Record<string, unknown>) => void;
    hoisted.deleteFolderImpl.mockImplementation(() => new Promise((resolve) => {
      resolveDelete = resolve;
    }));
    const harness = createSliceHarness({
      currentNote: { path: 'docs/alpha.md', content: 'Old alpha' },
      isDirty: false,
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['docs/alpha.md', { content: 'Old alpha', modifiedAt: 1 }]]),
    });

    const deletion = harness.getState().deleteFolder('docs');
    await new Promise((resolve) => setTimeout(resolve, 0));
    harness.setState({
      currentNote: { path: 'docs/alpha.md', content: 'New alpha' },
      isDirty: true,
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: true }],
      noteContentsCache: new Map([['docs/alpha.md', { content: 'New alpha', modifiedAt: 2 }]]),
    });
    resolveDelete!({
      updatedTabs: [],
      updatedStarredEntries: [],
      updatedStarredNotes: [],
      updatedStarredFolders: [],
      nextAction: null,
      updatedMetadata: null,
      newChildren: [],
      trashedItem: {
        id: 'delete-1',
        kind: 'folder',
        originalPath: 'docs',
        originalFullPath: '/vault/docs',
        stagingPath: '/app/pending-trash/delete-1/docs',
        deletedAt: 1,
      },
    });
    await deletion;

    const state = harness.getState();
    expect(state.currentNote).toEqual({ path: 'docs/alpha.md', content: 'New alpha' });
    expect(state.isDirty).toBe(true);
    expect(state.openTabs).toEqual([{ path: 'docs/alpha.md', name: 'alpha', isDirty: true }]);
    expect(state.noteContentsCache.get('docs/alpha.md')).toEqual({
      content: 'New alpha',
      modifiedAt: 2,
    });
    expect(state.openNote).not.toHaveBeenCalled();
    expect(hoisted.persistWorkspaceSnapshot).toHaveBeenCalledWith('/vault', expect.objectContaining({
      currentNotePath: 'docs/alpha.md',
    }));
  });

  it('restores the last pending deleted file and opens it', async () => {
    hoisted.restoreNoteItemFromPendingTrash.mockResolvedValue({
      restoredPath: 'alpha.md',
      restoredFullPath: '/vault/alpha.md',
    });

    const harness = createSliceHarness({
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [],
      },
      pendingDeletedItems: [{
        id: 'delete-1',
        kind: 'file',
        originalPath: 'alpha.md',
        originalFullPath: '/vault/alpha.md',
        stagingPath: '/app/pending-trash/delete-1/alpha.md',
        deletedAt: 1,
        previousCurrentNote: null,
        previousIsDirty: false,
        deletedStarredEntries: [],
        deletedMetadata: null,
      }],
    });

    await expect(harness.getState().restoreLastDeletedItem()).resolves.toBe('alpha.md');

    const state = harness.getState();
    expect(hoisted.cancelPendingSystemTrash).toHaveBeenCalledWith('delete-1');
    expect(hoisted.restoreNoteItemFromPendingTrash).toHaveBeenCalledWith('/vault', expect.objectContaining({
      originalPath: 'alpha.md',
      stagingPath: '/app/pending-trash/delete-1/alpha.md',
    }));
    expect(state.loadFileTree).not.toHaveBeenCalled();
    expect(state.rootFolder.children).toEqual([{
      id: 'alpha.md',
      name: 'alpha',
      path: 'alpha.md',
      isFolder: false,
    }]);
    expect(state.openNote).toHaveBeenCalledWith('alpha.md');
    expect(state.pendingDeletedItems).toEqual([]);
  });

  it('restores pending deleted items in reverse deletion order', async () => {
    hoisted.restoreNoteItemFromPendingTrash
      .mockResolvedValueOnce({
        restoredPath: 'beta.md',
        restoredFullPath: '/vault/beta.md',
      })
      .mockResolvedValueOnce({
        restoredPath: 'alpha.md',
        restoredFullPath: '/vault/alpha.md',
      });

    const harness = createSliceHarness({
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [],
      },
      pendingDeletedItems: [
        createPendingDeletedItem(),
        createPendingDeletedItem({
          id: 'delete-2',
          originalPath: 'beta.md',
          originalFullPath: '/vault/beta.md',
          stagingPath: '/app/pending-trash/delete-2/beta.md',
          deletedAt: 2,
        }),
      ],
    });

    await expect(harness.getState().restoreLastDeletedItem()).resolves.toBe('beta.md');
    expect(harness.getState().pendingDeletedItems).toEqual([
      expect.objectContaining({ originalPath: 'alpha.md' }),
    ]);

    await expect(harness.getState().restoreLastDeletedItem()).resolves.toBe('alpha.md');
    expect(harness.getState().pendingDeletedItems).toEqual([]);
    expect(hoisted.restoreNoteItemFromPendingTrash).toHaveBeenNthCalledWith(
      1,
      '/vault',
      expect.objectContaining({ originalPath: 'beta.md' }),
    );
    expect(hoisted.restoreNoteItemFromPendingTrash).toHaveBeenNthCalledWith(
      2,
      '/vault',
      expect.objectContaining({ originalPath: 'alpha.md' }),
    );
  });

  it('does not drop newer pending deletions when restore finishes asynchronously', async () => {
    const harness = createSliceHarness({
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [],
      },
      pendingDeletedItems: [createPendingDeletedItem()],
    });

    hoisted.restoreNoteItemFromPendingTrash.mockImplementation(async () => {
      harness.setState({
        pendingDeletedItems: [
          ...harness.getState().pendingDeletedItems,
          createPendingDeletedItem({
            id: 'delete-2',
            originalPath: 'beta.md',
            originalFullPath: '/vault/beta.md',
            stagingPath: '/app/pending-trash/delete-2/beta.md',
            deletedAt: 2,
          }),
        ],
      });
      return {
        restoredPath: 'alpha.md',
        restoredFullPath: '/vault/alpha.md',
      };
    });

    await expect(harness.getState().restoreLastDeletedItem()).resolves.toBe('alpha.md');

    expect(harness.getState().pendingDeletedItems).toEqual([
      expect.objectContaining({ id: 'delete-2', originalPath: 'beta.md' }),
    ]);
  });

  it('keeps the pending deleted item and reschedules commit when restore fails', async () => {
    hoisted.restoreNoteItemFromPendingTrash.mockRejectedValue(new Error('missing pending trash item'));

    const harness = createSliceHarness({
      pendingDeletedItems: [createPendingDeletedItem()],
    });

    await expect(harness.getState().restoreLastDeletedItem()).resolves.toBeNull();

    const state = harness.getState();
    expect(state.pendingDeletedItems).toEqual([
      expect.objectContaining({ originalPath: 'alpha.md' }),
    ]);
    expect(hoisted.schedulePendingSystemTrash).toHaveBeenCalledWith(
      expect.objectContaining({ originalPath: 'alpha.md' }),
      expect.any(Function),
      expect.any(Function),
    );
    expect(state.error).toBe('missing pending trash item');
  });

  it('restores a pending deleted folder without reloading the whole file tree', async () => {
    hoisted.restoreNoteItemFromPendingTrash.mockResolvedValue({
      restoredPath: 'docs',
      restoredFullPath: '/vault/docs',
    });

    const harness = createSliceHarness({
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [],
      },
      pendingDeletedItems: [
        createPendingDeletedItem({
          kind: 'folder',
          originalPath: 'docs',
          originalFullPath: '/vault/docs',
          stagingPath: '/app/pending-trash/delete-1/docs',
        }),
      ],
    });

    await expect(harness.getState().restoreLastDeletedItem()).resolves.toBe('docs');

    const state = harness.getState();
    expect(state.loadFileTree).not.toHaveBeenCalled();
    expect(state.rootFolder.children).toEqual([{
      id: 'docs',
      name: 'docs',
      path: 'docs',
      isFolder: true,
      expanded: true,
      children: [],
    }]);
  });

  it('restores deleted starred and metadata state with the restored path', async () => {
    hoisted.restoreNoteItemFromPendingTrash.mockResolvedValue({
      restoredPath: 'alpha 1.md',
      restoredFullPath: '/vault/alpha 1.md',
    });

    const deletedStarredEntry = {
      id: 'star-1',
      kind: 'note' as const,
      vaultPath: '/vault',
      relativePath: 'alpha.md',
      addedAt: 10,
    };
    const harness = createSliceHarness({
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [],
      },
      noteMetadata: { version: 2, notes: {} },
      starredEntries: [],
      starredNotes: [],
      starredFolders: [],
      pendingDeletedItems: [
        createPendingDeletedItem({
          deletedStarredEntries: [deletedStarredEntry],
          deletedMetadata: {
            version: 2,
            notes: {
              'alpha.md': {
                icon: 'icon-alpha',
                createdAt: 1,
                updatedAt: 2,
              },
            },
          },
        }),
      ],
    });

    await expect(harness.getState().restoreLastDeletedItem()).resolves.toBe('alpha 1.md');

    const state = harness.getState();
    expect(state.starredEntries).toEqual([
      expect.objectContaining({
        id: 'star-1',
        relativePath: 'alpha 1.md',
      }),
    ]);
    expect(state.starredNotes).toEqual(['alpha 1.md']);
    expect(state.noteMetadata.notes['alpha 1.md']).toEqual({
      icon: 'icon-alpha',
      createdAt: 1,
      updatedAt: 2,
    });
    expect(hoisted.saveStarredRegistry).toHaveBeenCalledWith(state.starredEntries);
  });

  it('does not restore a pending item after it has started moving to system trash', async () => {
    hoisted.cancelPendingSystemTrash.mockReturnValue(false);
    hoisted.isPendingSystemTrashCommitting.mockReturnValue(true);

    const harness = createSliceHarness({
      pendingDeletedItems: [{
        id: 'delete-1',
        kind: 'file',
        originalPath: 'alpha.md',
        originalFullPath: '/vault/alpha.md',
        stagingPath: '/app/pending-trash/delete-1/alpha.md',
        deletedAt: 1,
        previousCurrentNote: null,
        previousIsDirty: false,
        deletedStarredEntries: [],
        deletedMetadata: null,
      }],
    });

    await expect(harness.getState().restoreLastDeletedItem()).resolves.toBeNull();

    expect(hoisted.restoreNoteItemFromPendingTrash).not.toHaveBeenCalled();
    expect(hoisted.schedulePendingSystemTrash).not.toHaveBeenCalled();
    expect(harness.getState().pendingDeletedItems).toEqual([
      expect.objectContaining({ id: 'delete-1' }),
    ]);
    expect(harness.getState().error).toBe('Deleted item is already moving to system trash.');
  });
});
