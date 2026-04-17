import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  deleteNoteImpl: vi.fn(),
  deleteFolderImpl: vi.fn(),
  getStateForPathDeletion: vi.fn(),
  getStateForPathRename: vi.fn(),
  persistWorkspaceSnapshot: vi.fn(),
}));

vi.mock('../utils/fs/deleteOperations', () => ({
  deleteNoteImpl: hoisted.deleteNoteImpl,
  deleteFolderImpl: hoisted.deleteFolderImpl,
}));

vi.mock('../utils/fs/pathStateEffects', () => ({
  getStateForPathDeletion: hoisted.getStateForPathDeletion,
  getStateForPathRename: hoisted.getStateForPathRename,
}));

vi.mock('../workspacePersistence', () => ({
  persistWorkspaceSnapshot: hoisted.persistWorkspaceSnapshot,
}));

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
    saveNote: vi.fn(),
    ...overrides,
  };

  return {
    getState: () => state,
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
    expect(state.isDirty).toBe(true);
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
});
