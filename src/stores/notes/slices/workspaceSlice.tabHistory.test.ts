import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createWorkspaceSlice } from './workspaceSlice';
import type { NotesStore } from '../types';

const storageAdapter = vi.hoisted(() => ({
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  stat: vi.fn<(path: string) => Promise<{ isFile?: boolean; isDirectory?: boolean; modifiedAt?: number | null } | null>>(),
  readFile: vi.fn<(path: string) => Promise<string>>(),
}));

const hoisted = vi.hoisted(() => ({
  persistRecentNotes: vi.fn(),
  saveStarredRegistry: vi.fn(),
  persistWorkspaceSnapshot: vi.fn(),
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

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => storageAdapter,
  isAbsolutePath: (path: string) => path.startsWith('/'),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/').replace(/\/+/g, '/')),
  getParentPath: (path: string) => {
    const normalized = path.replace(/\/+/g, '/');
    const index = normalized.lastIndexOf('/');
    return index <= 0 ? '' : normalized.slice(0, index);
  },
}));

function createNotesStore(overrides: Partial<NotesStore> = {}) {
  const baseState = {
    rootFolder: null,
    currentNote: null,
    currentNoteRevision: 0,
    notesPath: '/vault',
    isDirty: false,
    isLoading: false,
    error: null,
    recentNotes: [],
    openTabs: [],
    recentlyClosedTabs: [],
    noteContentsCache: new Map(),
    draftNotes: {},
    starredEntries: [],
    starredNotes: [],
    starredFolders: [],
    starredLoaded: true,
    pendingStarredNavigation: null,
    noteMetadata: { version: 2, notes: {} },
    noteIconSize: 60,
    displayNames: new Map(),
    isNewlyCreated: false,
    pendingDraftDiscardPath: null,
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

describe('workspaceSlice tab history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageAdapter.exists.mockReset();
    storageAdapter.stat.mockReset();
    storageAdapter.readFile.mockReset();
    storageAdapter.stat.mockResolvedValue({ modifiedAt: 1, isFile: true });
  });

  it('records a closed tab and restores it to its original position', async () => {
    const cache = new Map([
      ['alpha.md', { content: '# alpha', modifiedAt: 1 }],
      ['beta.md', { content: '# beta', modifiedAt: 1 }],
      ['gamma.md', { content: '# gamma', modifiedAt: 1 }],
    ]);
    const store = createNotesStore({
      currentNote: { path: 'beta.md', content: '# beta' },
      openTabs: [
        { path: 'alpha.md', name: 'alpha', isDirty: false },
        { path: 'beta.md', name: 'beta', isDirty: false },
        { path: 'gamma.md', name: 'gamma', isDirty: false },
      ],
      noteContentsCache: cache,
    });

    await store.getState().closeTab('beta.md');
    await Promise.resolve();

    expect(store.getState().recentlyClosedTabs).toEqual([
      {
        tab: { path: 'beta.md', name: 'beta', isDirty: false },
        index: 1,
      },
    ]);

    await store.getState().reopenClosedTab();

    expect(store.getState().currentNote?.path).toBe('beta.md');
    expect(store.getState().openTabs.map((tab) => tab.path)).toEqual(['alpha.md', 'beta.md', 'gamma.md']);
    expect(store.getState().recentlyClosedTabs).toEqual([]);
  });

  it('focuses an already open tab without duplicating it when restoring', async () => {
    const cache = new Map([
      ['alpha.md', { content: '# alpha', modifiedAt: 1 }],
      ['beta.md', { content: '# beta', modifiedAt: 1 }],
      ['gamma.md', { content: '# gamma', modifiedAt: 1 }],
    ]);
    const store = createNotesStore({
      currentNote: { path: 'gamma.md', content: '# gamma' },
      openTabs: [
        { path: 'alpha.md', name: 'alpha', isDirty: false },
        { path: 'beta.md', name: 'beta', isDirty: false },
        { path: 'gamma.md', name: 'gamma', isDirty: false },
      ],
      recentlyClosedTabs: [
        {
          tab: { path: 'beta.md', name: 'beta', isDirty: false },
          index: 1,
        },
      ],
      noteContentsCache: cache,
    });

    await store.getState().reopenClosedTab();

    expect(store.getState().currentNote?.path).toBe('beta.md');
    expect(store.getState().openTabs.map((tab) => tab.path)).toEqual(['alpha.md', 'beta.md', 'gamma.md']);
    expect(store.getState().recentlyClosedTabs).toEqual([]);
  });

  it('skips missing closed tabs and restores the next available one', async () => {
    storageAdapter.readFile.mockImplementation(async (path: string) => {
      if (path === '/vault/missing.md') {
        throw new Error('missing');
      }
      if (path === '/vault/beta.md') {
        return '# beta';
      }
      throw new Error(`unexpected path: ${path}`);
    });

    const store = createNotesStore({
      currentNote: { path: 'alpha.md', content: '# alpha' },
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
      recentlyClosedTabs: [
        {
          tab: { path: 'missing.md', name: 'missing', isDirty: false },
          index: 1,
        },
        {
          tab: { path: 'beta.md', name: 'beta', isDirty: false },
          index: 0,
        },
      ],
      noteContentsCache: new Map([['alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });

    await store.getState().reopenClosedTab();

    expect(store.getState().currentNote?.path).toBe('beta.md');
    expect(store.getState().openTabs.map((tab) => tab.path)).toEqual(['beta.md', 'alpha.md']);
    expect(store.getState().recentlyClosedTabs).toEqual([]);
    expect(store.getState().error).toBeNull();
  });

  it('remaps and prunes recently closed tabs during external file changes', async () => {
    const store = createNotesStore({
      recentlyClosedTabs: [
        {
          tab: { path: 'docs/alpha.md', name: 'alpha', isDirty: false },
          index: 0,
        },
        {
          tab: { path: 'docs/archive/gamma.md', name: 'gamma', isDirty: false },
          index: 1,
        },
      ],
    });

    await store.getState().applyExternalPathRename('docs/alpha.md', 'docs/beta.md');
    expect(store.getState().recentlyClosedTabs[0]?.tab.path).toBe('docs/beta.md');

    await store.getState().applyExternalPathDeletion('docs/archive');
    expect(store.getState().recentlyClosedTabs).toEqual([
      {
        tab: { path: 'docs/beta.md', name: 'beta', isDirty: false },
        index: 0,
      },
    ]);
  });
});
