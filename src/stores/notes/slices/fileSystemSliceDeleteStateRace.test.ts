import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  deleteNoteImpl: vi.fn(),
  deleteFolderImpl: vi.fn(),
  cancelPendingSystemTrash: vi.fn(),
  isPendingSystemTrashCommitting: vi.fn(),
  restoreNoteItemFromPendingTrash: vi.fn(),
  schedulePendingSystemTrash: vi.fn(),
  getStateForPathDeletion: vi.fn(),
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
  getStateForPathRename: vi.fn(),
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
    isDirty: false,
    error: null,
    recentNotes: [],
    openTabs: [],
    noteContentsCache: new Map(),
    draftNotes: {},
    noteMetadata: { version: 2, notes: {} },
    displayNames: new Map(),
    starredEntries: [],
    starredNotes: [],
    starredFolders: [],
    openNote: vi.fn(),
    saveNote: vi.fn(),
    loadFileTree: vi.fn(),
    pendingDeletedItems: [],
    discardDraftNote: vi.fn(),
    fileTreeSortMode: 'name-asc',
    ...overrides,
  };

  return {
    getState: () => state,
  };
}

function deletionResult(path: string, kind: 'file' | 'folder') {
  return {
    updatedTabs: [],
    updatedStarredEntries: [{
      id: 'stale-star',
      kind: 'note',
      vaultPath: '/vault',
      relativePath: 'stale.md',
      addedAt: 1,
    }],
    updatedStarredNotes: ['stale.md'],
    updatedStarredFolders: [],
    nextAction: null,
    updatedMetadata: {
      version: 2,
      notes: {
        'stale.md': { icon: 'stale' },
      },
    },
    newChildren: [],
    trashedItem: {
      id: `delete-${path}`,
      kind,
      originalPath: path,
      originalFullPath: `/vault/${path}`,
      stagingPath: `/app/.vlaina/notes/vaults/vault-test/trash/delete-${path}/${path.split('/').pop() ?? path}`,
      deletedAt: 1,
    },
  };
}

describe('fileSystemSlice deletion state races', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.flushCurrentPendingEditorMarkdown.mockReturnValue(false);
    hoisted.schedulePendingSystemTrash.mockImplementation(() => undefined);
    hoisted.isPendingSystemTrashCommitting.mockReturnValue(false);
    hoisted.getStateForPathDeletion.mockImplementation(({ recentNotes, displayNames, noteContentsCache }) => ({
      nextRecentNotes: recentNotes,
      nextDisplayNames: displayNames,
      nextNoteContentsCache: noteContentsCache,
    }));
  });

  it('preserves latest starred entries and metadata while a note deletion is in flight', async () => {
    let resolveDelete: (value: Record<string, unknown>) => void;
    hoisted.deleteNoteImpl.mockImplementation(() => new Promise((resolve) => {
      resolveDelete = resolve;
    }));
    const harness = createSliceHarness({
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [
          { id: 'alpha.md', name: 'alpha', path: 'alpha.md', isFolder: false },
          { id: 'keep.md', name: 'keep', path: 'keep.md', isFolder: false },
        ],
      },
      starredEntries: [{
        id: 'old-star',
        kind: 'note',
        vaultPath: '/vault',
        relativePath: 'old.md',
        addedAt: 1,
      }],
      noteMetadata: {
        version: 2,
        notes: {
          'alpha.md': { icon: 'old-alpha' },
        },
      },
    });

    const deletion = harness.getState().deleteNote('alpha.md');
    await new Promise((resolve) => setTimeout(resolve, 0));

    harness.getState().starredEntries = [
      {
        id: 'deleted-star',
        kind: 'note',
        vaultPath: '/vault',
        relativePath: 'alpha.md',
        addedAt: 2,
      },
      {
        id: 'keep-star',
        kind: 'note',
        vaultPath: '/vault',
        relativePath: 'keep.md',
        addedAt: 3,
      },
    ];
    harness.getState().noteMetadata = {
      version: 2,
      notes: {
        'alpha.md': { icon: 'latest-alpha' },
        'keep.md': { icon: 'keep' },
      },
    };

    resolveDelete!(deletionResult('alpha.md', 'file'));
    await deletion;

    const state = harness.getState();
    expect(state.starredEntries).toEqual([{
      id: 'keep-star',
      kind: 'note',
      vaultPath: '/vault',
      relativePath: 'keep.md',
      addedAt: 3,
    }]);
    expect(state.starredNotes).toEqual(['keep.md']);
    expect(state.noteMetadata).toEqual({
      version: 2,
      notes: {
        'keep.md': { icon: 'keep' },
      },
    });
    expect(hoisted.saveStarredRegistry).toHaveBeenCalledWith(state.starredEntries);
  });

  it('preserves latest starred entries and metadata while a folder deletion is in flight', async () => {
    let resolveDelete: (value: Record<string, unknown>) => void;
    hoisted.deleteFolderImpl.mockImplementation(() => new Promise((resolve) => {
      resolveDelete = resolve;
    }));
    const harness = createSliceHarness({
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
            expanded: true,
            children: [{ id: 'docs/alpha.md', name: 'alpha', path: 'docs/alpha.md', isFolder: false }],
          },
          { id: 'keep.md', name: 'keep', path: 'keep.md', isFolder: false },
        ],
      },
      starredEntries: [{
        id: 'old-star',
        kind: 'note',
        vaultPath: '/vault',
        relativePath: 'old.md',
        addedAt: 1,
      }],
      noteMetadata: {
        version: 2,
        notes: {
          'docs/alpha.md': { icon: 'old-alpha' },
        },
      },
    });

    const deletion = harness.getState().deleteFolder('docs');
    await new Promise((resolve) => setTimeout(resolve, 0));

    harness.getState().starredEntries = [
      {
        id: 'folder-star',
        kind: 'folder',
        vaultPath: '/vault',
        relativePath: 'docs',
        addedAt: 2,
      },
      {
        id: 'note-star',
        kind: 'note',
        vaultPath: '/vault',
        relativePath: 'docs/alpha.md',
        addedAt: 3,
      },
      {
        id: 'keep-star',
        kind: 'note',
        vaultPath: '/vault',
        relativePath: 'keep.md',
        addedAt: 4,
      },
    ];
    harness.getState().noteMetadata = {
      version: 2,
      notes: {
        'docs/alpha.md': { icon: 'latest-alpha' },
        'keep.md': { icon: 'keep' },
      },
    };

    resolveDelete!(deletionResult('docs', 'folder'));
    await deletion;

    const state = harness.getState();
    expect(state.starredEntries).toEqual([{
      id: 'keep-star',
      kind: 'note',
      vaultPath: '/vault',
      relativePath: 'keep.md',
      addedAt: 4,
    }]);
    expect(state.starredNotes).toEqual(['keep.md']);
    expect(state.starredFolders).toEqual([]);
    expect(state.noteMetadata).toEqual({
      version: 2,
      notes: {
        'keep.md': { icon: 'keep' },
      },
    });
    expect(hoisted.saveStarredRegistry).toHaveBeenCalledWith(state.starredEntries);
  });
});
