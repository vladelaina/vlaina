import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFileSystemSlice } from './fileSystemSlice';

const hoisted = vi.hoisted(() => ({
  storageAdapter: {
    exists: vi.fn(async () => false),
    rename: vi.fn(async () => undefined),
  },
  saveStarredRegistry: vi.fn(),
}));

vi.mock('@/lib/storage/adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/storage/adapter')>();
  return {
    ...actual,
    getStorageAdapter: () => hoisted.storageAdapter,
  };
});

vi.mock('../starred', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../starred')>();
  return {
    ...actual,
    saveStarredRegistry: hoisted.saveStarredRegistry,
  };
});

vi.mock('../workspacePersistence', () => ({
  persistWorkspaceSnapshot: vi.fn(),
}));

function createSliceHarness() {
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
    starredEntries: [],
    starredNotes: [],
    starredFolders: [],
    noteMetadata: null,
    displayNames: new Map(),
    saveNote: vi.fn(),
  };

  return {
    getState: () => state,
  };
}

describe('fileSystemSlice rename actions', () => {
  beforeEach(() => {
    hoisted.storageAdapter.exists.mockReset();
    hoisted.storageAdapter.exists.mockResolvedValue(false);
    hoisted.storageAdapter.rename.mockReset();
    hoisted.storageAdapter.rename.mockResolvedValue(undefined);
    hoisted.saveStarredRegistry.mockReset();
  });

  it('renames an absolute starred note and keeps the open editor state in sync', async () => {
    const harness = createSliceHarness();
    const oldPath = '/vault-b/docs/alpha.md';
    const newPath = '/vault-b/docs/beta.md';

    harness.getState().notesPath = '/vault-a';
    harness.getState().currentNote = { path: oldPath, content: '# alpha' };
    harness.getState().currentNoteRevision = 4;
    harness.getState().openTabs = [{ path: oldPath, name: 'alpha', isDirty: false }];
    harness.getState().recentNotes = [oldPath];
    harness.getState().displayNames = new Map([[oldPath, 'alpha']]);
    harness.getState().noteContentsCache = new Map([[oldPath, { content: '# alpha', modifiedAt: 1 }]]);
    harness.getState().noteMetadata = {
      version: 1,
      notes: {
        [oldPath]: { icon: 'sparkles' },
      },
    };
    harness.getState().starredEntries = [{
      id: 'starred-1',
      kind: 'note',
      vaultPath: '/vault-b',
      relativePath: 'docs/alpha.md',
      addedAt: 1,
    }];

    await harness.getState().renameAbsoluteNote(oldPath, 'beta');
    const state = harness.getState();

    expect(hoisted.storageAdapter.rename).toHaveBeenCalledWith(oldPath, newPath);
    expect(state.currentNote).toEqual({ path: newPath, content: '# alpha' });
    expect(state.currentNoteRevision).toBe(5);
    expect(state.openTabs).toEqual([{ path: newPath, name: 'beta', isDirty: false }]);
    expect(state.recentNotes).toEqual([newPath]);
    expect(state.displayNames.get(newPath)).toBe('beta');
    expect(state.noteContentsCache.get(newPath)).toEqual({ content: '# alpha', modifiedAt: 1 });
    expect(state.noteMetadata.notes[newPath]).toEqual({ icon: 'sparkles' });
    expect(state.starredEntries[0]).toMatchObject({
      vaultPath: '/vault-b',
      relativePath: 'docs/beta.md',
    });
    expect(hoisted.saveStarredRegistry).toHaveBeenCalledWith(state.starredEntries);
  });

  it('does not write a stale absolute rename result after the active vault changes', async () => {
    let resolveRename: () => void;
    hoisted.storageAdapter.rename.mockImplementation(() => new Promise<undefined>((resolve) => {
      resolveRename = () => resolve(undefined);
    }));
    const harness = createSliceHarness();
    const oldPath = '/vault-b/docs/alpha.md';

    harness.getState().notesPath = '/vault-a';
    harness.getState().currentNote = { path: oldPath, content: '# alpha' };
    harness.getState().openTabs = [{ path: oldPath, name: 'alpha', isDirty: false }];
    harness.getState().noteContentsCache = new Map([[oldPath, { content: '# alpha', modifiedAt: 1 }]]);

    const rename = harness.getState().renameAbsoluteNote(oldPath, 'beta');
    await new Promise((resolve) => setTimeout(resolve, 0));
    harness.getState().notesPath = '/vault-c';
    resolveRename!();
    await rename;

    expect(harness.getState().notesPath).toBe('/vault-c');
    expect(harness.getState().currentNote).toEqual({ path: oldPath, content: '# alpha' });
    expect(harness.getState().openTabs).toEqual([{ path: oldPath, name: 'alpha', isDirty: false }]);
  });
});
