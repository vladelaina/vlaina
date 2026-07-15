import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  persistWorkspaceSnapshot: vi.fn(),
  flushCurrentPendingEditorMarkdown: vi.fn(),
  moveDesktopItemToTrash: vi.fn(async () => undefined),
  revokeImageBlob: vi.fn(),
  storageAdapter: {
    exists: vi.fn(),
    mkdir: vi.fn(),
    listDir: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
  },
}));

vi.mock('@/lib/desktop/trash', () => ({
  moveDesktopItemToTrash: hoisted.moveDesktopItemToTrash,
}));

vi.mock('@/lib/assets/io/reader', () => ({
  revokeImageBlob: hoisted.revokeImageBlob,
}));

vi.mock('../workspacePersistence', () => ({
  persistWorkspaceSnapshot: hoisted.persistWorkspaceSnapshot,
}));

vi.mock('../pendingEditorMarkdownFlusher', () => ({
  flushCurrentPendingEditorMarkdown: hoisted.flushCurrentPendingEditorMarkdown,
}));

vi.mock('@/lib/storage/adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/storage/adapter')>();
  return {
    ...actual,
    getStorageAdapter: () => hoisted.storageAdapter,
    joinPath: async (...segments: string[]) => segments.filter(Boolean).join('/').replace(/\/+/g, '/'),
  };
});

import { createFileSystemSlice } from './fileSystemSlice';
import { getWorkspaceRestoreCandidatePaths } from './fileSystemSliceTreeActions';
import { replaceCurrentTabOrAppend } from './fileSystemSliceHelpers';
import { setCurrentNotesRootPath } from '../storage';

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
    currentNote: null,
    currentNoteRevision: 0,
    isDirty: false,
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
    saveNote: vi.fn(),
    ...overrides,
  };

  return {
    getState: () => state,
  };
}

