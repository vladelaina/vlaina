import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
const storageAdapter = vi.hoisted(() => ({
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  stat: vi.fn<(path: string) => Promise<{ isFile?: boolean; isDirectory?: boolean; modifiedAt?: number | null; size?: number | null } | null>>(),
  readFile: vi.fn<(path: string) => Promise<string>>(),
}));

import { createWorkspaceSlice } from './workspaceSlice';
import type { FolderNode, NoteFile, NotesStore } from '../types';
import {
  markExpectedExternalChange,
  shouldIgnoreExpectedExternalChange,
} from '../document/externalChangeRegistry';

const hoisted = vi.hoisted(() => ({
  persistRecentNotes: vi.fn(),
  saveStarredRegistry: vi.fn(),
  persistWorkspaceSnapshot: vi.fn(),
  openStoredNotePath: vi.fn(),
  flushCurrentPendingEditorMarkdown: vi.fn(),
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

vi.mock('../pendingEditorMarkdownFlusher', () => ({
  flushCurrentPendingEditorMarkdown: hoisted.flushCurrentPendingEditorMarkdown,
}));

vi.mock('@/lib/storage/adapter', () => ({
  getBaseName: (path: string) => path.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ?? '',
  getParentPath: (path: string) => {
    const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
    const index = normalized.lastIndexOf('/');
    return index > 0 ? normalized.slice(0, index) : null;
  },
  getStorageAdapter: () => storageAdapter,
  isAbsolutePath: (path: string) => path.startsWith('/'),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/').replace(/\/+/g, '/')),
  normalizeAbsolutePath: (path: string) => {
    if (!path.startsWith('/')) return path;
    const parts: string[] = [];
    for (const part of path.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        parts.pop();
        continue;
      }
      parts.push(part);
    }
    return `/${parts.join('/')}`;
  },
  normalizePath: (path: string) => path.replace(/\\/g, '/').replace(/\/+/g, '/'),
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
    hoisted.flushCurrentPendingEditorMarkdown.mockReset();
    hoisted.flushCurrentPendingEditorMarkdown.mockReturnValue(false);
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

  it('does not remap a known Markdown note to a non-Markdown external rename target', async () => {
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
      noteMetadata: {
        version: 2,
        notes: {
          'docs/alpha.md': { createdAt: 1 },
        },
      },
    });

    await store.getState().applyExternalPathRename('docs/alpha.md', 'docs/alpha.png');

    expect(store.getState().currentNote?.path).toBe('docs/alpha.md');
    expect(store.getState().openTabs).toEqual([
      { path: 'docs/alpha.md', name: 'alpha', isDirty: false },
    ]);
    expect(store.getState().recentNotes).toEqual(['docs/alpha.md']);
    expect(store.getState().noteContentsCache.has('docs/alpha.md')).toBe(true);
    expect(store.getState().noteContentsCache.has('docs/alpha.png')).toBe(false);
    expect(store.getState().rootFolder?.children[0]).toEqual(
      createFolder('docs', 'docs', [initialFile]),
    );
    expect(hoisted.persistWorkspaceSnapshot).not.toHaveBeenCalled();
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

  it('flushes pending editor markdown before remapping an externally renamed current file', async () => {
    const initialFile = createFile('docs/alpha.md', 'alpha');
    const store = createNotesStore({
      rootFolder: createFolder('', 'Notes', [
        createFolder('docs', 'docs', [initialFile]),
      ]),
      currentNote: { path: 'docs/alpha.md', content: '# alpha' },
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });
    hoisted.flushCurrentPendingEditorMarkdown.mockImplementation(() => {
      store.setState((state) => ({
        currentNote: { path: 'docs/alpha.md', content: '# pending alpha' },
        currentNoteRevision: state.currentNoteRevision + 1,
        isDirty: true,
        openTabs: state.openTabs.map((tab) =>
          tab.path === 'docs/alpha.md' ? { ...tab, isDirty: true } : tab
        ),
        noteContentsCache: new Map(state.noteContentsCache).set('docs/alpha.md', {
          content: '# pending alpha',
          modifiedAt: 1,
        }),
      }));
      return true;
    });

    await store.getState().applyExternalPathRename('docs/alpha.md', 'docs/beta.md');

    expect(hoisted.flushCurrentPendingEditorMarkdown).toHaveBeenCalledTimes(1);
    expect(store.getState().currentNote).toEqual({
      path: 'docs/beta.md',
      content: '# pending alpha',
    });
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().openTabs).toEqual([
      { path: 'docs/beta.md', name: 'beta', isDirty: true },
    ]);
    expect(store.getState().noteContentsCache.get('docs/beta.md')).toEqual({
      content: '# pending alpha',
      modifiedAt: 1,
    });
    expect(store.getState().noteContentsCache.has('docs/alpha.md')).toBe(false);
  });

  it('remaps starred notes when a file is renamed externally', async () => {
    const store = createNotesStore({
      rootFolder: createFolder('', 'Notes', [
        createFolder('docs', 'docs', [createFile('docs/alpha.md', 'alpha')]),
      ]),
      starredEntries: [
        {
          id: 'starred-note',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: 'docs/alpha.md',
          addedAt: 1,
        },
      ],
      starredNotes: ['docs/alpha.md'],
    });

    await store.getState().applyExternalPathRename('docs/alpha.md', 'docs/beta.md');

    expect(store.getState().starredEntries).toEqual([
      {
        id: 'starred-note',
        kind: 'note',
        vaultPath: '/vault',
        relativePath: 'docs/beta.md',
        addedAt: 1,
      },
    ]);
    expect(store.getState().starredNotes).toEqual(['docs/beta.md']);
    expect(hoisted.saveStarredRegistry).toHaveBeenCalledWith(store.getState().starredEntries);
  });

  it('remaps external absolute starred notes when their file is renamed outside the current vault', async () => {
    const store = createNotesStore({
      starredEntries: [
        {
          id: 'external-starred-note',
          kind: 'note',
          vaultPath: '/vault-b',
          relativePath: 'docs/alpha.md',
          addedAt: 1,
        },
      ],
    });

    await store.getState().applyExternalPathRename(
      '/vault-b/docs/alpha.md',
      '/vault-b/docs/beta.md',
    );

    expect(store.getState().starredEntries).toEqual([
      {
        id: 'external-starred-note',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: 'docs/beta.md',
        addedAt: 1,
      },
    ]);
    expect(hoisted.saveStarredRegistry).toHaveBeenCalledWith(store.getState().starredEntries);
  });

  it('remaps starred child notes when a folder is renamed externally', async () => {
    const store = createNotesStore({
      rootFolder: createFolder('', 'Notes', [
        createFolder('docs', 'docs', [
          createFolder('docs/guide', 'guide', [
            createFile('docs/guide/intro.md', 'intro'),
          ]),
        ]),
      ]),
      starredEntries: [
        {
          id: 'starred-child-note',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: 'docs/guide/intro.md',
          addedAt: 1,
        },
      ],
      starredNotes: ['docs/guide/intro.md'],
    });

    await store.getState().applyExternalPathRename('docs/guide', 'docs/tutorial');

    expect(store.getState().starredEntries[0]?.relativePath).toBe('docs/tutorial/intro.md');
    expect(store.getState().starredNotes).toEqual(['docs/tutorial/intro.md']);
    expect(hoisted.saveStarredRegistry).toHaveBeenCalledWith(store.getState().starredEntries);
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

  it('flushes pending editor markdown before preserving an externally deleted current file', async () => {
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
    hoisted.flushCurrentPendingEditorMarkdown.mockImplementation(() => {
      store.setState((state) => ({
        currentNote: { path: 'docs/remove.md', content: '# pending remove' },
        currentNoteRevision: state.currentNoteRevision + 1,
        isDirty: true,
        openTabs: state.openTabs.map((tab) =>
          tab.path === 'docs/remove.md' ? { ...tab, isDirty: true } : tab
        ),
        noteContentsCache: new Map(state.noteContentsCache).set('docs/remove.md', {
          content: '# pending remove',
          modifiedAt: 1,
        }),
      }));
      return true;
    });

    await store.getState().applyExternalPathDeletion('docs/remove.md');

    expect(hoisted.flushCurrentPendingEditorMarkdown).toHaveBeenCalledTimes(1);
    expect(store.getState().currentNote).toEqual({
      path: 'docs/remove.md',
      content: '# pending remove',
    });
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().openTabs).toEqual([
      { path: 'docs/remove.md', name: 'remove', isDirty: true },
    ]);
    expect(store.getState().noteContentsCache.get('docs/remove.md')).toEqual({
      content: '# pending remove',
      modifiedAt: 1,
    });
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

  it('ignores disk sync for in-memory draft notes', async () => {
    storageAdapter.exists.mockResolvedValue(false);
    storageAdapter.stat.mockResolvedValue(null);

    const store = createNotesStore({
      currentNote: { path: 'draft:blank', content: 'draft text' },
      isDirty: true,
      openTabs: [{ path: 'draft:blank', name: '', isDirty: true }],
      draftNotes: {
        'draft:blank': { parentPath: null, name: '' },
      },
      noteContentsCache: new Map([['draft:blank', { content: 'draft text', modifiedAt: null }]]),
    });

    const result = await store.getState().syncCurrentNoteFromDisk();

    expect(result).toBe('ignored');
    expect(storageAdapter.exists).not.toHaveBeenCalled();
    expect(storageAdapter.stat).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toEqual({ path: 'draft:blank', content: 'draft text' });
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().error).toBeNull();
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
    storageAdapter.stat.mockResolvedValue({ isFile: true, modifiedAt: 1, size: 16 });
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

  it('does not force reload the current note when stat has no size', async () => {
    storageAdapter.exists.mockResolvedValue(true);
    storageAdapter.stat.mockResolvedValue({ isFile: true, modifiedAt: 2 });
    storageAdapter.readFile.mockResolvedValue('# unexpected');

    const store = createNotesStore({
      currentNote: { path: 'docs/alpha.md', content: '# alpha' },
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });

    const result = await store.getState().syncCurrentNoteFromDisk({ force: true });

    expect(result).toBe('ignored');
    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toEqual({ path: 'docs/alpha.md', content: '# alpha' });
    expect(store.getState().error).toBe('Current note is too large to reload from disk.');
  });

  it('does not reload externally changed markdown that is too complex for the editor', async () => {
    const complexMarkdown = 'x'.repeat(512 * 1024 + 1);
    storageAdapter.exists.mockResolvedValue(true);
    storageAdapter.stat.mockResolvedValue({
      isFile: true,
      modifiedAt: 2,
      size: complexMarkdown.length,
    });
    storageAdapter.readFile.mockResolvedValue(complexMarkdown);

    const store = createNotesStore({
      currentNote: { path: 'docs/alpha.md', content: '# alpha' },
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });

    const result = await store.getState().syncCurrentNoteFromDisk({ force: true });

    expect(result).toBe('ignored');
    expect(store.getState().currentNote).toEqual({ path: 'docs/alpha.md', content: '# alpha' });
    expect(store.getState().currentNoteDiskRevision).toBe(0);
    expect(store.getState().error).toBe('Note file is too complex to open safely.');
  });

  it('ignores expected self-write events while the current note is clean', async () => {
    storageAdapter.exists.mockResolvedValue(true);
    storageAdapter.stat.mockResolvedValue({ isFile: true, modifiedAt: 2, size: 16 });
    storageAdapter.readFile.mockResolvedValue('# saved');

    const store = createNotesStore({
      currentNote: { path: 'docs/alpha.md', content: '# saved' },
      currentNoteDiskRevision: 3,
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# saved', modifiedAt: 1 }]]),
    });

    markExpectedExternalChange('/vault/docs/alpha.md');
    const result = await store.getState().syncCurrentNoteFromDisk({ force: true });

    expect(result).toBe('ignored');
    expect(storageAdapter.readFile).toHaveBeenCalledTimes(1);
    expect(store.getState().currentNote).toEqual({ path: 'docs/alpha.md', content: '# saved' });
    expect(store.getState().currentNoteDiskRevision).toBe(3);
    expect(store.getState().noteContentsCache.get('docs/alpha.md')?.modifiedAt).toBe(2);
    shouldIgnoreExpectedExternalChange('/vault/docs/alpha.md');
    shouldIgnoreExpectedExternalChange('/vault/docs/alpha.md');
    shouldIgnoreExpectedExternalChange('/vault/docs/alpha.md');
    expect(shouldIgnoreExpectedExternalChange('/vault/docs/alpha.md')).toBe(false);
  });

  it('reloads a clean current note when a later external write arrives before the self-write marker expires', async () => {
    storageAdapter.exists.mockResolvedValue(true);
    storageAdapter.stat.mockResolvedValue({ isFile: true, modifiedAt: 2, size: 16 });
    storageAdapter.readFile.mockResolvedValue('# other window update');

    const store = createNotesStore({
      currentNote: { path: 'docs/alpha.md', content: '# saved' },
      currentNoteDiskRevision: 3,
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# saved', modifiedAt: 1 }]]),
    });

    markExpectedExternalChange('/vault/docs/alpha.md');
    const result = await store.getState().syncCurrentNoteFromDisk({ force: true });

    expect(result).toBe('reloaded');
    expect(storageAdapter.readFile).toHaveBeenCalledTimes(1);
    expect(store.getState().currentNote).toEqual({ path: 'docs/alpha.md', content: '# other window update' });
    expect(store.getState().currentNoteDiskRevision).toBe(4);
    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().error).toBeNull();
    shouldIgnoreExpectedExternalChange('/vault/docs/alpha.md');
    shouldIgnoreExpectedExternalChange('/vault/docs/alpha.md');
    shouldIgnoreExpectedExternalChange('/vault/docs/alpha.md');
    expect(shouldIgnoreExpectedExternalChange('/vault/docs/alpha.md')).toBe(false);
  });

  it('flushes pending editor markdown before deciding whether disk sync can reload', async () => {
    storageAdapter.exists.mockResolvedValue(true);
    storageAdapter.stat.mockResolvedValue({ isFile: true, modifiedAt: 2, size: 16 });
    storageAdapter.readFile.mockResolvedValue('# disk update');

    const store = createNotesStore({
      currentNote: { path: 'docs/alpha.md', content: '# alpha' },
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });
    hoisted.flushCurrentPendingEditorMarkdown.mockImplementation(() => {
      store.setState((state) => ({
        currentNote: { path: 'docs/alpha.md', content: '# pending edit' },
        currentNoteRevision: state.currentNoteRevision + 1,
        isDirty: true,
        openTabs: state.openTabs.map((tab) =>
          tab.path === 'docs/alpha.md' ? { ...tab, isDirty: true } : tab
        ),
        noteContentsCache: new Map(state.noteContentsCache).set('docs/alpha.md', {
          content: '# pending edit',
          modifiedAt: 1,
        }),
      }));
      return true;
    });

    const result = await store.getState().syncCurrentNoteFromDisk({ force: true });

    expect(result).toBe('conflict');
    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toEqual({
      path: 'docs/alpha.md',
      content: '# pending edit',
    });
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().error).toBeNull();
    expect(store.getState().openTabs).toEqual([
      { path: 'docs/alpha.md', name: 'alpha', isDirty: true },
    ]);
  });

  it('does not report a dirty conflict for an expected save write', async () => {
    storageAdapter.exists.mockResolvedValue(true);
    storageAdapter.stat.mockResolvedValue({ isFile: true, modifiedAt: 2, size: 16 });
    markExpectedExternalChange('/vault/docs/alpha.md');

    const store = createNotesStore({
      currentNote: { path: 'docs/alpha.md', content: '# local edit' },
      isDirty: true,
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: true }],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# local edit', modifiedAt: 1 }]]),
    });

    const result = await store.getState().syncCurrentNoteFromDisk({ force: true });

    expect(result).toBe('ignored');
    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toEqual({
      path: 'docs/alpha.md',
      content: '# local edit',
    });
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().error).toBeNull();
    expect(store.getState().noteContentsCache.get('docs/alpha.md')).toEqual({
      content: '# local edit',
      modifiedAt: 2,
    });
    expect(shouldIgnoreExpectedExternalChange('/vault/docs/alpha.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/vault/docs/alpha.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/vault/docs/alpha.md')).toBe(true);
    expect(shouldIgnoreExpectedExternalChange('/vault/docs/alpha.md')).toBe(false);
  });

  it('preserves local edits made while disk sync is reading the file', async () => {
    storageAdapter.exists.mockResolvedValue(true);
    storageAdapter.stat.mockResolvedValue({ isFile: true, modifiedAt: 2, size: 16 });
    let resolveRead: (content: string) => void;
    storageAdapter.readFile.mockImplementation(() => new Promise((resolve) => {
      resolveRead = resolve;
    }));

    const store = createNotesStore({
      currentNote: { path: 'docs/alpha.md', content: '# alpha' },
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });

    const sync = store.getState().syncCurrentNoteFromDisk({ force: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    store.setState((state) => ({
      currentNote: { path: 'docs/alpha.md', content: '# local edit during sync' },
      currentNoteRevision: state.currentNoteRevision + 1,
      isDirty: true,
      openTabs: state.openTabs.map((tab) =>
        tab.path === 'docs/alpha.md' ? { ...tab, isDirty: true } : tab
      ),
      noteContentsCache: new Map(state.noteContentsCache).set('docs/alpha.md', {
        content: '# local edit during sync',
        modifiedAt: 1,
      }),
    }));
    resolveRead!('# disk update');
    const result = await sync;

    expect(result).toBe('conflict');
    expect(store.getState().currentNote).toEqual({
      path: 'docs/alpha.md',
      content: '# local edit during sync',
    });
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().error).toBeNull();
    expect(store.getState().openTabs).toEqual([
      { path: 'docs/alpha.md', name: 'alpha', isDirty: true },
    ]);
    expect(store.getState().noteContentsCache.get('docs/alpha.md')).toEqual({
      content: '# local edit during sync',
      modifiedAt: 1,
    });
  });

  it('does not mark a conflict when a concurrent disk sync already reloaded the same content', async () => {
    storageAdapter.exists.mockResolvedValue(true);
    storageAdapter.stat.mockResolvedValue({ isFile: true, modifiedAt: 2, size: 16 });
    const readResolvers: Array<(content: string) => void> = [];
    storageAdapter.readFile.mockImplementation(() => new Promise((resolve) => {
      readResolvers.push(resolve);
    }));

    const store = createNotesStore({
      currentNote: { path: 'docs/alpha.md', content: '# alpha' },
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });

    const firstSync = store.getState().syncCurrentNoteFromDisk({ force: true });
    const secondSync = store.getState().syncCurrentNoteFromDisk({ force: true });
    await new Promise((resolve) => setTimeout(resolve, 0));

    readResolvers[0]?.('# disk update');
    await firstSync;

    expect(store.getState().currentNote).toEqual({
      path: 'docs/alpha.md',
      content: '# disk update',
    });
    expect(store.getState().isDirty).toBe(false);

    readResolvers[1]?.('# disk update');
    const secondResult = await secondSync;

    expect(secondResult).toBe('unchanged');
    expect(store.getState().currentNote).toEqual({
      path: 'docs/alpha.md',
      content: '# disk update',
    });
    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().error).toBeNull();
    expect(store.getState().openTabs).toEqual([
      { path: 'docs/alpha.md', name: 'alpha', isDirty: false },
    ]);
    expect(store.getState().noteContentsCache.get('docs/alpha.md')).toEqual({
      content: '# disk update',
      modifiedAt: 2,
    });
  });

  it('cleans internal editor break markers when disk sync reloads the current note', async () => {
    storageAdapter.exists.mockResolvedValue(true);
    storageAdapter.stat.mockResolvedValue({ isFile: true, modifiedAt: 2, size: 16 });
    storageAdapter.readFile.mockResolvedValue(['# updated', '<br data-vlaina-empty-line="true"/>', 'Body'].join('\n'));

    const store = createNotesStore({
      currentNote: { path: 'docs/alpha.md', content: '# alpha' },
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });

    const result = await store.getState().syncCurrentNoteFromDisk();

    expect(result).toBe('reloaded');
    expect(store.getState().currentNote).toEqual({
      path: 'docs/alpha.md',
      content: ['# updated', '', 'Body'].join('\n'),
    });
    expect(store.getState().noteContentsCache.get('docs/alpha.md')?.content).toBe(
      ['# updated', '', 'Body'].join('\n')
    );
  });

  it('ignores a stale disk sync after the workspace switches vaults', async () => {
    storageAdapter.exists.mockResolvedValue(true);
    let resolveStat: (info: { isFile: true; modifiedAt: number; size: number }) => void;
    storageAdapter.stat.mockImplementation(() => new Promise((resolve) => {
      resolveStat = resolve;
    }));
    storageAdapter.readFile.mockResolvedValue('# stale alpha');

    const store = createNotesStore({
      currentNote: { path: 'docs/alpha.md', content: '# alpha' },
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });

    const sync = store.getState().syncCurrentNoteFromDisk({ force: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    store.setState({
      notesPath: '/vault-next',
      currentNote: null,
      openTabs: [],
      noteContentsCache: new Map(),
    });
    resolveStat!({ isFile: true, modifiedAt: 2, size: 16 });
    const result = await sync;

    expect(result).toBe('ignored');
    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().notesPath).toBe('/vault-next');
    expect(store.getState().currentNote).toBeNull();
    expect(store.getState().openTabs).toEqual([]);
    expect(store.getState().noteContentsCache.size).toBe(0);
  });

});
