import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFileSystemSlice } from './fileSystemSlice';
import { setPendingEditorMarkdownFlusher } from '../pendingEditorMarkdownFlusher';

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
    setPendingEditorMarkdownFlusher(null);
  });

  afterEach(() => {
    setPendingEditorMarkdownFlusher(null);
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

  it('renames a root-vault absolute starred note and keeps the starred entry relative', async () => {
    const harness = createSliceHarness();
    const oldPath = '/docs/alpha.md';
    const newPath = '/docs/beta.md';

    harness.getState().notesPath = '/vault-a';
    harness.getState().currentNote = { path: oldPath, content: '# alpha' };
    harness.getState().openTabs = [{ path: oldPath, name: 'alpha', isDirty: false }];
    harness.getState().noteContentsCache = new Map([[oldPath, { content: '# alpha', modifiedAt: 1 }]]);
    harness.getState().starredEntries = [{
      id: 'starred-root',
      kind: 'note',
      vaultPath: '/',
      relativePath: 'docs/alpha.md',
      addedAt: 1,
    }];

    await harness.getState().renameAbsoluteNote(oldPath, 'beta');
    const state = harness.getState();

    expect(hoisted.storageAdapter.rename).toHaveBeenCalledWith(oldPath, newPath);
    expect(state.starredEntries[0]).toMatchObject({
      vaultPath: '/',
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

  it('keeps edits made while an absolute rename is in flight', async () => {
    let resolveRename: () => void;
    hoisted.storageAdapter.rename.mockImplementation(() => new Promise<undefined>((resolve) => {
      resolveRename = () => resolve(undefined);
    }));
    const harness = createSliceHarness();
    const oldPath = '/vault-b/docs/alpha.md';
    const newPath = '/vault-b/docs/beta.md';

    harness.getState().notesPath = '/vault-a';
    harness.getState().currentNote = { path: oldPath, content: '# alpha' };
    harness.getState().currentNoteRevision = 4;
    harness.getState().isDirty = false;
    harness.getState().openTabs = [{ path: oldPath, name: 'alpha', isDirty: false }];
    harness.getState().noteContentsCache = new Map([[oldPath, { content: '# alpha', modifiedAt: 1 }]]);

    const rename = harness.getState().renameAbsoluteNote(oldPath, 'beta');
    await new Promise((resolve) => setTimeout(resolve, 0));

    harness.getState().currentNote = { path: oldPath, content: '# edited while renaming' };
    harness.getState().currentNoteRevision = 8;
    harness.getState().isDirty = true;
    harness.getState().openTabs = [{ path: oldPath, name: 'alpha', isDirty: true }];
    harness.getState().noteContentsCache = new Map([
      [oldPath, { content: '# edited while renaming', modifiedAt: 2 }],
    ]);

    resolveRename!();
    await rename;

    const state = harness.getState();
    expect(state.currentNote).toEqual({ path: newPath, content: '# edited while renaming' });
    expect(state.currentNoteRevision).toBe(9);
    expect(state.isDirty).toBe(true);
    expect(state.openTabs).toEqual([{ path: newPath, name: 'beta', isDirty: true }]);
    expect(state.noteContentsCache.has(oldPath)).toBe(false);
    expect(state.noteContentsCache.get(newPath)).toEqual({
      content: '# edited while renaming',
      modifiedAt: 2,
    });
  });

  it('flushes pending editor markdown before an absolute rename reads state', async () => {
    const harness = createSliceHarness();
    const oldPath = '/vault-b/docs/alpha.md';
    const newPath = '/vault-b/docs/beta.md';

    harness.getState().notesPath = '/vault-a';
    harness.getState().currentNote = { path: oldPath, content: '# alpha' };
    harness.getState().currentNoteRevision = 4;
    harness.getState().isDirty = false;
    harness.getState().openTabs = [{ path: oldPath, name: 'alpha', isDirty: false }];
    harness.getState().noteContentsCache = new Map([[oldPath, { content: '# alpha', modifiedAt: 1 }]]);
    setPendingEditorMarkdownFlusher(() => {
      harness.getState().currentNote = { path: oldPath, content: '# pending editor text' };
      harness.getState().currentNoteRevision = 5;
      harness.getState().isDirty = true;
      harness.getState().openTabs = [{ path: oldPath, name: 'alpha', isDirty: true }];
      harness.getState().noteContentsCache = new Map([
        [oldPath, { content: '# pending editor text', modifiedAt: 1 }],
      ]);
      return true;
    });

    await harness.getState().renameAbsoluteNote(oldPath, 'beta');

    const state = harness.getState();
    expect(hoisted.storageAdapter.rename).toHaveBeenCalledWith(oldPath, newPath);
    expect(state.currentNote).toEqual({ path: newPath, content: '# pending editor text' });
    expect(state.currentNoteRevision).toBe(6);
    expect(state.isDirty).toBe(true);
    expect(state.openTabs).toEqual([{ path: newPath, name: 'beta', isDirty: true }]);
    expect(state.noteContentsCache.get(newPath)).toEqual({
      content: '# pending editor text',
      modifiedAt: 1,
    });
  });

  it('rejects unsupported characters before an absolute rename reaches storage', async () => {
    const harness = createSliceHarness();
    const oldPath = '/vault-b/docs/alpha.md';

    harness.getState().notesPath = '/vault-a';
    harness.getState().currentNote = { path: oldPath, content: '# alpha' };

    await harness.getState().renameAbsoluteNote(oldPath, 'bad/name');

    expect(hoisted.storageAdapter.rename).not.toHaveBeenCalled();
    expect(harness.getState().error).toBe('File name contains unsupported characters.');
    expect(harness.getState().currentNote).toEqual({ path: oldPath, content: '# alpha' });
  });

  it('rejects absolute renames inside internal folders before reaching storage', async () => {
    const harness = createSliceHarness();

    harness.getState().notesPath = '/vault-a';
    harness.getState().currentNote = { path: '/vault-b/docs/alpha.md', content: '# alpha' };

    await harness.getState().renameAbsoluteNote('/vault-b/.vlaina/workspace.md', 'workspace');
    await harness.getState().renameAbsoluteNote('/vault-b/docs/.git/config.md', 'config');
    await harness.getState().renameAbsoluteNote('/vault-b/docs/.GIT/config.md', 'config');
    await harness.getState().renameAbsoluteNote('/vault-b/.VLAINA/workspace.md', 'workspace');

    expect(hoisted.storageAdapter.rename).not.toHaveBeenCalled();
    expect(harness.getState().error).toBe('Path must not be inside an internal notes folder.');
    expect(harness.getState().currentNote).toEqual({ path: '/vault-b/docs/alpha.md', content: '# alpha' });
  });

  it('preserves latest starred entries while a relative note rename is in flight', async () => {
    let resolveRename: () => void;
    hoisted.storageAdapter.rename.mockImplementation(() => new Promise<undefined>((resolve) => {
      resolveRename = () => resolve(undefined);
    }));
    const harness = createSliceHarness();

    harness.getState().notesPath = '/vault-a';
    harness.getState().rootFolder = {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: [
        { id: 'docs/alpha.md', name: 'alpha', path: 'docs/alpha.md', isFolder: false },
      ],
    };
    harness.getState().starredEntries = [{
      id: 'old-star',
      kind: 'note',
      vaultPath: '/vault-a',
      relativePath: 'docs/old.md',
      addedAt: 1,
    }];

    const rename = harness.getState().renameNote('docs/alpha.md', 'beta');
    await new Promise((resolve) => setTimeout(resolve, 0));

    harness.getState().starredEntries = [{
      id: 'new-star',
      kind: 'note',
      vaultPath: '/vault-a',
      relativePath: 'docs/alpha.md',
      addedAt: 2,
    }];

    resolveRename!();
    await rename;

    const state = harness.getState();
    expect(state.starredEntries).toEqual([{
      id: 'new-star',
      kind: 'note',
      vaultPath: '/vault-a',
      relativePath: 'docs/beta.md',
      addedAt: 2,
    }]);
    expect(hoisted.saveStarredRegistry).toHaveBeenCalledTimes(1);
    expect(hoisted.saveStarredRegistry).toHaveBeenCalledWith(state.starredEntries);
  });

  it('preserves latest starred entries while a folder rename is in flight', async () => {
    let resolveRename: () => void;
    hoisted.storageAdapter.rename.mockImplementation(() => new Promise<undefined>((resolve) => {
      resolveRename = () => resolve(undefined);
    }));
    const harness = createSliceHarness();

    harness.getState().notesPath = '/vault-a';
    harness.getState().rootFolder = {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: [{
        id: 'docs',
        name: 'docs',
        path: 'docs',
        isFolder: true,
        expanded: true,
        children: [
          { id: 'docs/alpha.md', name: 'alpha', path: 'docs/alpha.md', isFolder: false },
        ],
      }],
    };
    harness.getState().starredEntries = [{
      id: 'old-star',
      kind: 'note',
      vaultPath: '/vault-a',
      relativePath: 'other.md',
      addedAt: 1,
    }];

    const rename = harness.getState().renameFolder('docs', 'archive');
    await new Promise((resolve) => setTimeout(resolve, 0));

    harness.getState().starredEntries = [
      {
        id: 'folder-star',
        kind: 'folder',
        vaultPath: '/vault-a',
        relativePath: 'docs',
        addedAt: 2,
      },
      {
        id: 'note-star',
        kind: 'note',
        vaultPath: '/vault-a',
        relativePath: 'docs/alpha.md',
        addedAt: 3,
      },
    ];

    resolveRename!();
    await rename;

    const state = harness.getState();
    expect(state.starredEntries).toEqual([
      {
        id: 'folder-star',
        kind: 'folder',
        vaultPath: '/vault-a',
        relativePath: 'archive',
        addedAt: 2,
      },
      {
        id: 'note-star',
        kind: 'note',
        vaultPath: '/vault-a',
        relativePath: 'archive/alpha.md',
        addedAt: 3,
      },
    ]);
    expect(hoisted.saveStarredRegistry).toHaveBeenCalledTimes(1);
    expect(hoisted.saveStarredRegistry).toHaveBeenCalledWith(state.starredEntries);
  });

  it('preserves latest starred entries and tree nodes while a move is in flight', async () => {
    let resolveRename: () => void;
    hoisted.storageAdapter.rename.mockImplementation(() => new Promise<undefined>((resolve) => {
      resolveRename = () => resolve(undefined);
    }));
    const harness = createSliceHarness();

    harness.getState().notesPath = '/vault-a';
    harness.getState().rootFolder = {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: [
        { id: 'alpha.md', name: 'alpha', path: 'alpha.md', isFolder: false },
        {
          id: 'target',
          name: 'target',
          path: 'target',
          isFolder: true,
          expanded: true,
          children: [],
        },
      ],
    };
    harness.getState().starredEntries = [{
      id: 'old-star',
      kind: 'note',
      vaultPath: '/vault-a',
      relativePath: 'old.md',
      addedAt: 1,
    }];

    const move = harness.getState().moveItem('alpha.md', 'target');
    await new Promise((resolve) => setTimeout(resolve, 0));

    harness.getState().rootFolder = {
      ...harness.getState().rootFolder,
      children: [
        ...harness.getState().rootFolder.children,
        { id: 'late.md', name: 'late', path: 'late.md', isFolder: false },
      ],
    };
    harness.getState().starredEntries = [{
      id: 'new-star',
      kind: 'note',
      vaultPath: '/vault-a',
      relativePath: 'alpha.md',
      addedAt: 2,
    }];

    resolveRename!();
    await move;

    const state = harness.getState();
    expect(state.starredEntries).toEqual([{
      id: 'new-star',
      kind: 'note',
      vaultPath: '/vault-a',
      relativePath: 'target/alpha.md',
      addedAt: 2,
    }]);
    expect(state.rootFolder.children.some((node: any) => node.path === 'late.md')).toBe(true);
    expect(state.rootFolder.children.some((node: any) => node.path === 'alpha.md')).toBe(false);
    expect(state.rootFolder.children.find((node: any) => node.path === 'target').children).toEqual([
      { id: 'target/alpha.md', name: 'alpha', path: 'target/alpha.md', isFolder: false },
    ]);
    expect(hoisted.saveStarredRegistry).toHaveBeenCalledTimes(1);
    expect(hoisted.saveStarredRegistry).toHaveBeenCalledWith(state.starredEntries);
  });
});