describe('createFileSystemSlice draft flows', () => {
  beforeEach(() => {
    setCurrentNotesRootPath(null);
    vi.clearAllMocks();
    hoisted.flushCurrentPendingEditorMarkdown.mockReturnValue(false);
  });

  it('creates an unsaved draft note when no notesRoot is selected', async () => {
    const harness = createSliceHarness();

    const draftPath = await harness.getState().createNote();
    const state = harness.getState();

    expect(draftPath).toMatch(/^draft:/);
    expect(state.notesPath).toBe('');
    expect(state.currentNote).toEqual({ path: draftPath, content: '' });
    expect(state.openTabs).toEqual([{ path: draftPath, name: '', isDirty: false }]);
    expect(state.draftNotes[draftPath]).toEqual({
      parentPath: null,
      name: '',
      originNotesPath: '',
      kind: 'scratch',
    });
    expect(state.displayNames.get(draftPath)).toBe('');
    expect(state.noteContentsCache.get(draftPath)).toEqual({ content: '', modifiedAt: null });
    expect(state.saveNote).not.toHaveBeenCalled();
  });

  it('does not create a draft note when creating a folder without a selected folder', async () => {
    const harness = createSliceHarness();

    const result = await harness.getState().createFolder('');
    const state = harness.getState();

    expect(result).toBeNull();
    expect(state.notesPath).toBe('');
    expect(state.currentNote).toBeNull();
    expect(state.openTabs).toEqual([]);
    expect(state.draftNotes).toEqual({});
    expect(state.displayNames.size).toBe(0);
  });

  it('moves an image to system trash and removes it from the file tree', async () => {
    const harness = createSliceHarness({
      notesPath: '/notesRoot',
      rootFolderPath: '/notesRoot',
      fileTreeSortMode: 'name-asc',
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [{
          id: 'assets/cover.png',
          name: 'cover.png',
          path: 'assets/cover.png',
          isFolder: false,
          kind: 'image',
        }],
      },
    });

    await harness.getState().deleteImage('assets/cover.png');

    expect(hoisted.moveDesktopItemToTrash).toHaveBeenCalledWith('/notesRoot/assets/cover.png');
    expect(hoisted.revokeImageBlob).toHaveBeenCalledWith('/notesRoot/assets/cover.png');
    expect(harness.getState().rootFolder.children).toEqual([]);
  });

  it('does not surface a notes error when loading the file tree without a selected folder', async () => {
    const harness = createSliceHarness({
      isLoading: false,
      error: 'previous error',
      rootFolder: null,
    });

    await harness.getState().loadFileTree();

    const state = harness.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.rootFolder).toBeNull();
  });

  it('creates another draft tab without saving or replacing the dirty current draft', async () => {
    const harness = createSliceHarness();
    const cache = new Map([['draft:current', { content: 'draft text', modifiedAt: null }]]);
    harness.getState().currentNote = { path: 'draft:current', content: 'draft text' };
    harness.getState().isDirty = true;
    harness.getState().openTabs = [{ path: 'draft:current', name: '', isDirty: true }];
    harness.getState().draftNotes = {
      'draft:current': { parentPath: null, name: '' },
    };
    harness.getState().noteContentsCache = cache;

    const draftPath = await harness.getState().createNote();
    const state = harness.getState();

    expect(state.saveNote).not.toHaveBeenCalled();
    expect(state.currentNote).toEqual({ path: draftPath, content: '' });
    expect(state.openTabs).toEqual([
      { path: 'draft:current', name: '', isDirty: true },
      { path: draftPath, name: '', isDirty: false },
    ]);
    expect(state.noteContentsCache.get('draft:current')).toEqual({
      content: 'draft text',
      modifiedAt: null,
    });
  });

  it('flushes pending editor markdown without saving before draft create', async () => {
    const harness = createSliceHarness({
      notesPath: '/notesRoot',
      currentNote: { path: 'alpha.md', content: 'Old alpha' },
      isDirty: false,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['alpha.md', { content: 'Old alpha', modifiedAt: 1 }]]),
      saveNote: vi.fn(async () => {
        harness.getState().isDirty = false;
        harness.getState().openTabs = harness.getState().openTabs.map((tab: { path: string; isDirty: boolean }) =>
          tab.path === 'alpha.md' ? { ...tab, isDirty: false } : tab
        );
      }),
    });
    hoisted.flushCurrentPendingEditorMarkdown.mockImplementation(() => {
      harness.getState().currentNote = { path: 'alpha.md', content: 'New alpha' };
      harness.getState().isDirty = true;
      harness.getState().openTabs = [{ path: 'alpha.md', name: 'alpha', isDirty: true }];
      harness.getState().noteContentsCache = new Map([['alpha.md', { content: 'New alpha', modifiedAt: 1 }]]);
      return true;
    });

    await harness.getState().createNote(undefined, { asDraft: true });

    expect(hoisted.flushCurrentPendingEditorMarkdown).toHaveBeenCalledTimes(1);
    expect(harness.getState().saveNote).not.toHaveBeenCalled();
    expect(harness.getState().openTabs).toEqual([
      { path: 'alpha.md', name: 'alpha', isDirty: true },
      expect.objectContaining({ path: expect.stringMatching(/^draft:/), name: '', isDirty: false }),
    ]);
    expect(harness.getState().noteContentsCache.get('alpha.md')).toEqual({
      content: 'New alpha',
      modifiedAt: 1,
    });
  });

  it('can create an in-memory draft even when a notesRoot is selected', async () => {
    const harness = createSliceHarness({
      notesPath: '/notesRoot',
    });

    const draftPath = await harness.getState().createNote(undefined, { asDraft: true });
    const state = harness.getState();

    expect(draftPath).toMatch(/^draft:/);
    expect(state.notesPath).toBe('/notesRoot');
    expect(state.currentNote).toEqual({ path: draftPath, content: '' });
    expect(state.openTabs).toEqual([{ path: draftPath, name: '', isDirty: false }]);
    expect(state.draftNotes[draftPath]).toEqual({
      parentPath: null,
      name: '',
      originNotesPath: '/notesRoot',
      kind: 'notesRoot',
    });
    expect(state.saveNote).not.toHaveBeenCalled();
  });

  it('creates an in-memory draft without waiting for a dirty current note save', async () => {
    const harness = createSliceHarness({
      notesPath: '/notesRoot',
      currentNote: { path: 'alpha.md', content: 'Unsaved alpha' },
      isDirty: true,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: true }],
      noteContentsCache: new Map([['alpha.md', { content: 'Unsaved alpha', modifiedAt: 1 }]]),
      saveNote: vi.fn(() => new Promise<void>(() => {})),
    });

    const draftPath = await harness.getState().createNote(undefined, { asDraft: true });
    const state = harness.getState();

    expect(state.saveNote).not.toHaveBeenCalled();
    expect(draftPath).toMatch(/^draft:/);
    expect(state.currentNote).toEqual({ path: draftPath, content: '' });
    expect(state.openTabs).toEqual([
      { path: 'alpha.md', name: 'alpha', isDirty: true },
      { path: draftPath, name: '', isDirty: false },
    ]);
    expect(state.noteContentsCache.get('alpha.md')).toEqual({
      content: 'Unsaved alpha',
      modifiedAt: 1,
    });
  });
});

