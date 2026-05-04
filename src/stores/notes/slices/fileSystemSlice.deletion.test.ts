import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  deleteNoteImpl: vi.fn(),
  deleteFolderImpl: vi.fn(),
  restoreNoteItemFromRecoverableLocation: vi.fn(),
  getStateForPathDeletion: vi.fn(),
  getStateForPathRename: vi.fn(),
  persistWorkspaceSnapshot: vi.fn(),
  saveStarredRegistry: vi.fn(),
}));

vi.mock('../utils/fs/deleteOperations', () => ({
  deleteNoteImpl: hoisted.deleteNoteImpl,
  deleteFolderImpl: hoisted.deleteFolderImpl,
}));

vi.mock('../utils/fs/trashOperations', () => ({
  restoreNoteItemFromRecoverableLocation: hoisted.restoreNoteItemFromRecoverableLocation,
}));

vi.mock('../utils/fs/pathStateEffects', () => ({
  getStateForPathDeletion: hoisted.getStateForPathDeletion,
  getStateForPathRename: hoisted.getStateForPathRename,
}));

vi.mock('../workspacePersistence', () => ({
  persistWorkspaceSnapshot: hoisted.persistWorkspaceSnapshot,
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
    ...overrides,
  };

  return {
    getState: () => state,
    setState: (partial: Record<string, unknown>) => {
      state = { ...state, ...partial };
    },
  };
}

describe('createFileSystemSlice deletion flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.getStateForPathDeletion.mockImplementation(({ recentNotes, displayNames, noteContentsCache }) => ({
      nextRecentNotes: recentNotes,
      nextDisplayNames: displayNames,
      nextNoteContentsCache: noteContentsCache,
    }));
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
      recoverableDelete: {
        id: 'delete-1',
        kind: 'file',
        originalPath: 'alpha.md',
        originalFullPath: '/vault/alpha.md',
        trashPath: '/app/.vlaina/store/notes/vaults/vault-test/trash/delete-1/alpha.md',
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
      trashPath: '/app/.vlaina/store/notes/vaults/vault-test/trash/delete-1/alpha.md',
    })]);
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
      recoverableDelete: {
        id: 'delete-1',
        kind: 'folder',
        originalPath: 'docs',
        originalFullPath: '/vault/docs',
        trashPath: '/app/.vlaina/store/notes/vaults/vault-test/trash/delete-1/docs',
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

  it('restores the last deleted file and opens it', async () => {
    hoisted.restoreNoteItemFromRecoverableLocation.mockResolvedValue({
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
        trashPath: '/app/.vlaina/store/notes/vaults/vault-test/trash/delete-1/alpha.md',
        deletedAt: 1,
        previousCurrentNote: null,
        previousIsDirty: false,
        deletedStarredEntries: [],
        deletedMetadata: null,
      }],
    });

    await expect(harness.getState().restoreLastDeletedItem()).resolves.toBe('alpha.md');

    const state = harness.getState();
    expect(hoisted.restoreNoteItemFromRecoverableLocation).toHaveBeenCalledWith('/vault', expect.objectContaining({
      originalPath: 'alpha.md',
    }));
    expect(state.loadFileTree).not.toHaveBeenCalled();
    expect(state.rootFolder.children).toEqual([
      {
        id: 'alpha.md',
        name: 'alpha',
        path: 'alpha.md',
        isFolder: false,
      },
    ]);
    expect(state.openNote).toHaveBeenCalledWith('alpha.md');
    expect(state.pendingDeletedItems).toEqual([]);
  });

  it('restores deleted items in reverse deletion order', async () => {
    hoisted.restoreNoteItemFromRecoverableLocation
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
        {
          id: 'delete-1',
          kind: 'file',
          originalPath: 'alpha.md',
          originalFullPath: '/vault/alpha.md',
          trashPath: '/app/.vlaina/store/notes/vaults/vault-test/trash/delete-1/alpha.md',
          deletedAt: 1,
          previousCurrentNote: null,
          previousIsDirty: false,
          deletedStarredEntries: [],
          deletedMetadata: null,
        },
        {
          id: 'delete-2',
          kind: 'file',
          originalPath: 'beta.md',
          originalFullPath: '/vault/beta.md',
          trashPath: '/app/.vlaina/store/notes/vaults/vault-test/trash/delete-2/beta.md',
          deletedAt: 2,
          previousCurrentNote: null,
          previousIsDirty: false,
          deletedStarredEntries: [],
          deletedMetadata: null,
        },
      ],
    });

    await expect(harness.getState().restoreLastDeletedItem()).resolves.toBe('beta.md');
    expect(harness.getState().pendingDeletedItems).toEqual([
      expect.objectContaining({ originalPath: 'alpha.md' }),
    ]);

    await expect(harness.getState().restoreLastDeletedItem()).resolves.toBe('alpha.md');
    expect(harness.getState().pendingDeletedItems).toEqual([]);
    expect(hoisted.restoreNoteItemFromRecoverableLocation).toHaveBeenNthCalledWith(
      1,
      '/vault',
      expect.objectContaining({ originalPath: 'beta.md' }),
    );
    expect(hoisted.restoreNoteItemFromRecoverableLocation).toHaveBeenNthCalledWith(
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
      pendingDeletedItems: [{
        id: 'delete-1',
        kind: 'file',
        originalPath: 'alpha.md',
        originalFullPath: '/vault/alpha.md',
        trashPath: '/app/.vlaina/store/notes/vaults/vault-test/trash/delete-1/alpha.md',
        deletedAt: 1,
        previousCurrentNote: null,
        previousIsDirty: false,
        deletedStarredEntries: [],
        deletedMetadata: null,
      }],
    });

    hoisted.restoreNoteItemFromRecoverableLocation.mockImplementation(async () => {
      harness.setState({
        pendingDeletedItems: [
          ...harness.getState().pendingDeletedItems,
          {
            id: 'delete-2',
            kind: 'file',
            originalPath: 'beta.md',
            originalFullPath: '/vault/beta.md',
            trashPath: '/app/.vlaina/store/notes/vaults/vault-test/trash/delete-2/beta.md',
            deletedAt: 2,
            previousCurrentNote: null,
            previousIsDirty: false,
            deletedStarredEntries: [],
            deletedMetadata: null,
          },
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

  it('keeps the pending deleted item when restore fails', async () => {
    hoisted.restoreNoteItemFromRecoverableLocation.mockRejectedValue(new Error('missing trash item'));

    const harness = createSliceHarness({
      pendingDeletedItems: [{
        id: 'delete-1',
        kind: 'file',
        originalPath: 'alpha.md',
        originalFullPath: '/vault/alpha.md',
        trashPath: '/app/.vlaina/store/notes/vaults/vault-test/trash/delete-1/alpha.md',
        deletedAt: 1,
        previousCurrentNote: null,
        previousIsDirty: false,
        deletedStarredEntries: [],
        deletedMetadata: null,
      }],
    });

    await expect(harness.getState().restoreLastDeletedItem()).resolves.toBeNull();

    const state = harness.getState();
    expect(state.pendingDeletedItems).toEqual([
      expect.objectContaining({ originalPath: 'alpha.md' }),
    ]);
    expect(state.error).toBe('missing trash item');
  });

  it('restores a folder without reloading the whole file tree', async () => {
    hoisted.restoreNoteItemFromRecoverableLocation.mockResolvedValue({
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
      pendingDeletedItems: [{
        id: 'delete-1',
        kind: 'folder',
        originalPath: 'docs',
        originalFullPath: '/vault/docs',
        trashPath: '/app/.vlaina/store/notes/vaults/vault-test/trash/delete-1/docs',
        deletedAt: 1,
        previousCurrentNote: null,
        previousIsDirty: false,
        deletedStarredEntries: [],
        deletedMetadata: null,
      }],
    });

    await expect(harness.getState().restoreLastDeletedItem()).resolves.toBe('docs');

    const state = harness.getState();
    expect(state.loadFileTree).not.toHaveBeenCalled();
    expect(state.rootFolder.children).toEqual([
      {
        id: 'docs',
        name: 'docs',
        path: 'docs',
        isFolder: true,
        expanded: true,
        children: [],
      },
    ]);
  });

  it('restores deleted starred and metadata state with the restored path', async () => {
    hoisted.restoreNoteItemFromRecoverableLocation.mockResolvedValue({
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
      pendingDeletedItems: [{
        id: 'delete-1',
        kind: 'file',
        originalPath: 'alpha.md',
        originalFullPath: '/vault/alpha.md',
        trashPath: '/app/.vlaina/store/notes/vaults/vault-test/trash/delete-1/alpha.md',
        deletedAt: 1,
        previousCurrentNote: null,
        previousIsDirty: false,
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
      }],
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
});
