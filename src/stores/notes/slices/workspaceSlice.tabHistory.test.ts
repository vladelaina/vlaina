import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createWorkspaceSlice } from './workspaceSlice';
import type { NotesStore } from '../types';

const storageAdapter = vi.hoisted(() => ({
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  stat: vi.fn<(path: string) => Promise<{ isFile?: boolean; isDirectory?: boolean; modifiedAt?: number | null } | null>>(),
  readFile: vi.fn<(path: string) => Promise<string>>(),
  writeFile: vi.fn<(path: string, content: string) => Promise<void>>(),
}));

const hoisted = vi.hoisted(() => ({
  persistRecentNotes: vi.fn(),
  saveStarredRegistry: vi.fn(),
  persistWorkspaceSnapshot: vi.fn(),
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

vi.mock('../pendingEditorMarkdownFlusher', () => ({
  flushCurrentPendingEditorMarkdown: hoisted.flushCurrentPendingEditorMarkdown,
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
    storageAdapter.writeFile.mockReset();
    storageAdapter.stat.mockResolvedValue({ modifiedAt: 1, isFile: true });
    storageAdapter.writeFile.mockResolvedValue(undefined);
    hoisted.flushCurrentPendingEditorMarkdown.mockReset();
  });

  it('records a closed tab and restores it to its original position', async () => {
    storageAdapter.readFile.mockImplementation(async (path: string) => {
      if (path === '/vault/beta.md') {
        return '# beta';
      }
      throw new Error(`unexpected path: ${path}`);
    });
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
    expect(store.getState().noteContentsCache.has('beta.md')).toBe(false);

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

  it('flushes pending editor markdown before deciding whether to save while opening another note', async () => {
    const saveNote = vi.fn(async () => {
      store.setState((state) => ({
        isDirty: false,
        openTabs: state.openTabs.map((tab) =>
          tab.path === 'alpha.md' ? { ...tab, isDirty: false } : tab
        ),
      }));
    });
    storageAdapter.readFile.mockResolvedValue('# beta');
    const store = createNotesStore({
      currentNote: { path: 'alpha.md', content: 'old' },
      isDirty: false,
      saveNote,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([
        ['alpha.md', { content: 'old', modifiedAt: 1 }],
      ]),
    });
    hoisted.flushCurrentPendingEditorMarkdown.mockImplementation(() => {
      store.setState((state) => ({
        currentNote: { path: 'alpha.md', content: ['1\\', '2\\', '3'].join('\n') },
        isDirty: true,
        openTabs: state.openTabs.map((tab) =>
          tab.path === 'alpha.md' ? { ...tab, isDirty: true } : tab
        ),
        noteContentsCache: new Map(state.noteContentsCache).set('alpha.md', {
          content: ['1\\', '2\\', '3'].join('\n'),
          modifiedAt: 1,
        }),
      }));
      return true;
    });

    await store.getState().openNote('beta.md');

    expect(hoisted.flushCurrentPendingEditorMarkdown).toHaveBeenCalledTimes(1);
    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(store.getState().noteContentsCache.get('alpha.md')?.content).toBe(['1\\', '2\\', '3'].join('\n'));
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

  it('saves a dirty regular tab before replacing it with an absolute note', async () => {
    const saveNote = vi.fn(async () => {
      store.setState((state) => ({
        isDirty: false,
        openTabs: state.openTabs.map((tab) =>
          tab.path === 'alpha.md' ? { ...tab, isDirty: false } : tab
        ),
      }));
    });
    storageAdapter.readFile.mockResolvedValue('# starred');

    const store = createNotesStore({
      currentNote: { path: 'alpha.md', content: 'Unsaved alpha' },
      isDirty: true,
      saveNote,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: true }],
      noteContentsCache: new Map([
        ['alpha.md', { content: 'Unsaved alpha', modifiedAt: 1 }],
      ]),
    });

    await store.getState().openNoteByAbsolutePath('/other-vault/starred.md');

    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(store.getState().currentNote).toEqual({
      path: '/other-vault/starred.md',
      content: '# starred',
    });
    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().openTabs).toEqual([
      { path: '/other-vault/starred.md', name: 'starred', isDirty: false },
    ]);
  });

  it('saves a dirty regular tab before opening a vault note in a new tab', async () => {
    const saveNote = vi.fn(async () => {
      store.setState((state) => ({
        isDirty: false,
        openTabs: state.openTabs.map((tab) =>
          tab.path === 'alpha.md' ? { ...tab, isDirty: false } : tab
        ),
      }));
    });
    const store = createNotesStore({
      currentNote: { path: 'alpha.md', content: 'Unsaved alpha' },
      isDirty: true,
      saveNote,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: true }],
      noteContentsCache: new Map([
        ['alpha.md', { content: 'Unsaved alpha', modifiedAt: 1 }],
        ['beta.md', { content: '# beta', modifiedAt: 2 }],
      ]),
    });

    await store.getState().openNote('beta.md', true);

    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(store.getState().currentNote).toEqual({
      path: 'beta.md',
      content: '# beta',
    });
    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().openTabs).toEqual([
      { path: 'alpha.md', name: 'alpha', isDirty: false },
      { path: 'beta.md', name: 'beta', isDirty: false },
    ]);
  });

  it('preserves a dirty regular tab when a new-tab save cannot clear dirty state', async () => {
    const saveNote = vi.fn(async () => {
      store.setState((state) => ({
        isDirty: true,
        openTabs: state.openTabs.map((tab) =>
          tab.path === 'alpha.md' ? { ...tab, isDirty: true } : tab
        ),
      }));
    });
    const store = createNotesStore({
      currentNote: { path: 'alpha.md', content: 'Unsaved alpha' },
      isDirty: true,
      saveNote,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: true }],
      noteContentsCache: new Map([
        ['alpha.md', { content: 'Unsaved alpha', modifiedAt: 1 }],
        ['beta.md', { content: '# beta', modifiedAt: 2 }],
      ]),
    });

    await store.getState().openNote('beta.md', true);

    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(store.getState().currentNote).toEqual({
      path: 'beta.md',
      content: '# beta',
    });
    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().openTabs).toEqual([
      { path: 'alpha.md', name: 'alpha', isDirty: true },
      { path: 'beta.md', name: 'beta', isDirty: false },
    ]);
    expect(store.getState().noteContentsCache.get('alpha.md')?.content).toBe('Unsaved alpha');
  });

  it('saves a dirty regular tab before opening an absolute note in a new tab', async () => {
    const saveNote = vi.fn(async () => {
      store.setState((state) => ({
        isDirty: false,
        openTabs: state.openTabs.map((tab) =>
          tab.path === 'alpha.md' ? { ...tab, isDirty: false } : tab
        ),
      }));
    });
    storageAdapter.readFile.mockResolvedValue('# starred');

    const store = createNotesStore({
      currentNote: { path: 'alpha.md', content: 'Unsaved alpha' },
      isDirty: true,
      saveNote,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: true }],
      noteContentsCache: new Map([
        ['alpha.md', { content: 'Unsaved alpha', modifiedAt: 1 }],
      ]),
    });

    await store.getState().openNoteByAbsolutePath('/other-vault/starred.md', true);

    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(store.getState().currentNote).toEqual({
      path: '/other-vault/starred.md',
      content: '# starred',
    });
    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().openTabs).toEqual([
      { path: 'alpha.md', name: 'alpha', isDirty: false },
      { path: '/other-vault/starred.md', name: 'starred', isDirty: false },
    ]);
  });

  it('saves a dirty regular tab before switching to an already open vault tab', async () => {
    const saveNote = vi.fn(async () => {
      store.setState((state) => ({
        isDirty: false,
        openTabs: state.openTabs.map((tab) =>
          tab.path === 'alpha.md' ? { ...tab, isDirty: false } : tab
        ),
      }));
    });
    const store = createNotesStore({
      currentNote: { path: 'alpha.md', content: 'Unsaved alpha' },
      isDirty: true,
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

    await store.getState().openNote('beta.md');

    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(store.getState().currentNote).toEqual({
      path: 'beta.md',
      content: '# beta',
    });
    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().openTabs).toEqual([
      { path: 'alpha.md', name: 'alpha', isDirty: false },
      { path: 'beta.md', name: 'beta', isDirty: false },
    ]);
  });

  it('preserves a dirty regular tab and still switches when saving cannot clear dirty state', async () => {
    const saveNote = vi.fn(async () => {
      store.setState((state) => ({
        isDirty: true,
        openTabs: state.openTabs.map((tab) =>
          tab.path === 'alpha.md' ? { ...tab, isDirty: true } : tab
        ),
      }));
    });
    const store = createNotesStore({
      currentNote: { path: 'alpha.md', content: 'Unsaved alpha' },
      isDirty: true,
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

    await store.getState().openNote('beta.md');

    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(store.getState().currentNote).toEqual({
      path: 'beta.md',
      content: '# beta',
    });
    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().openTabs).toEqual([
      { path: 'alpha.md', name: 'alpha', isDirty: true },
      { path: 'beta.md', name: 'beta', isDirty: false },
    ]);
    expect(store.getState().noteContentsCache.get('alpha.md')?.content).toBe('Unsaved alpha');
  });

  it('saves a dirty regular tab before switching to an already open absolute tab', async () => {
    const saveNote = vi.fn(async () => {
      store.setState((state) => ({
        isDirty: false,
        openTabs: state.openTabs.map((tab) =>
          tab.path === 'alpha.md' ? { ...tab, isDirty: false } : tab
        ),
      }));
    });
    const store = createNotesStore({
      currentNote: { path: 'alpha.md', content: 'Unsaved alpha' },
      isDirty: true,
      saveNote,
      openTabs: [
        { path: 'alpha.md', name: 'alpha', isDirty: true },
        { path: '/other-vault/starred.md', name: 'starred', isDirty: false },
      ],
      noteContentsCache: new Map([
        ['alpha.md', { content: 'Unsaved alpha', modifiedAt: 1 }],
        ['/other-vault/starred.md', { content: '# starred', modifiedAt: 2 }],
      ]),
    });

    await store.getState().openNoteByAbsolutePath('/other-vault/starred.md');

    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(store.getState().currentNote).toEqual({
      path: '/other-vault/starred.md',
      content: '# starred',
    });
    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().openTabs).toEqual([
      { path: 'alpha.md', name: 'alpha', isDirty: false },
      { path: '/other-vault/starred.md', name: 'starred', isDirty: false },
    ]);
  });

  it('preserves a dirty regular tab and still switches to an absolute tab when saving cannot clear dirty state', async () => {
    const saveNote = vi.fn(async () => {
      store.setState((state) => ({
        isDirty: true,
        openTabs: state.openTabs.map((tab) =>
          tab.path === 'alpha.md' ? { ...tab, isDirty: true } : tab
        ),
      }));
    });
    const store = createNotesStore({
      currentNote: { path: 'alpha.md', content: 'Unsaved alpha' },
      isDirty: true,
      saveNote,
      openTabs: [
        { path: 'alpha.md', name: 'alpha', isDirty: true },
        { path: '/other-vault/starred.md', name: 'starred', isDirty: false },
      ],
      noteContentsCache: new Map([
        ['alpha.md', { content: 'Unsaved alpha', modifiedAt: 1 }],
        ['/other-vault/starred.md', { content: '# starred', modifiedAt: 2 }],
      ]),
    });

    await store.getState().openNoteByAbsolutePath('/other-vault/starred.md');

    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(store.getState().currentNote).toEqual({
      path: '/other-vault/starred.md',
      content: '# starred',
    });
    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().openTabs).toEqual([
      { path: 'alpha.md', name: 'alpha', isDirty: true },
      { path: '/other-vault/starred.md', name: 'starred', isDirty: false },
    ]);
    expect(store.getState().noteContentsCache.get('alpha.md')?.content).toBe('Unsaved alpha');
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

  it('reuses an active hover prefetch when opening the same note', async () => {
    let readStarted = false;
    let resolveRead: (content: string) => void = () => {
      throw new Error('read did not start');
    };
    storageAdapter.readFile.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          readStarted = true;
          resolveRead = resolve;
        })
    );
    storageAdapter.stat.mockResolvedValue({ modifiedAt: 4, isFile: true });

    const store = createNotesStore({
      currentNote: { path: 'alpha.md', content: '# alpha' },
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });

    const prefetch = store.getState().prefetchNote('beta.md');
    await vi.waitFor(() => {
      expect(readStarted).toBe(true);
    });

    const open = store.getState().openNote('beta.md');
    resolveRead('# beta');
    await Promise.all([prefetch, open]);

    expect(storageAdapter.readFile).toHaveBeenCalledTimes(1);
    expect(storageAdapter.readFile).toHaveBeenCalledWith('/vault/beta.md');
    expect(store.getState().currentNote).toEqual({ path: 'beta.md', content: '# beta' });
    expect(store.getState().noteContentsCache.get('beta.md')).toEqual({
      content: '# beta',
      modifiedAt: 4,
    });
  });

  it('cancels a queued note prefetch before it reads or writes cache', async () => {
    const pendingReads = new Map<string, (content: string) => void>();
    storageAdapter.readFile.mockImplementation(
      (path: string) =>
        new Promise<string>((resolve) => {
          pendingReads.set(path, resolve);
        })
    );
    storageAdapter.stat.mockResolvedValue({ modifiedAt: 4, isFile: true });

    const store = createNotesStore({
      currentNote: { path: 'alpha.md', content: '# alpha' },
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });

    const firstPrefetch = store.getState().prefetchNote('block-a.md');
    const secondPrefetch = store.getState().prefetchNote('block-b.md');
    const queuedPrefetch = store.getState().prefetchNote('queued.md');

    await vi.waitFor(() => {
      expect(pendingReads.has('/vault/block-a.md')).toBe(true);
      expect(pendingReads.has('/vault/block-b.md')).toBe(true);
    });

    store.getState().cancelPrefetchNote('queued.md');
    pendingReads.get('/vault/block-a.md')?.('# block a');
    pendingReads.get('/vault/block-b.md')?.('# block b');

    await Promise.all([firstPrefetch, secondPrefetch, queuedPrefetch]);

    expect(storageAdapter.readFile).not.toHaveBeenCalledWith('/vault/queued.md');
    expect(store.getState().noteContentsCache.get('queued.md')).toBeUndefined();
    expect(store.getState().noteContentsCache.get('block-a.md')).toEqual({
      content: '# block a',
      modifiedAt: 4,
    });
    expect(store.getState().noteContentsCache.get('block-b.md')).toEqual({
      content: '# block b',
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

  it('opens an existing draft tab from memory even when it has no cached content', async () => {
    const store = createNotesStore({
      currentNote: { path: 'alpha.md', content: '# alpha' },
      isDirty: false,
      openTabs: [
        { path: 'draft:blank', name: '', isDirty: false },
        { path: 'alpha.md', name: 'alpha', isDirty: false },
      ],
      draftNotes: {
        'draft:blank': { parentPath: null, name: '' },
      },
      noteContentsCache: new Map([
        ['alpha.md', { content: '# alpha', modifiedAt: 1 }],
      ]),
    });

    await store.getState().openNote('draft:blank');

    expect(storageAdapter.readFile).not.toHaveBeenCalledWith('/vault/draft:blank');
    expect(store.getState().currentNote).toEqual({ path: 'draft:blank', content: '' });
    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().openTabs[0]).toEqual({
      path: 'draft:blank',
      name: 'Untitled',
      isDirty: false,
    });
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

  it('flushes and saves a dirty current note before closing the current note view', async () => {
    const saveNote = vi.fn(async () => {
      store.setState((state) => ({
        isDirty: false,
        openTabs: state.openTabs.map((tab) =>
          tab.path === 'alpha.md' ? { ...tab, isDirty: false } : tab
        ),
      }));
    });
    const store = createNotesStore({
      currentNote: { path: 'alpha.md', content: 'old' },
      isDirty: false,
      saveNote,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([
        ['alpha.md', { content: 'old', modifiedAt: 1 }],
      ]),
    });
    hoisted.flushCurrentPendingEditorMarkdown.mockImplementation(() => {
      store.setState((state) => ({
        currentNote: { path: 'alpha.md', content: 'pending edit' },
        isDirty: true,
        openTabs: state.openTabs.map((tab) =>
          tab.path === 'alpha.md' ? { ...tab, isDirty: true } : tab
        ),
        noteContentsCache: new Map(state.noteContentsCache).set('alpha.md', {
          content: 'pending edit',
          modifiedAt: 1,
        }),
      }));
      return true;
    });

    await store.getState().closeNote();

    expect(hoisted.flushCurrentPendingEditorMarkdown).toHaveBeenCalledTimes(1);
    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(store.getState().currentNote).toBeNull();
    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().noteContentsCache.get('alpha.md')?.content).toBe('pending edit');
    expect(hoisted.persistWorkspaceSnapshot).toHaveBeenCalledWith('/vault', expect.objectContaining({
      currentNotePath: null,
    }));
  });

  it('does not close the current note view when saving still leaves it dirty', async () => {
    const saveNote = vi.fn(async () => undefined);
    const store = createNotesStore({
      currentNote: { path: 'alpha.md', content: 'unsaved' },
      isDirty: true,
      saveNote,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: true }],
      noteContentsCache: new Map([
        ['alpha.md', { content: 'unsaved', modifiedAt: 1 }],
      ]),
    });

    await store.getState().closeNote();

    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(store.getState().currentNote).toEqual({ path: 'alpha.md', content: 'unsaved' });
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().openTabs).toEqual([{ path: 'alpha.md', name: 'alpha', isDirty: true }]);
    expect(store.getState().error).toBe('Save the note before closing it.');
    expect(hoisted.persistWorkspaceSnapshot).not.toHaveBeenCalled();
  });

  it('prompts instead of closing a dirty draft current note view', async () => {
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

    await store.getState().closeNote();

    expect(saveNote).not.toHaveBeenCalled();
    expect(store.getState().pendingDraftDiscardPath).toBe('draft:blank');
    expect(store.getState().currentNote).toEqual({ path: 'draft:blank', content: 'draft text' });
    expect(store.getState().isDirty).toBe(true);
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

  it('saves and closes a dirty background regular tab instead of focusing it', async () => {
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
      path: 'beta.md',
      content: '# beta',
    });
    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().openTabs).toEqual([{ path: 'beta.md', name: 'beta', isDirty: false }]);
    expect(storageAdapter.writeFile).toHaveBeenCalledWith(
      '/vault/alpha.md',
      expect.stringContaining('Unsaved alpha'),
    );
    expect(store.getState().recentlyClosedTabs[0]?.tab).toEqual({
      path: 'alpha.md',
      name: 'alpha',
      isDirty: false,
    });
  });

  it('flushes pending editor markdown before closing the current tab', async () => {
    const store = createNotesStore({
      currentNote: { path: 'alpha.md', content: 'Old alpha' },
      isDirty: false,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['alpha.md', { content: 'Old alpha', modifiedAt: 1 }]]),
    });
    hoisted.flushCurrentPendingEditorMarkdown.mockImplementation(() => {
      store.setState((state) => ({
        currentNote: { path: 'alpha.md', content: 'New alpha' },
        currentNoteRevision: state.currentNoteRevision + 1,
        isDirty: true,
        openTabs: state.openTabs.map((tab) =>
          tab.path === 'alpha.md' ? { ...tab, isDirty: true } : tab
        ),
        noteContentsCache: new Map(state.noteContentsCache).set('alpha.md', {
          content: 'New alpha',
          modifiedAt: 1,
        }),
      }));
      return true;
    });

    await store.getState().closeTab('alpha.md');

    expect(hoisted.flushCurrentPendingEditorMarkdown).toHaveBeenCalledTimes(2);
    expect(storageAdapter.writeFile).toHaveBeenCalledWith(
      '/vault/alpha.md',
      expect.stringContaining('New alpha'),
    );
    expect(store.getState().currentNote).toBeNull();
    expect(store.getState().openTabs).toEqual([]);
    expect(store.getState().isDirty).toBe(false);
  });

  it('does not close a background dirty tab if it becomes active and changes during the close save', async () => {
    let resolveWrite: (() => void) | undefined;
    storageAdapter.writeFile.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveWrite = resolve;
    }));
    const store = createNotesStore({
      currentNote: { path: 'beta.md', content: '# beta' },
      isDirty: false,
      openTabs: [
        { path: 'alpha.md', name: 'alpha', isDirty: true },
        { path: 'beta.md', name: 'beta', isDirty: false },
      ],
      noteContentsCache: new Map([
        ['alpha.md', { content: 'First alpha', modifiedAt: 1 }],
        ['beta.md', { content: '# beta', modifiedAt: 2 }],
      ]),
    });

    const close = store.getState().closeTab('alpha.md');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(storageAdapter.writeFile).toHaveBeenCalledTimes(1);

    store.setState((state) => ({
      currentNote: { path: 'alpha.md', content: 'Second alpha' },
      currentNoteRevision: state.currentNoteRevision + 1,
      isDirty: true,
      openTabs: state.openTabs.map((tab) =>
        tab.path === 'alpha.md' ? { ...tab, isDirty: true } : tab
      ),
      noteContentsCache: new Map(state.noteContentsCache).set('alpha.md', {
        content: 'Second alpha',
        modifiedAt: 1,
      }),
    }));

    resolveWrite?.();
    await close;

    expect(store.getState().currentNote).toEqual({
      path: 'alpha.md',
      content: 'Second alpha',
    });
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().openTabs).toEqual([
      { path: 'alpha.md', name: 'alpha', isDirty: true },
      { path: 'beta.md', name: 'beta', isDirty: false },
    ]);
    expect(store.getState().error).toBe('Save the note before closing it.');
    expect(store.getState().recentlyClosedTabs).toEqual([]);
    expect(store.getState().noteContentsCache.get('alpha.md')).toEqual({
      content: 'Second alpha',
      modifiedAt: 1,
    });
  });

  it('keeps edits made to the previous note while opening another note is in flight', async () => {
    let resolveRead: (content: string) => void;
    storageAdapter.readFile.mockImplementation(() => new Promise((resolve) => {
      resolveRead = resolve;
    }));
    const store = createNotesStore({
      currentNote: { path: 'alpha.md', content: '# alpha' },
      isDirty: false,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });

    const open = store.getState().openNote('beta.md');
    await new Promise((resolve) => setTimeout(resolve, 0));
    store.setState((state) => ({
      currentNote: { path: 'alpha.md', content: '# edited while opening beta' },
      currentNoteRevision: state.currentNoteRevision + 1,
      isDirty: true,
      openTabs: state.openTabs.map((tab) =>
        tab.path === 'alpha.md' ? { ...tab, isDirty: true } : tab
      ),
      noteContentsCache: new Map(state.noteContentsCache).set('alpha.md', {
        content: '# edited while opening beta',
        modifiedAt: 1,
      }),
    }));
    resolveRead!('# beta');
    await open;

    expect(store.getState().currentNote).toEqual({ path: 'beta.md', content: '# beta' });
    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().openTabs).toEqual([
      { path: 'alpha.md', name: 'alpha', isDirty: true },
      { path: 'beta.md', name: 'beta', isDirty: false },
    ]);
    expect(store.getState().noteContentsCache.get('alpha.md')).toEqual({
      content: '# edited while opening beta',
      modifiedAt: 1,
    });
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