describe('createFileSystemSlice tree flows', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    setCurrentNotesRootPath(null);
    hoisted.storageAdapter.exists.mockResolvedValue(false);
    hoisted.storageAdapter.mkdir.mockResolvedValue(undefined);
    hoisted.storageAdapter.listDir.mockResolvedValue([]);
    hoisted.storageAdapter.stat.mockResolvedValue(null);
    hoisted.storageAdapter.readFile.mockResolvedValue('');
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('expands folders immediately and defers workspace persistence', () => {
    const harness = createSliceHarness({
      notesPath: '/notesRoot',
      rootFolderPath: '/notesRoot',
      currentNote: { path: 'alpha.md', content: '# alpha' },
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
            expanded: false,
            children: [],
          },
        ],
      },
    });

    harness.getState().toggleFolder('docs');

    expect(harness.getState().rootFolder.children[0].expanded).toBe(true);
    expect(hoisted.persistWorkspaceSnapshot).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(hoisted.persistWorkspaceSnapshot).toHaveBeenCalledWith('/notesRoot', expect.objectContaining({
      currentNotePath: 'alpha.md',
      rootFolder: expect.objectContaining({
        children: [
          expect.objectContaining({
            path: 'docs',
            expanded: true,
          }),
        ],
      }),
    }));
  });

  it('uses the latest current note when deferred folder persistence flushes', () => {
    const harness = createSliceHarness({
      notesPath: '/notesRoot',
      rootFolderPath: '/notesRoot',
      currentNote: { path: 'alpha.md', content: '# alpha' },
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
            expanded: false,
            children: [],
          },
        ],
      },
    });

    harness.getState().toggleFolder('docs');
    harness.getState().currentNote = { path: 'beta.md', content: '# beta' };

    vi.runOnlyPendingTimers();

    expect(hoisted.persistWorkspaceSnapshot).toHaveBeenCalledWith('/notesRoot', expect.objectContaining({
      currentNotePath: 'beta.md',
    }));
  });

  it('does not persist a preserved previous-notesRoot tree as the current workspace', () => {
    const harness = createSliceHarness({
      notesPath: '/notes-root-next',
      rootFolderPath: '/notes-root-old',
      currentNote: { path: 'alpha.md', content: '# alpha' },
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
            expanded: false,
            children: [],
          },
        ],
      },
    });

    harness.getState().toggleFolder('docs');
    vi.runOnlyPendingTimers();

    expect(hoisted.persistWorkspaceSnapshot).not.toHaveBeenCalled();
  });

  it('uses a shallow initial tree when switching from an existing notesRoot tree to a new notesRoot', async () => {
    setCurrentNotesRootPath('/notes-root-new');
    let newNotesRootRootListCalls = 0;
    hoisted.storageAdapter.exists.mockImplementation(async (path: string) => (
      path === '/notes-root-new'
    ));
    hoisted.storageAdapter.listDir.mockImplementation((path: string) => {
      if (path === '/notes-root-new') {
        newNotesRootRootListCalls += 1;
        if (newNotesRootRootListCalls === 1) {
          return Promise.resolve([
            {
              name: 'deep',
              path: '/notes-root-new/deep',
              isDirectory: true,
              isFile: false,
            },
            {
              name: 'top.md',
              path: '/notes-root-new/top.md',
              isDirectory: false,
              isFile: true,
            },
          ]);
        }

        return new Promise(() => undefined);
      }

      return Promise.resolve([]);
    });

    const harness = createSliceHarness({
      notesPath: '/notes-root-old',
      rootFolderPath: '/notes-root-old',
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [
          {
            id: 'old.md',
            name: 'old',
            path: 'old.md',
            isFolder: false,
          },
        ],
      },
    });

    await harness.getState().loadFileTree();

    expect(newNotesRootRootListCalls).toBe(1);
    expect(hoisted.storageAdapter.listDir).toHaveBeenCalledWith('/notes-root-new', {
      includeHidden: true,
      maxEntries: 256,
    });
    expect(hoisted.storageAdapter.listDir).not.toHaveBeenCalledWith('/notes-root-new/deep', { includeHidden: true });
    expect(harness.getState().rootFolderPath).toBe('/notes-root-new');
    expect(harness.getState().rootFolder.children).toEqual([
      expect.objectContaining({
        path: 'deep',
        isFolder: true,
        children: [],
      }),
      expect.objectContaining({
        path: 'top.md',
        isFolder: false,
      }),
    ]);
    expect(harness.getState().isLoading).toBe(false);

    await vi.advanceTimersByTimeAsync(100);
    expect(newNotesRootRootListCalls).toBe(2);
  });

  it('fills the complete tree in the background after a capped initial listing', async () => {
    let runIdleTask: IdleRequestCallback | undefined;
    vi.stubGlobal('requestIdleCallback', vi.fn((callback: IdleRequestCallback) => {
      runIdleTask = callback;
      return 1;
    }));
    setCurrentNotesRootPath('/notes-root-large');
    const entries = Array.from({ length: 300 }, (_, index) => ({
      name: `note-${String(index).padStart(3, '0')}.md`,
      path: `/notes-root-large/note-${String(index).padStart(3, '0')}.md`,
      isDirectory: false,
      isFile: true,
    }));
    hoisted.storageAdapter.exists.mockImplementation(async (path: string) => path === '/notes-root-large');
    hoisted.storageAdapter.listDir.mockImplementation(async (
      path: string,
      options?: { maxEntries?: number },
    ) => {
      if (path !== '/notes-root-large') return [];
      return options?.maxEntries ? entries.slice(0, options.maxEntries) : entries;
    });

    const harness = createSliceHarness();

    await harness.getState().loadFileTree();
    expect(harness.getState().rootFolder.children).toHaveLength(256);
    expect(hoisted.storageAdapter.listDir).toHaveBeenCalledTimes(1);

    runIdleTask?.({ didTimeout: false, timeRemaining: () => 50 });
    await vi.runAllTimersAsync();
    expect(harness.getState().rootFolder.children).toHaveLength(300);
    expect(hoisted.storageAdapter.listDir).toHaveBeenCalledTimes(2);
  });

  it('detects the root Git repository after the initial tree is available', async () => {
    setCurrentNotesRootPath('/notes-root-git');
    hoisted.storageAdapter.exists.mockImplementation(async (path: string) => (
      path === '/notes-root-git' || path === '/notes-root-git/.git'
    ));

    const harness = createSliceHarness();

    await harness.getState().loadFileTree();
    expect(harness.getState().rootFolder.isGitRepository).toBeUndefined();
    expect(hoisted.storageAdapter.exists).not.toHaveBeenCalledWith('/notes-root-git/.git');

    await vi.advanceTimersByTimeAsync(100);
    expect(harness.getState().rootFolder.isGitRepository).toBe(true);
  });

  it('keeps the existing Git marker until a background refresh confirms removal', async () => {
    setCurrentNotesRootPath('/notes-root-git-removed');
    hoisted.storageAdapter.exists.mockImplementation(async (path: string) => (
      path === '/notes-root-git-removed'
    ));
    const harness = createSliceHarness({
      notesPath: '/notes-root-git-removed',
      rootFolderPath: '/notes-root-git-removed',
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        children: [],
        expanded: true,
        isGitRepository: true,
      },
    });

    await harness.getState().loadFileTree(true);
    expect(harness.getState().rootFolder.isGitRepository).toBe(true);

    await vi.advanceTimersByTimeAsync(100);
    expect(harness.getState().rootFolder.isGitRepository).toBeUndefined();
  });

  it('keeps the root folder reference stable when background metadata does not affect name sorting', async () => {
    setCurrentNotesRootPath('/notesRoot');
    hoisted.storageAdapter.exists.mockImplementation(async (path: string) => path === '/notesRoot');
    hoisted.storageAdapter.listDir.mockImplementation(async (path: string) => {
      if (path !== '/notesRoot') {
        return [];
      }

      return [
        {
          name: 'alpha.md',
          path: '/notesRoot/alpha.md',
          isDirectory: false,
          isFile: true,
        },
        {
          name: 'beta.md',
          path: '/notesRoot/beta.md',
          isDirectory: false,
          isFile: true,
        },
      ];
    });
    hoisted.storageAdapter.stat.mockImplementation(async (path: string) => {
      if (path === '/notesRoot/alpha.md') {
        return { isFile: true, isDirectory: false, createdAt: 1, modifiedAt: 11, size: 7 };
      }
      if (path === '/notesRoot/beta.md') {
        return { isFile: true, isDirectory: false, createdAt: 2, modifiedAt: 12, size: 6 };
      }
      return null;
    });
    hoisted.storageAdapter.readFile.mockImplementation(async (path: string) => (
      path === '/notesRoot/alpha.md' ? '# Alpha' : '# Beta'
    ));

    const harness = createSliceHarness({
      notesPath: '/notesRoot',
      rootFolderPath: '/notesRoot',
      fileTreeSortMode: 'name-asc',
      noteMetadata: { version: 2, notes: { 'alpha.md': { updatedAt: 1 } } },
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [
          { id: 'alpha.md', name: 'alpha', path: 'alpha.md', isFolder: false },
          { id: 'beta.md', name: 'beta', path: 'beta.md', isFolder: false },
        ],
      },
    });
    const initialRootFolder = harness.getState().rootFolder;

    await harness.getState().loadFileTree(true);
    const rootAfterTreeLoad = harness.getState().rootFolder;

    expect(rootAfterTreeLoad).toBe(initialRootFolder);

    await vi.advanceTimersByTimeAsync(100);

    expect(harness.getState().noteMetadata.notes['alpha.md']?.updatedAt).toBe(11);
    expect(harness.getState().noteMetadata.notes['beta.md']?.updatedAt).toBe(12);
    expect(harness.getState().rootFolder).toBe(rootAfterTreeLoad);
  });

  it('keeps the root folder reference stable when the initial background tree matches the shallow tree', async () => {
    setCurrentNotesRootPath('/notes-root-flat');
    hoisted.storageAdapter.exists.mockImplementation(async (path: string) => path === '/notes-root-flat');
    hoisted.storageAdapter.listDir.mockImplementation(async (path: string) => {
      if (path !== '/notes-root-flat') {
        return [];
      }

      return [
        {
          name: 'alpha.md',
          path: '/notes-root-flat/alpha.md',
          isDirectory: false,
          isFile: true,
        },
        {
          name: 'beta.md',
          path: '/notes-root-flat/beta.md',
          isDirectory: false,
          isFile: true,
        },
      ];
    });
    hoisted.storageAdapter.stat.mockResolvedValue({ isFile: true, isDirectory: false, modifiedAt: 1, size: 7 });
    hoisted.storageAdapter.readFile.mockImplementation(async (path: string) => (
      path.endsWith('/alpha.md')
        ? ['---', 'vlaina_cover: "assets/alpha.webp"', '---', '', '# Alpha'].join('\n')
        : '# Beta'
    ));

    const harness = createSliceHarness({
      rootFolder: null,
      rootFolderPath: null,
      noteMetadata: { version: 2, notes: {} },
    });

    await harness.getState().loadFileTree();
    const rootAfterInitialTree = harness.getState().rootFolder;

    await vi.advanceTimersByTimeAsync(100);

    expect(harness.getState().rootFolder).toBe(rootAfterInitialTree);
    expect(harness.getState().noteMetadata.notes['alpha.md']?.cover?.assetPath).toBe('assets/alpha.webp');
  });

  it('keeps the root folder reference stable for no-op tree actions', async () => {
    const rootFolder = {
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
          children: [
            { id: 'docs/alpha.md', name: 'alpha', path: 'docs/alpha.md', isFolder: false },
          ],
        },
      ],
    };
    const harness = createSliceHarness({
      notesPath: '/notesRoot',
      rootFolderPath: '/notesRoot',
      rootFolder,
      fileTreeSortMode: 'name-asc',
      noteMetadata: { version: 2, notes: {} },
    });

    harness.getState().toggleFolder('missing');
    expect(harness.getState().rootFolder).toBe(rootFolder);

    harness.getState().revealFolder('docs/alpha.md');
    expect(harness.getState().rootFolder).toBe(rootFolder);

    await harness.getState().setFileTreeSortMode('updated-desc');
    expect(harness.getState().rootFolder).toBe(rootFolder);
    expect(harness.getState().fileTreeSortMode).toBe('updated-desc');
  });

  it('does not collapse an empty root folder', () => {
    const harness = createSliceHarness({
      notesPath: '/notesRoot',
      rootFolderPath: '/notesRoot',
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [],
      },
    });

    harness.getState().toggleFolder('');
    vi.runOnlyPendingTimers();

    expect(harness.getState().rootFolder.expanded).toBe(true);
    expect(hoisted.persistWorkspaceSnapshot).not.toHaveBeenCalled();
  });

  it('reopens an empty root folder if a stale collapsed state tries to toggle', () => {
    const harness = createSliceHarness({
      notesPath: '/notesRoot',
      rootFolderPath: '/notesRoot',
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: false,
        children: [],
      },
    });

    harness.getState().toggleFolder('');
    vi.runOnlyPendingTimers();

    expect(harness.getState().rootFolder.expanded).toBe(true);
    expect(hoisted.persistWorkspaceSnapshot).not.toHaveBeenCalled();
  });

  it('uses only the persisted current note for workspace restore', () => {
    expect(getWorkspaceRestoreCandidatePaths({
      currentNotePath: 'docs/last-opened.md',
    })).toEqual([
      'docs/last-opened.md',
    ]);
  });

  it('does not restore starred or recent notes when no persisted current note is available', () => {
    expect(getWorkspaceRestoreCandidatePaths({
      currentNotePath: null,
    })).toEqual([]);
  });

  it('filters unsafe and non-Markdown workspace restore candidates before probing disk', () => {
    expect(getWorkspaceRestoreCandidatePaths({
      currentNotePath: '../secret.md',
    })).toEqual([]);

    expect(getWorkspaceRestoreCandidatePaths({
      currentNotePath: 'docs/./recent.markdown',
    })).toEqual(['docs/recent.markdown']);
  });
});

describe('replaceCurrentTabOrAppend', () => {
  it('appends a new tab instead of replacing an external note tab', () => {
    expect(
      replaceCurrentTabOrAppend(
        [{ path: '/other-notesRoot/starred.md', name: 'starred', isDirty: false }],
        '/other-notesRoot/starred.md',
        { path: 'Untitled.md', name: 'Untitled', isDirty: false },
      ),
    ).toEqual([
      { path: '/other-notesRoot/starred.md', name: 'starred', isDirty: false },
      { path: 'Untitled.md', name: 'Untitled', isDirty: false },
    ]);
  });
});
