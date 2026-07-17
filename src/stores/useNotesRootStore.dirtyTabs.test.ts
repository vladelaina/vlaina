import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  storage: {
    platform: 'electron' as const,
    exists: vi.fn(),
    getBasePath: vi.fn(),
    mkdir: vi.fn(),
    readFile: vi.fn(),
    rename: vi.fn(),
    stat: vi.fn(),
    writeFile: vi.fn(),
  },
  ensureNotesRootConfig: vi.fn(),
  saveAutoSaveableDrafts: vi.fn(),
  saveDirtyRegularOpenTabs: vi.fn(),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => mocks.storage,
  getBaseName: (path: string) => path.split('/').pop() || '',
  getParentPath: (path: string) => path.split('/').slice(0, -1).join('/'),
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
  normalizeAbsolutePath: (path: string) => path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/+$/, ''),
}));

vi.mock('@/lib/storage/paths', () => ({
  ensureDirectories: () => Promise.resolve(),
  getPaths: () => Promise.resolve({ notes: '/app/.vlaina/notes' }),
}));

vi.mock('./notesRootConfig', () => ({
  ensureNotesRootConfig: mocks.ensureNotesRootConfig,
  normalizeNotesRootPath: (path: string) => path.replace(/\\/g, '/'),
}));

vi.mock('@/stores/notes/dirtyOpenTabs', () => ({
  saveDirtyRegularOpenTabs: mocks.saveDirtyRegularOpenTabs,
}));

vi.mock('@/stores/notes/autoSaveableDrafts', () => ({
  saveAutoSaveableDrafts: mocks.saveAutoSaveableDrafts,
}));

