import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
const storageAdapter = vi.hoisted(() => ({
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  stat: vi.fn<(path: string) => Promise<{ isFile?: boolean; isDirectory?: boolean; modifiedAt?: number | null } | null>>(),
  readFile: vi.fn<(path: string) => Promise<string>>(),
}));

import { createWorkspaceSlice } from './workspaceSlice';
import type { FolderNode, NoteFile, NotesStore } from '../types';

const hoisted = vi.hoisted(() => ({
  persistRecentNotes: vi.fn(),
  saveStarredRegistry: vi.fn(),
  persistWorkspaceSnapshot: vi.fn(),
  openStoredNotePath: vi.fn(),
}));

vi.mock('../storage', async () => {
  const actual = await vi.importActual<typeof import('../storage')>('../storage');
  return {
    ...actual,
    persistRecentNotes: hoisted.persistRecentNotes,
  };
});

vi.mock('../starred', async () => {
  const actual = await vi.importActual<typeof import('../starred')>('../starred');
  return {
    ...actual,
    saveStarredRegistry: hoisted.saveStarredRegistry,
  };
});

vi.mock('../workspacePersistence', () => ({
  persistWorkspaceSnapshot: hoisted.persistWorkspaceSnapshot,
}));

vi.mock('../openNotePath', () => ({
  openStoredNotePath: hoisted.openStoredNotePath,
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => storageAdapter,
  isAbsolutePath: (path: string) => path.startsWith('/'),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/').replace(/\/+/g, '/')),
}));

function createFile(path: string, name: string): NoteFile {
  return {
    id: path,
    path,
    name,
    isFolder: false,
  };
}

function createFolder(path: string, name: string, children: Array<FolderNode | NoteFile>): FolderNode {
  return {
    id: path,
    path,
    name,
    isFolder: true,
    children,
    expanded: true,
  };
}

function createNotesStore(overrides: Partial<NotesStore> = {}) {
  const rootFolder = createFolder('', 'Notes', []);
  const baseState = {
    rootFolder,
    currentNote: null,
    notesPath: '/vault',
    isDirty: false,
    isLoading: false,
    error: null,
    recentNotes: [],
    openTabs: [],
    noteContentsCache: new Map(),
    starredEntries: [],
    starredNotes: [],
    starredFolders: [],
    starredLoaded: true,
    pendingStarredNavigation: null,
    noteMetadata: { version: 2, notes: {} },
    noteIconSize: 60,
    displayNames: new Map(),
    isNewlyCreated: false,
    newlyCreatedFolderPath: null,
    assetList: [],
    isLoadingAssets: false,
    uploadProgress: null,
    fileTreeSortMode: 'name-asc' as const,
  };

  return createStore<NotesStore>()((set, get, api) => ({
    ...(baseState as unknown as NotesStore),
    ...(createWorkspaceSlice(set, get, api) as unknown as NotesStore),
    ...(overrides as NotesStore),
  }));
}

