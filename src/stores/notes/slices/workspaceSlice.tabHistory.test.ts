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

  it('ignores a stale note open that finishes after a newer open', async () => {
    const alphaResolvers: Array<(content: string) => void> = [];
    storageAdapter.readFile.mockImplementation(async (path: string) => {
      if (path === '/vault/alpha.md') {
        return new Promise<string>((resolve) => {
          alphaResolvers.push(resolve);
        });
      }
      if (path === '/vault/beta.md') {
        return '# beta';
      }
      throw new Error(`unexpected path: ${path}`);
    });
    const store = createNotesStore();

    const alphaOpen = store.getState().openNote('alpha.md');
    const betaOpen = store.getState().openNote('beta.md');
    await betaOpen;

    expect(store.getState().currentNote).toEqual({
      path: 'beta.md',
      content: '# beta',
    });

    expect(alphaResolvers).toHaveLength(1);
    alphaResolvers[0]?.('# alpha');
    await alphaOpen;

    expect(store.getState().currentNote).toEqual({
      path: 'beta.md',
      content: '# beta',
    });
  });

  it('opens an absolute note in a new tab without saving the dirty draft tab', async () => {
    const saveNote = vi.fn(async () => undefined);
    storageAdapter.readFile.mockResolvedValue('# starred');

    const store = createNotesStore({
      currentNote: { path: 'draft:blank', content: 'draft text' },
      isDirty: true,
      saveNote,
      openTabs: [{ path: 'draft:blank', name: '', isDirty: true }],
      draftNotes: {
        'draft:blank': { parentPath: null, name: '' },
      },
      noteContentsCache: new Map([
        ['draft:blank', { content: 'draft text', modifiedAt: null }],
      ]),
    });

    await store.getState().openNoteByAbsolutePath('/other-vault/starred.md', true);

    expect(saveNote).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toEqual({
      path: '/other-vault/starred.md',
      content: '# starred',
    });
    expect(store.getState().openTabs).toEqual([
      { path: 'draft:blank', name: '', isDirty: true },
      { path: '/other-vault/starred.md', name: 'starred', isDirty: false },
    ]);
    expect(store.getState().noteContentsCache.get('draft:blank')).toEqual({
      content: 'draft text',
      modifiedAt: null,
    });
  });

  it('prefetches a note into cache without changing the current note or tabs', async () => {
    storageAdapter.readFile.mockResolvedValue('# prefetched');
    storageAdapter.stat.mockResolvedValue({ modifiedAt: 4, isFile: true });

    const store = createNotesStore({
      currentNote: { path: 'alpha.md', content: '# alpha' },
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([
        ['alpha.md', { content: '# alpha', modifiedAt: 1 }],
      ]),
    });

    await store.getState().prefetchNote('beta.md');

    expect(storageAdapter.readFile).toHaveBeenCalledWith('/vault/beta.md');
    expect(store.getState().currentNote).toEqual({ path: 'alpha.md', content: '# alpha' });
    expect(store.getState().openTabs).toEqual([{ path: 'alpha.md', name: 'alpha', isDirty: false }]);
    expect(store.getState().recentNotes).toEqual([]);
    expect(store.getState().noteContentsCache.get('beta.md')).toEqual({
      content: '# prefetched',
      modifiedAt: 4,
    });
  });

  it('switches to an already open tab without saving the dirty draft tab', async () => {
    const saveNote = vi.fn(async () => undefined);
    const store = createNotesStore({
      currentNote: { path: 'draft:blank', content: 'draft text' },
      isDirty: true,
      saveNote,
      openTabs: [
        { path: 'draft:blank', name: '', isDirty: true },
        { path: 'alpha.md', name: 'alpha', isDirty: false },
      ],
      draftNotes: {
        'draft:blank': { parentPath: null, name: '' },
      },
      noteContentsCache: new Map([
        ['draft:blank', { content: 'draft text', modifiedAt: null }],
        ['alpha.md', { content: '# alpha', modifiedAt: 1 }],
      ]),
    });

    await store.getState().openNote('alpha.md');

    expect(saveNote).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toEqual({ path: 'alpha.md', content: '# alpha' });
    expect(store.getState().isDirty).toBe(false);

    await store.getState().openNote('draft:blank');

    expect(store.getState().currentNote).toEqual({ path: 'draft:blank', content: 'draft text' });
    expect(store.getState().isDirty).toBe(true);
  });

  it('restores unsaved cached content when switching back to a dirty regular tab', async () => {
    const saveNote = vi.fn(async () => undefined);
    const store = createNotesStore({
      currentNote: { path: 'beta.md', content: '# beta' },
      isDirty: false,
      saveNote,
      openTabs: [
        { path: 'alpha.md', name: 'alpha', isDirty: true },
        { path: 'beta.md', name: 'beta', isDirty: false },
      ],
      noteContentsCache: new Map([
        ['alpha.md', { content: 'Unsaved alpha', modifiedAt: 1 }],
        ['beta.md', { content: '# beta', modifiedAt: 2 }],
      ]),
    });

    await store.getState().openNote('alpha.md');

    expect(saveNote).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toEqual({
      path: 'alpha.md',
      content: 'Unsaved alpha',
    });
    expect(store.getState().isDirty).toBe(true);
  });

  it('opens a vault note in a new tab when the current draft is dirty', async () => {
    const saveNote = vi.fn(async () => undefined);
    const store = createNotesStore({
      currentNote: { path: 'draft:blank', content: 'draft text' },
      isDirty: true,
      saveNote,
      openTabs: [{ path: 'draft:blank', name: '', isDirty: true }],
      draftNotes: {
        'draft:blank': { parentPath: null, name: '' },
      },
      noteContentsCache: new Map([
        ['draft:blank', { content: 'draft text', modifiedAt: null }],
        ['alpha.md', { content: '# alpha', modifiedAt: 1 }],
      ]),
    });

    await store.getState().openNote('alpha.md');

    expect(saveNote).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toEqual({ path: 'alpha.md', content: '# alpha' });
    expect(store.getState().openTabs).toEqual([
      { path: 'draft:blank', name: '', isDirty: true },
      { path: 'alpha.md', name: 'alpha', isDirty: false },
    ]);
    expect(store.getState().noteContentsCache.get('draft:blank')).toEqual({
      content: 'draft text',
      modifiedAt: null,
    });
  });

  it('prompts instead of closing a dirty draft tab', async () => {
    const saveNote = vi.fn(async () => undefined);
    const store = createNotesStore({
      currentNote: { path: 'draft:blank', content: 'draft text' },
      isDirty: true,
      saveNote,
      openTabs: [{ path: 'draft:blank', name: '', isDirty: true }],
      draftNotes: {
        'draft:blank': { parentPath: null, name: '' },
      },
      noteContentsCache: new Map([
        ['draft:blank', { content: 'draft text', modifiedAt: null }],
      ]),
    });

    await store.getState().closeTab('draft:blank');

    expect(saveNote).not.toHaveBeenCalled();
    expect(store.getState().pendingDraftDiscardPath).toBe('draft:blank');
    expect(store.getState().openTabs).toEqual([{ path: 'draft:blank', name: '', isDirty: true }]);
    expect(store.getState().currentNote).toEqual({ path: 'draft:blank', content: 'draft text' });
  });

  it('closes an empty clean draft tab without deleting from disk or prompting', async () => {
    const deleteNote = vi.fn(async () => undefined);
    const store = createNotesStore({
      currentNote: { path: 'draft:blank', content: '' },
      isDirty: false,
      isNewlyCreated: true,
      deleteNote,
      openTabs: [{ path: 'draft:blank', name: '', isDirty: false }],
      draftNotes: {
        'draft:blank': { parentPath: null, name: '' },
      },
      noteContentsCache: new Map([
        ['draft:blank', { content: '', modifiedAt: null }],
      ]),
    });

    await store.getState().closeTab('draft:blank');

    expect(deleteNote).not.toHaveBeenCalled();
    expect(store.getState().pendingDraftDiscardPath).toBeNull();
    expect(store.getState().currentNote).toBeNull();
    expect(store.getState().openTabs).toEqual([]);
    expect(store.getState().draftNotes['draft:blank']).toBeUndefined();
  });

  it('prompts before closing a dirty draft tab that is not focused', async () => {
    const store = createNotesStore({
      currentNote: { path: '/other-vault/starred.md', content: '# starred' },
      isDirty: false,
      openTabs: [
        { path: 'draft:blank', name: '', isDirty: true },
        { path: '/other-vault/starred.md', name: 'starred', isDirty: false },
      ],
      draftNotes: {
        'draft:blank': { parentPath: null, name: '' },
      },
      noteContentsCache: new Map([
        ['draft:blank', { content: 'draft text', modifiedAt: null }],
        ['/other-vault/starred.md', { content: '# starred', modifiedAt: 1 }],
      ]),
    });

    await store.getState().closeTab('draft:blank');

    expect(store.getState().pendingDraftDiscardPath).toBe('draft:blank');
    expect(store.getState().openTabs.map((tab) => tab.path)).toEqual([
      'draft:blank',
      '/other-vault/starred.md',
    ]);
    expect(store.getState().currentNote?.path).toBe('/other-vault/starred.md');
  });

  it('focuses a dirty background note instead of closing and losing its cached content', async () => {
    const store = createNotesStore({
      currentNote: { path: 'beta.md', content: '# beta' },
      isDirty: false,
      openTabs: [
        { path: 'alpha.md', name: 'alpha', isDirty: true },
        { path: 'beta.md', name: 'beta', isDirty: false },
      ],
      noteContentsCache: new Map([
        ['alpha.md', { content: 'Unsaved alpha', modifiedAt: 1 }],
        ['beta.md', { content: '# beta', modifiedAt: 2 }],
      ]),
    });

    await store.getState().closeTab('alpha.md');

    expect(store.getState().currentNote).toEqual({
      path: 'alpha.md',
      content: 'Unsaved alpha',
    });
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().openTabs).toEqual([
      { path: 'alpha.md', name: 'alpha', isDirty: true },
      { path: 'beta.md', name: 'beta', isDirty: false },
    ]);
  });

  it('restores a discarded dirty draft tab with its unsaved content', async () => {
    const store = createNotesStore({
      currentNote: { path: '/other-vault/starred.md', content: '# starred' },
      isDirty: false,
      openTabs: [
        { path: 'draft:blank', name: '', isDirty: true },
        { path: '/other-vault/starred.md', name: 'starred', isDirty: false },
      ],
      draftNotes: {
        'draft:blank': { parentPath: null, name: '' },
      },
      noteContentsCache: new Map([
        ['draft:blank', { content: 'draft text', modifiedAt: null }],
        ['/other-vault/starred.md', { content: '# starred', modifiedAt: 1 }],
      ]),
    });

    await store.getState().closeTab('draft:blank');
    await store.getState().confirmPendingDraftDiscard();

    expect(store.getState().openTabs.map((tab) => tab.path)).toEqual(['/other-vault/starred.md']);
    expect(store.getState().draftNotes['draft:blank']).toBeUndefined();

    await store.getState().reopenClosedTab();

    expect(store.getState().currentNote).toEqual({ path: 'draft:blank', content: 'draft text' });
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().openTabs).toEqual([
      { path: 'draft:blank', name: '', isDirty: true },
      { path: '/other-vault/starred.md', name: 'starred', isDirty: false },
    ]);
    expect(store.getState().draftNotes['draft:blank']).toEqual({ parentPath: null, name: '' });
  });
});