import { getCurrentNotesRootPath, useNotesStore } from './useNotesStore';
import { useNotesRootStore } from './useNotesRootStore';

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe('useNotesRootStore dirty note protection', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.storage.exists.mockResolvedValue(true);
    mocks.storage.getBasePath.mockResolvedValue('/app');
    mocks.storage.readFile.mockRejectedValue(new Error('state file not found'));
    mocks.storage.stat.mockResolvedValue({ isDirectory: false, isFile: true });
    mocks.storage.writeFile.mockResolvedValue(undefined);
    mocks.ensureNotesRootConfig.mockResolvedValue(undefined);
    mocks.saveAutoSaveableDrafts.mockResolvedValue(true);
    mocks.saveDirtyRegularOpenTabs.mockResolvedValue(true);

    useNotesRootStore.setState({
      currentNotesRoot: {
        id: 'notes-root-old',
        name: 'old',
        path: '/notesRoot/old',
        lastOpened: 1,
      },
      recentNotesRoots: [
        {
          id: 'notes-root-old',
          name: 'old',
          path: '/notesRoot/old',
          lastOpened: 1,
        },
      ],
      isLoading: false,
      hasInitialized: true,
      error: null,
    });

    useNotesStore.setState({
      notesPath: '/notesRoot/old',
      currentNote: { path: 'current.md', content: 'Current' },
      isDirty: false,
      openTabs: [{ path: 'current.md', name: 'current', isDirty: false }],
      rootFolder: null,
      rootFolderPath: null,
      noteContentsCache: new Map(),
      draftNotes: {},
      starredEntries: [],
      starredNotes: [],
      starredFolders: [],
      noteMetadata: { version: 1, notes: {} },
    });
  });

  it('restores the latest recent notesRoot when the persisted state has no current folder', async () => {
    const latestNotesRoot = {
      id: 'notes-root-latest',
      name: 'latest',
      path: '/notesRoot/latest',
      lastOpened: 2,
    };
    const olderNotesRoot = {
      id: 'notes-root-older',
      name: 'older',
      path: '/notesRoot/older',
      lastOpened: 1,
    };
    mocks.storage.readFile.mockResolvedValue(JSON.stringify({
      version: 1,
      recentNotesRoots: [latestNotesRoot, olderNotesRoot],
      currentNotesRootId: null,
      deletedNotesRootPaths: [],
    }));

    useNotesRootStore.setState({
      currentNotesRoot: null,
      recentNotesRoots: [],
      isLoading: false,
      hasInitialized: false,
      error: null,
    });
    useNotesStore.setState({
      notesPath: '',
      currentNote: null,
      isDirty: false,
      openTabs: [],
      rootFolder: null,
      rootFolderPath: null,
      noteContentsCache: new Map(),
      draftNotes: {},
      starredEntries: [],
      starredNotes: [],
      starredFolders: [],
      noteMetadata: { version: 1, notes: {} },
    });

    await useNotesRootStore.getState().initialize();

    expect(useNotesRootStore.getState().currentNotesRoot).toMatchObject({
      id: latestNotesRoot.id,
      path: latestNotesRoot.path,
    });
    expect(getCurrentNotesRootPath()).toBe(latestNotesRoot.path);
    expect(mocks.ensureNotesRootConfig).toHaveBeenCalledWith(latestNotesRoot.path);
  });

  it('keeps recent notes roots when the saved current folder is temporarily inaccessible', async () => {
    const savedNotesRoots = [
      {
        id: 'notes-root-latest',
        name: 'latest',
        path: '/notesRoot/latest',
        lastOpened: 2,
      },
      {
        id: 'notes-root-older',
        name: 'older',
        path: '/notesRoot/older',
        lastOpened: 1,
      },
    ];
    mocks.storage.readFile.mockResolvedValue(JSON.stringify({
      version: 1,
      recentNotesRoots: savedNotesRoots,
      currentNotesRootId: 'notes-root-latest',
      deletedNotesRootPaths: [],
    }));
    mocks.storage.exists.mockImplementation(async (path: string) => {
      if (path === '/notesRoot/latest') {
        throw new Error('Folder is temporarily unavailable');
      }
      return true;
    });
    useNotesRootStore.setState({
      currentNotesRoot: null,
      recentNotesRoots: [],
      isLoading: false,
      hasInitialized: false,
      error: null,
    });

    await useNotesRootStore.getState().initialize();

    expect(useNotesRootStore.getState().currentNotesRoot).toBeNull();
    expect(useNotesRootStore.getState().recentNotesRoots).toEqual(savedNotesRoots);
    expect(JSON.parse(localStorage.getItem('vlaina-notes-roots') || '[]')).toEqual(savedNotesRoots);
    expect(mocks.ensureNotesRootConfig).not.toHaveBeenCalled();
    expect(mocks.storage.exists).not.toHaveBeenCalledWith('/notesRoot/older');
  });

  it('keeps recent notes roots when restoring the saved current folder fails', async () => {
    const savedNotesRoot = {
      id: 'notes-root-latest',
      name: 'latest',
      path: '/notesRoot/latest',
      lastOpened: 2,
    };
    mocks.storage.readFile.mockResolvedValue(JSON.stringify({
      version: 1,
      recentNotesRoots: [savedNotesRoot],
      currentNotesRootId: savedNotesRoot.id,
      deletedNotesRootPaths: [],
    }));
    mocks.ensureNotesRootConfig.mockRejectedValue(new Error('Folder is read-only'));
    useNotesRootStore.setState({
      currentNotesRoot: null,
      recentNotesRoots: [],
      isLoading: false,
      hasInitialized: false,
      error: null,
    });

    await expect(useNotesRootStore.getState().initialize()).rejects.toThrow('Folder is read-only');

    expect(useNotesRootStore.getState().currentNotesRoot).toBeNull();
    expect(useNotesRootStore.getState().recentNotesRoots).toEqual([savedNotesRoot]);
    expect(useNotesRootStore.getState()).toMatchObject({
      error: 'Folder is read-only',
      hasInitialized: true,
      isLoading: false,
    });
  });

  it('shares one in-flight startup initialization', async () => {
    const stateFile = createDeferred<string>();
    mocks.storage.readFile.mockImplementation(() => stateFile.promise);
    useNotesRootStore.setState({
      currentNotesRoot: null,
      recentNotesRoots: [],
      isLoading: false,
      hasInitialized: false,
      error: null,
    });

    const firstInitialization = useNotesRootStore.getState().initialize();
    const secondInitialization = useNotesRootStore.getState().initialize();

    expect(secondInitialization).toBe(firstInitialization);
    stateFile.resolve(JSON.stringify({
      version: 1,
      recentNotesRoots: [],
      currentNotesRootId: null,
      deletedNotesRootPaths: [],
    }));
    await firstInitialization;

    expect(mocks.storage.readFile).toHaveBeenCalledTimes(1);
    expect(useNotesRootStore.getState().hasInitialized).toBe(true);
  });

  it('saves dirty regular tabs before opening another notesRoot', async () => {
    const opened = await useNotesRootStore.getState().openNotesRoot('/notesRoot/next');

    expect(opened).toBe(true);
    expect(mocks.saveAutoSaveableDrafts).toHaveBeenCalledTimes(1);
    expect(mocks.saveDirtyRegularOpenTabs).toHaveBeenCalledTimes(1);
    expect(useNotesRootStore.getState().currentNotesRoot).toMatchObject({
      name: 'next',
      path: '/notesRoot/next',
    });
    expect(useNotesStore.getState().notesPath).toBe('/notesRoot/next');
  });

  it('does not let startup initialization clear a notesRoot opened while initialization is in flight', async () => {
    localStorage.setItem('vlaina-notes-roots', JSON.stringify([
      {
        id: 'notes-root-stale',
        name: 'stale',
        path: '/notesRoot/stale',
        lastOpened: 1,
      },
    ]));
    localStorage.setItem('vlaina-current-notes-root', JSON.stringify('notes-root-stale'));

    useNotesRootStore.setState({
      currentNotesRoot: null,
      recentNotesRoots: [],
      isLoading: false,
      hasInitialized: false,
      error: null,
    });
    useNotesStore.setState({
      notesPath: '',
      currentNote: null,
      isDirty: false,
      openTabs: [],
      rootFolder: null,
      rootFolderPath: null,
      noteContentsCache: new Map(),
      draftNotes: {},
      starredEntries: [],
      starredNotes: [],
      starredFolders: [],
      noteMetadata: { version: 1, notes: {} },
    });

    const staleNotesRootExists = createDeferred<boolean>();
    mocks.storage.exists.mockImplementation(async (path: string) => {
      if (path === '/notesRoot/stale') {
        return staleNotesRootExists.promise;
      }
      return true;
    });

    const initializePromise = useNotesRootStore.getState().initialize();
    await vi.waitFor(() => {
      expect(mocks.storage.exists).toHaveBeenCalledWith('/notesRoot/stale');
    });

    await expect(useNotesRootStore.getState().openNotesRoot('/notesRoot/from-open-file')).resolves.toBe(true);
    staleNotesRootExists.resolve(false);
    await initializePromise;

    expect(useNotesRootStore.getState().currentNotesRoot).toMatchObject({
      name: 'from-open-file',
      path: '/notesRoot/from-open-file',
    });
    expect(useNotesRootStore.getState().recentNotesRoots[0]).toMatchObject({
      path: '/notesRoot/from-open-file',
    });
    expect(useNotesStore.getState().notesPath).toBe('/notesRoot/from-open-file');
    expect(useNotesRootStore.getState().hasInitialized).toBe(true);
  });

  it('clears note workspace state before switching to another notesRoot', async () => {
    useNotesStore.setState({
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [{ id: 'current.md', name: 'current', path: 'current.md', isFolder: false }],
      },
      rootFolderPath: '/notesRoot/old',
      recentlyClosedTabs: [{ tab: { path: 'old.md', name: 'old', isDirty: false }, index: 0 }],
      noteNavigationHistory: ['older.md', 'current.md'],
      noteNavigationHistoryIndex: 1,
      noteContentsCache: new Map([['current.md', { content: 'Current', modifiedAt: null }]]),
      displayNames: new Map([['current.md', 'current']]),
    });

    const opened = await useNotesRootStore.getState().openNotesRoot('/notesRoot/next');

    expect(opened).toBe(true);
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '/notesRoot/next',
      currentNote: null,
      isDirty: false,
      openTabs: [],
      recentlyClosedTabs: [],
      noteNavigationHistory: [],
      noteNavigationHistoryIndex: -1,
      rootFolder: expect.objectContaining({
        children: [{ id: 'current.md', name: 'current', path: 'current.md', isFolder: false }],
      }),
      rootFolderPath: '/notesRoot/old',
      draftNotes: {},
    });
    expect(useNotesStore.getState().noteContentsCache.size).toBe(0);
    expect(useNotesStore.getState().displayNames.size).toBe(0);
  });

  it('keeps a placeholder sidebar root while switching from a blank workspace', async () => {
    useNotesStore.setState({
      notesPath: '',
      currentNote: null,
      isDirty: false,
      openTabs: [],
      rootFolder: null,
      rootFolderPath: null,
    });
    useNotesRootStore.setState({
      currentNotesRoot: null,
      recentNotesRoots: [],
    });

    const opened = await useNotesRootStore.getState().openNotesRoot('/notesRoot/next');

    expect(opened).toBe(true);
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '/notesRoot/next',
      rootFolder: expect.objectContaining({
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [],
      }),
      rootFolderPath: null,
    });
  });

  it('can skip the placeholder sidebar root for direct markdown navigation', async () => {
    useNotesStore.setState({
      notesPath: '',
      currentNote: null,
      isDirty: false,
      openTabs: [],
      rootFolder: null,
      rootFolderPath: null,
    });
    useNotesRootStore.setState({
      currentNotesRoot: null,
      recentNotesRoots: [],
    });

    const opened = await useNotesRootStore.getState().openNotesRoot('/notesRoot/next', undefined, {
      preserveSidebarTree: false,
    });

    expect(opened).toBe(true);
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '/notesRoot/next',
      rootFolder: null,
      rootFolderPath: null,
    });
  });

  it('does not open another notesRoot if dirty regular tabs could not be saved', async () => {
    mocks.saveDirtyRegularOpenTabs.mockResolvedValue(false);

    const opened = await useNotesRootStore.getState().openNotesRoot('/notesRoot/next');

    expect(opened).toBe(false);
    expect(mocks.storage.exists).not.toHaveBeenCalled();
    expect(useNotesRootStore.getState().currentNotesRoot?.path).toBe('/notesRoot/old');
    expect(useNotesRootStore.getState().error).toBe('Failed to save pending note changes');
  });

  it('does not open another notesRoot if auto-saveable drafts could not be saved', async () => {
    mocks.saveAutoSaveableDrafts.mockResolvedValue(false);

    const opened = await useNotesRootStore.getState().openNotesRoot('/notesRoot/next');

    expect(opened).toBe(false);
    expect(mocks.saveDirtyRegularOpenTabs).not.toHaveBeenCalled();
    expect(mocks.storage.exists).not.toHaveBeenCalled();
    expect(useNotesRootStore.getState().currentNotesRoot?.path).toBe('/notesRoot/old');
    expect(useNotesRootStore.getState().error).toBe('Failed to save pending draft changes');
  });

  it('opens another notesRoot while preserving unsaved draft tabs', async () => {
    useNotesStore.setState({
      currentNote: { path: 'draft:alpha', content: 'Draft body' },
      isDirty: true,
      openTabs: [{ path: 'draft:alpha', name: '', isDirty: true }],
      draftNotes: { 'draft:alpha': { parentPath: null, name: 'Draft title' } },
      noteContentsCache: new Map([['draft:alpha', { content: 'Draft body', modifiedAt: null }]]),
      noteMetadata: { version: 1, notes: { 'draft:alpha': { icon: 'emoji.sparkles' } } },
    });

    const opened = await useNotesRootStore.getState().openNotesRoot('/notesRoot/next');

    expect(opened).toBe(true);
    expect(useNotesRootStore.getState().currentNotesRoot?.path).toBe('/notesRoot/next');
    expect(useNotesRootStore.getState().error).toBeNull();
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '/notesRoot/next',
      currentNote: { path: 'draft:alpha', content: 'Draft body' },
      isDirty: true,
      openTabs: [{ path: 'draft:alpha', name: '', isDirty: true }],
      draftNotes: {
        'draft:alpha': {
          parentPath: null,
          name: 'Draft title',
          originNotesPath: '/notesRoot/old',
        },
      },
    });
    expect(useNotesStore.getState().noteContentsCache.get('draft:alpha')).toEqual({
      content: 'Draft body',
      modifiedAt: null,
    });
    expect(useNotesStore.getState().noteMetadata?.notes['draft:alpha']).toEqual({
      icon: 'emoji.sparkles',
    });
  });

  it('drops an empty startup scratch draft when opening another notesRoot', async () => {
    useNotesStore.setState({
      notesPath: '',
      currentNote: { path: 'draft:blank', content: '' },
      isDirty: false,
      openTabs: [{ path: 'draft:blank', name: '', isDirty: false }],
      draftNotes: {
        'draft:blank': {
          parentPath: null,
          name: '',
          originNotesPath: '',
          kind: 'scratch',
        },
      },
      noteContentsCache: new Map([['draft:blank', { content: '', modifiedAt: null }]]),
      noteMetadata: { version: 1, notes: {} },
    });

    const opened = await useNotesRootStore.getState().openNotesRoot('/notesRoot/next');

    expect(opened).toBe(true);
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '/notesRoot/next',
      currentNote: null,
      isDirty: false,
      openTabs: [],
      draftNotes: {},
    });
    expect(useNotesStore.getState().noteContentsCache.size).toBe(0);
  });

  it('preserves multiple draft tabs while dropping regular tabs on notesRoot switch', async () => {
    useNotesStore.setState({
      currentNote: { path: 'draft:two', content: 'Two body' },
      currentNoteRevision: 7,
      isDirty: true,
      openTabs: [
        { path: 'regular.md', name: 'regular', isDirty: false },
        { path: 'draft:one', name: '', isDirty: true },
        { path: 'draft:two', name: '', isDirty: true },
      ],
      draftNotes: {
        'draft:one': { parentPath: null, name: 'One' },
        'draft:two': { parentPath: 'ideas', name: 'Two' },
      },
      noteContentsCache: new Map([
        ['regular.md', { content: 'Regular', modifiedAt: 1 }],
        ['draft:one', { content: 'One body', modifiedAt: null }],
        ['draft:two', { content: 'Two body', modifiedAt: null }],
      ]),
      noteMetadata: {
        version: 1,
        notes: {
          'regular.md': { icon: 'emoji.file' },
          'draft:one': { icon: 'emoji.one' },
          'draft:two': { cover: { assetPath: '@cover/2', positionX: 50, positionY: 50, height: 200, scale: 1 } },
        },
      },
    });

    const opened = await useNotesRootStore.getState().openNotesRoot('/notesRoot/next');

    expect(opened).toBe(true);
    const state = useNotesStore.getState();
    expect(state.currentNote).toEqual({ path: 'draft:two', content: 'Two body' });
    expect(state.currentNoteRevision).toBe(7);
    expect(state.openTabs).toEqual([
      { path: 'draft:one', name: '', isDirty: true },
      { path: 'draft:two', name: '', isDirty: true },
    ]);
    expect(state.draftNotes).toEqual({
      'draft:one': { parentPath: null, name: 'One', originNotesPath: '/notesRoot/old' },
      'draft:two': { parentPath: 'ideas', name: 'Two', originNotesPath: '/notesRoot/old' },
    });
    expect(Array.from(state.noteContentsCache.keys())).toEqual(['draft:one', 'draft:two']);
    expect(state.noteMetadata?.notes).toEqual({
      'draft:one': { icon: 'emoji.one' },
      'draft:two': { cover: { assetPath: '@cover/2', positionX: 50, positionY: 50, height: 200, scale: 1 } },
    });
  });

  it('saves dirty regular tabs before closing the opened folder', async () => {
    const closed = await useNotesRootStore.getState().closeNotesRoot();

    expect(closed).toBe(true);
    expect(mocks.saveDirtyRegularOpenTabs).toHaveBeenCalledTimes(1);
    expect(useNotesRootStore.getState().currentNotesRoot).toBeNull();
    expect(useNotesRootStore.getState().error).toBeNull();
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '',
      currentNote: null,
      isDirty: false,
      openTabs: [],
      rootFolder: null,
      rootFolderPath: null,
    });
  });

  it('closes the notesRoot sidebar without replacing the active external starred note', async () => {
    useNotesStore.setState({
      notesPath: '/notesRoot/old',
      currentNote: { path: '/notesRoot/starred/external.md', content: 'External starred' },
      currentNoteRevision: 9,
      isDirty: false,
      openTabs: [
        { path: 'current.md', name: 'current', isDirty: false },
        { path: '/notesRoot/starred/external.md', name: 'external', isDirty: false },
      ],
      rootFolder: {
        id: '',
        name: 'old',
        path: '',
        isFolder: true,
        expanded: true,
        children: [{ id: 'current.md', name: 'current', path: 'current.md', isFolder: false }],
      },
      rootFolderPath: '/notesRoot/old',
      noteContentsCache: new Map([
        ['current.md', { content: 'Current', modifiedAt: 1 }],
        ['/notesRoot/starred/external.md', { content: 'External starred', modifiedAt: 2 }],
      ]),
      noteMetadata: {
        version: 1,
        notes: {
          'current.md': { icon: 'emoji.file' },
          '/notesRoot/starred/external.md': { icon: 'emoji.star' },
        },
      },
      displayNames: new Map([
        ['current.md', 'current'],
        ['/notesRoot/starred/external.md', 'external'],
      ]),
    });

    const closed = await useNotesRootStore.getState().closeNotesRoot();

    expect(closed).toBe(true);
    expect(useNotesRootStore.getState().currentNotesRoot).toBeNull();
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '',
      currentNote: { path: '/notesRoot/starred/external.md', content: 'External starred' },
      currentNoteRevision: 9,
      isDirty: false,
      openTabs: [{ path: '/notesRoot/starred/external.md', name: 'external', isDirty: false }],
      rootFolder: null,
      rootFolderPath: null,
      draftNotes: {},
    });
    expect(Array.from(useNotesStore.getState().noteContentsCache.keys())).toEqual([
      '/notesRoot/starred/external.md',
    ]);
    expect(useNotesStore.getState().noteMetadata?.notes).toEqual({
      '/notesRoot/starred/external.md': { icon: 'emoji.star' },
    });
    expect(useNotesStore.getState().displayNames.get('/notesRoot/starred/external.md')).toBe('external');
  });

  it('keeps the active starred notesRoot note open as an external note when closing the notesRoot', async () => {
    useNotesStore.setState({
      notesPath: '/notesRoot/old',
      currentNote: { path: 'docs/starred.md', content: 'Starred body' },
      currentNoteRevision: 11,
      isDirty: false,
      openTabs: [
        { path: 'docs/starred.md', name: 'starred', isDirty: false },
        { path: 'docs/regular.md', name: 'regular', isDirty: false },
      ],
      starredEntries: [
        {
          id: 'starred-note',
          kind: 'note',
          notesRootPath: '/notesRoot/old',
          relativePath: 'docs/starred.md',
          addedAt: 1,
        },
      ],
      starredNotes: ['docs/starred.md'],
      rootFolder: {
        id: '',
        name: 'old',
        path: '',
        isFolder: true,
        expanded: true,
        children: [
          { id: 'docs/starred.md', name: 'starred', path: 'docs/starred.md', isFolder: false },
          { id: 'docs/regular.md', name: 'regular', path: 'docs/regular.md', isFolder: false },
        ],
      },
      rootFolderPath: '/notesRoot/old',
      noteContentsCache: new Map([
        ['docs/starred.md', { content: 'Starred body', modifiedAt: 2 }],
        ['docs/regular.md', { content: 'Regular body', modifiedAt: 3 }],
      ]),
      noteMetadata: {
        version: 1,
        notes: {
          'docs/starred.md': { icon: 'emoji.star' },
          'docs/regular.md': { icon: 'emoji.file' },
        },
      },
      displayNames: new Map([
        ['docs/starred.md', 'starred'],
        ['docs/regular.md', 'regular'],
      ]),
    });

    const closed = await useNotesRootStore.getState().closeNotesRoot();

    expect(closed).toBe(true);
    expect(useNotesRootStore.getState().currentNotesRoot).toBeNull();
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '',
      currentNote: { path: '/notesRoot/old/docs/starred.md', content: 'Starred body' },
      currentNoteRevision: 11,
      isDirty: false,
      openTabs: [
        { path: '/notesRoot/old/docs/starred.md', name: 'starred', isDirty: false },
      ],
      rootFolder: null,
      rootFolderPath: null,
      draftNotes: {},
    });
    expect(Array.from(useNotesStore.getState().noteContentsCache.keys())).toEqual([
      '/notesRoot/old/docs/starred.md',
    ]);
    expect(useNotesStore.getState().noteMetadata?.notes).toEqual({
      '/notesRoot/old/docs/starred.md': { icon: 'emoji.star' },
    });
    expect(useNotesStore.getState().displayNames.get('/notesRoot/old/docs/starred.md')).toBe('starred');
  });

  it('preserves the active external note even if it is not present in the tab list', async () => {
    useNotesStore.setState({
      notesPath: '/notesRoot/old',
      currentNote: { path: '/notesRoot/starred/external.md', content: 'External starred' },
      currentNoteRevision: 12,
      isDirty: false,
      openTabs: [{ path: 'current.md', name: 'current', isDirty: false }],
      noteContentsCache: new Map([
        ['current.md', { content: 'Current', modifiedAt: 1 }],
        ['/notesRoot/starred/external.md', { content: 'External starred', modifiedAt: 2 }],
      ]),
      noteMetadata: {
        version: 1,
        notes: {
          'current.md': { icon: 'emoji.file' },
          '/notesRoot/starred/external.md': { icon: 'emoji.star' },
        },
      },
      displayNames: new Map([
        ['current.md', 'current'],
        ['/notesRoot/starred/external.md', 'external'],
      ]),
    });

    const closed = await useNotesRootStore.getState().closeNotesRoot();

    expect(closed).toBe(true);
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '',
      currentNote: { path: '/notesRoot/starred/external.md', content: 'External starred' },
      currentNoteRevision: 12,
      openTabs: [],
      rootFolder: null,
      rootFolderPath: null,
    });
    expect(Array.from(useNotesStore.getState().noteContentsCache.keys())).toEqual([
      '/notesRoot/starred/external.md',
    ]);
    expect(useNotesStore.getState().noteMetadata?.notes).toEqual({
      '/notesRoot/starred/external.md': { icon: 'emoji.star' },
    });
    expect(useNotesStore.getState().displayNames.get('/notesRoot/starred/external.md')).toBe('external');
  });

  it('does not preserve root-notesRoot absolute notes as external notes when closing the notesRoot', async () => {
    useNotesRootStore.setState({
      currentNotesRoot: {
        id: 'root-notesRoot',
        name: 'root',
        path: '/',
        lastOpened: 1,
      },
      recentNotesRoots: [
        {
          id: 'root-notesRoot',
          name: 'root',
          path: '/',
          lastOpened: 1,
        },
      ],
    });
    useNotesStore.setState({
      notesPath: '/',
      currentNote: { path: '/docs/alpha.md', content: 'Alpha' },
      currentNoteRevision: 3,
      isDirty: false,
      openTabs: [{ path: '/docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['/docs/alpha.md', { content: 'Alpha', modifiedAt: 1 }]]),
      noteMetadata: {
        version: 1,
        notes: {
          '/docs/alpha.md': { icon: 'emoji.file' },
        },
      },
      displayNames: new Map([['/docs/alpha.md', 'alpha']]),
    });

    const closed = await useNotesRootStore.getState().closeNotesRoot();

    expect(closed).toBe(true);
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '',
      currentNote: null,
      currentNoteRevision: 0,
      isDirty: false,
      openTabs: [],
    });
    expect(useNotesStore.getState().noteContentsCache.size).toBe(0);
    expect(useNotesStore.getState().displayNames.size).toBe(0);
    expect(useNotesStore.getState().noteMetadata).toBeNull();
  });

  it('saves dirty regular tabs before removing the opened folder from recent notes-roots', async () => {
    const removed = await useNotesRootStore.getState().removeFromRecent('notes-root-old');

    expect(removed).toBe(true);
    expect(mocks.saveDirtyRegularOpenTabs).toHaveBeenCalledTimes(1);
    expect(useNotesRootStore.getState().currentNotesRoot).toBeNull();
    expect(useNotesRootStore.getState().error).toBeNull();
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '',
      currentNote: null,
      isDirty: false,
      openTabs: [],
    });
  });

  it('does not remove the opened folder from recent notes-roots when dirty regular tabs cannot be saved', async () => {
    mocks.saveDirtyRegularOpenTabs.mockResolvedValue(false);
    useNotesStore.setState({
      currentNote: { path: 'current.md', content: 'Dirty current' },
      isDirty: true,
      openTabs: [{ path: 'current.md', name: 'current', isDirty: true }],
      noteContentsCache: new Map([['current.md', { content: 'Dirty current', modifiedAt: 1 }]]),
    });

    const removed = await useNotesRootStore.getState().removeFromRecent('notes-root-old');

    expect(removed).toBe(false);
    expect(useNotesRootStore.getState().currentNotesRoot?.path).toBe('/notesRoot/old');
    expect(useNotesRootStore.getState().recentNotesRoots).toEqual([
      {
        id: 'notes-root-old',
        name: 'old',
        path: '/notesRoot/old',
        lastOpened: 1,
      },
    ]);
    expect(useNotesRootStore.getState().error).toBe('Failed to save pending note changes');
    expect(useNotesStore.getState().currentNote).toEqual({
      path: 'current.md',
      content: 'Dirty current',
    });
    expect(useNotesStore.getState().isDirty).toBe(true);
  });

  it('does not remove the opened folder from recent notes-roots while draft tabs still have unsaved content', async () => {
    useNotesStore.setState({
      currentNote: { path: 'draft:alpha', content: 'Draft body' },
      isDirty: true,
      openTabs: [{ path: 'draft:alpha', name: '', isDirty: true }],
      draftNotes: { 'draft:alpha': { parentPath: null, name: 'Draft title' } },
      noteContentsCache: new Map([['draft:alpha', { content: 'Draft body', modifiedAt: null }]]),
    });

    const removed = await useNotesRootStore.getState().removeFromRecent('notes-root-old');

    expect(removed).toBe(false);
    expect(useNotesRootStore.getState().currentNotesRoot?.path).toBe('/notesRoot/old');
    expect(useNotesRootStore.getState().error).toBe(
      'Save or discard draft notes before opening another folder'
    );
    expect(useNotesStore.getState().currentNote).toEqual({
      path: 'draft:alpha',
      content: 'Draft body',
    });
    expect(useNotesStore.getState().draftNotes).toEqual({
      'draft:alpha': { parentPath: null, name: 'Draft title' },
    });
  });

  it('does not remove the opened folder while a cached draft is missing from tabs', async () => {
    useNotesStore.setState({
      currentNote: { path: 'current.md', content: 'Current' },
      isDirty: false,
      openTabs: [{ path: 'current.md', name: 'current', isDirty: false }],
      draftNotes: { 'draft:cached': { parentPath: null, name: '' } },
      noteContentsCache: new Map([['draft:cached', { content: 'Cached draft body', modifiedAt: null }]]),
    });

    const removed = await useNotesRootStore.getState().removeFromRecent('notes-root-old');

    expect(removed).toBe(false);
    expect(useNotesRootStore.getState().currentNotesRoot?.path).toBe('/notesRoot/old');
    expect(useNotesRootStore.getState().error).toBe(
      'Save or discard draft notes before opening another folder'
    );
    expect(useNotesStore.getState().draftNotes).toEqual({
      'draft:cached': { parentPath: null, name: '' },
    });
    expect(useNotesStore.getState().noteContentsCache.get('draft:cached')).toEqual({
      content: 'Cached draft body',
      modifiedAt: null,
    });
  });

  it('does not create a notesRoot folder while a current draft is missing from tabs', async () => {
    useNotesStore.setState({
      currentNote: { path: 'draft:orphan', content: 'Current draft body' },
      isDirty: true,
      openTabs: [],
      draftNotes: { 'draft:orphan': { parentPath: null, name: '' } },
      noteContentsCache: new Map(),
    });

    const created = await useNotesRootStore.getState().createNotesRoot('next', '/notesRoot/next');

    expect(created).toBe(false);
    expect(mocks.storage.mkdir).not.toHaveBeenCalled();
    expect(useNotesRootStore.getState().currentNotesRoot?.path).toBe('/notesRoot/old');
    expect(useNotesRootStore.getState().error).toBe(
      'Save or discard draft notes before opening another folder'
    );
    expect(useNotesStore.getState().currentNote).toEqual({
      path: 'draft:orphan',
      content: 'Current draft body',
    });
  });

  it('removes a non-current recent notesRoot without touching the note workspace', async () => {
    useNotesRootStore.setState({
      recentNotesRoots: [
        {
          id: 'notes-root-old',
          name: 'old',
          path: '/notesRoot/old',
          lastOpened: 1,
        },
        {
          id: 'notes-root-next',
          name: 'next',
          path: '/notesRoot/next',
          lastOpened: 2,
        },
      ],
    });

    const removed = await useNotesRootStore.getState().removeFromRecent('notes-root-next');

    expect(removed).toBe(true);
    expect(mocks.saveDirtyRegularOpenTabs).not.toHaveBeenCalled();
    expect(useNotesRootStore.getState().currentNotesRoot?.path).toBe('/notesRoot/old');
    expect(useNotesRootStore.getState().recentNotesRoots).toEqual([
      {
        id: 'notes-root-old',
        name: 'old',
        path: '/notesRoot/old',
        lastOpened: 1,
      },
    ]);
    expect(useNotesStore.getState().currentNote).toEqual({
      path: 'current.md',
      content: 'Current',
    });
  });

  it('does not create a notesRoot folder while draft tabs still have unsaved content', async () => {
    useNotesStore.setState({
      currentNote: { path: 'draft:alpha', content: 'Draft body' },
      isDirty: true,
      openTabs: [{ path: 'draft:alpha', name: '', isDirty: true }],
      draftNotes: { 'draft:alpha': { parentPath: null, name: 'Draft title' } },
      noteContentsCache: new Map([['draft:alpha', { content: 'Draft body', modifiedAt: null }]]),
    });

    const created = await useNotesRootStore.getState().createNotesRoot('next', '/notesRoot/next');

    expect(created).toBe(false);
    expect(mocks.storage.mkdir).not.toHaveBeenCalled();
    expect(useNotesRootStore.getState().currentNotesRoot?.path).toBe('/notesRoot/old');
    expect(useNotesRootStore.getState().error).toBe(
      'Save or discard draft notes before opening another folder'
    );
  });
});