describe('workspaceSlice external sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageAdapter.exists.mockReset();
    storageAdapter.stat.mockReset();
    storageAdapter.readFile.mockReset();
  });

  it('updates the in-memory tree immediately when the current file is renamed externally', async () => {
    const initialFile = createFile('docs/alpha.md', 'alpha');
    const store = createNotesStore({
      rootFolder: createFolder('', 'Notes', [
        createFolder('docs', 'docs', [initialFile]),
      ]),
      currentNote: { path: 'docs/alpha.md', content: '# alpha' },
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      recentNotes: ['docs/alpha.md'],
      displayNames: new Map([['docs/alpha.md', 'alpha']]),
      noteContentsCache: new Map([['docs/alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });

    await store.getState().applyExternalPathRename('docs/alpha.md', 'docs/beta.md');

    expect(store.getState().currentNote?.path).toBe('docs/beta.md');
    expect(store.getState().openTabs[0]?.path).toBe('docs/beta.md');
    expect(store.getState().recentNotes).toEqual(['docs/beta.md']);
    expect(store.getState().rootFolder?.children[0]).toEqual(
      createFolder('docs', 'docs', [createFile('docs/beta.md', 'beta')]),
    );
  });

  it('updates nested child paths when a folder is renamed externally', async () => {
    const nestedFile = createFile('docs/guide/intro.md', 'intro');
    const guideFolder = createFolder('docs/guide', 'guide', [nestedFile]);
    const store = createNotesStore({
      rootFolder: createFolder('', 'Notes', [
        createFolder('docs', 'docs', [guideFolder]),
      ]),
      currentNote: { path: 'docs/guide/intro.md', content: '# intro' },
      openTabs: [{ path: 'docs/guide/intro.md', name: 'intro', isDirty: false }],
      recentNotes: ['docs/guide/intro.md'],
      displayNames: new Map([['docs/guide/intro.md', 'intro']]),
      noteContentsCache: new Map([['docs/guide/intro.md', { content: '# intro', modifiedAt: 1 }]]),
    });

    await store.getState().applyExternalPathRename('docs/guide', 'docs/tutorial');

    expect(store.getState().currentNote?.path).toBe('docs/tutorial/intro.md');
    expect(store.getState().openTabs[0]?.path).toBe('docs/tutorial/intro.md');
    expect(store.getState().recentNotes).toEqual(['docs/tutorial/intro.md']);
    expect(store.getState().rootFolder?.children[0]).toEqual(
      createFolder('docs', 'docs', [
        createFolder('docs/tutorial', 'tutorial', [
          createFile('docs/tutorial/intro.md', 'intro'),
        ]),
      ]),
    );
  });

  it('removes the in-memory tree node immediately when a file is deleted externally', async () => {
    const keepFile = createFile('docs/keep.md', 'keep');
    const removeFile = createFile('docs/remove.md', 'remove');
    const store = createNotesStore({
      rootFolder: createFolder('', 'Notes', [
        createFolder('docs', 'docs', [keepFile, removeFile]),
      ]),
      openTabs: [{ path: 'docs/keep.md', name: 'keep', isDirty: false }],
      recentNotes: ['docs/keep.md', 'docs/remove.md'],
      displayNames: new Map([
        ['docs/keep.md', 'keep'],
        ['docs/remove.md', 'remove'],
      ]),
      noteContentsCache: new Map([
        ['docs/keep.md', { content: '# keep', modifiedAt: 1 }],
        ['docs/remove.md', { content: '# remove', modifiedAt: 1 }],
      ]),
    });

    await store.getState().applyExternalPathDeletion('docs/remove.md');

    expect(store.getState().recentNotes).toEqual(['docs/keep.md']);
    expect(store.getState().rootFolder?.children[0]).toEqual(
      createFolder('docs', 'docs', [keepFile]),
    );
  });

  it('preserves the current note and tree node when external deletion touches the open file', async () => {
    const removeFile = createFile('docs/remove.md', 'remove');
    const store = createNotesStore({
      rootFolder: createFolder('', 'Notes', [
        createFolder('docs', 'docs', [removeFile]),
      ]),
      currentNote: { path: 'docs/remove.md', content: '# remove' },
      isDirty: false,
      openTabs: [{ path: 'docs/remove.md', name: 'remove', isDirty: false }],
      noteContentsCache: new Map([['docs/remove.md', { content: '# remove', modifiedAt: 1 }]]),
    });

    await store.getState().applyExternalPathDeletion('docs/remove.md');

    expect(store.getState().currentNote).toEqual({ path: 'docs/remove.md', content: '# remove' });
    expect(store.getState().openTabs).toEqual([{ path: 'docs/remove.md', name: 'remove', isDirty: false }]);
    expect(store.getState().rootFolder?.children[0]).toEqual(
      createFolder('docs', 'docs', [removeFile]),
    );
    expect(hoisted.openStoredNotePath).not.toHaveBeenCalled();
  });

  it('keeps current note content editable when disk sync cannot find the file', async () => {
    storageAdapter.exists.mockResolvedValue(false);
    storageAdapter.stat.mockResolvedValue(null);

    const store = createNotesStore({
      currentNote: { path: 'docs/alpha.md', content: '# alpha draft' },
      isDirty: false,
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# alpha draft', modifiedAt: 1 }]]),
    });

    const result = await store.getState().syncCurrentNoteFromDisk();

    expect(result).toBe('deleted-conflict');
    expect(store.getState().currentNote).toEqual({ path: 'docs/alpha.md', content: '# alpha draft' });
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().openTabs).toEqual([{ path: 'docs/alpha.md', name: 'alpha', isDirty: true }]);
    expect(hoisted.openStoredNotePath).not.toHaveBeenCalled();
  });


  it('does not treat the current note as deleted when exists succeeds but stat metadata is unavailable', async () => {
    storageAdapter.exists.mockResolvedValue(true);
    storageAdapter.stat.mockResolvedValue(null);

    const store = createNotesStore({
      currentNote: { path: 'docs/alpha.md', content: '# alpha' },
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });

    const result = await store.getState().syncCurrentNoteFromDisk();

    expect(result).toBe('unchanged');
    expect(store.getState().currentNote).toEqual({ path: 'docs/alpha.md', content: '# alpha' });
    expect(store.getState().openTabs).toEqual([{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }]);
    expect(storageAdapter.readFile).not.toHaveBeenCalled();
  });

  it('force reloads the current note when a watcher reports a change with the same mtime', async () => {
    storageAdapter.exists.mockResolvedValue(true);
    storageAdapter.stat.mockResolvedValue({ isFile: true, modifiedAt: 1 });
    storageAdapter.readFile.mockResolvedValue('# updated');

    const store = createNotesStore({
      currentNote: { path: 'docs/alpha.md', content: '# alpha' },
      currentNoteDiskRevision: 3,
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });

    const result = await store.getState().syncCurrentNoteFromDisk({ force: true });

    expect(result).toBe('reloaded');
    expect(store.getState().currentNote).toEqual({ path: 'docs/alpha.md', content: '# updated' });
    expect(store.getState().currentNoteDiskRevision).toBe(4);
    expect(store.getState().isDirty).toBe(false);
  });

});
