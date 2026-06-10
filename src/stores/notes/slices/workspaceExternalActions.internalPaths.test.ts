import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createWorkspaceSlice } from './workspaceSlice';
import type { FolderNode, NoteFile, NotesStore } from '../types';

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
  getBaseName: (path: string) => path.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ?? '',
  getParentPath: (path: string) => {
    const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
    const index = normalized.lastIndexOf('/');
    return index > 0 ? normalized.slice(0, index) : null;
  },
  getStorageAdapter: () => ({
    exists: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
  }),
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
    rootFolderPath: '/vault',
    currentNote: null,
    currentNoteRevision: 0,
    currentNoteDiskRevision: 0,
    notesPath: '/vault',
    isDirty: false,
    isLoading: false,
    error: null,
    recentNotes: [],
    openTabs: [],
    recentlyClosedTabs: [],
    noteContentsCache: new Map(),
    noteContentsCacheRevision: 0,
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
    pendingDeletedItems: [],
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

describe('workspace external actions internal paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.flushCurrentPendingEditorMarkdown.mockReturnValue(false);
  });

  it('ignores external deletions reported inside internal note folders', async () => {
    const store = createNotesStore({
      rootFolder: createFolder('', 'Notes', [
        createFolder('docs', 'docs', [createFile('docs/alpha.md', 'alpha')]),
      ]),
      currentNote: { path: 'docs/alpha.md', content: '# alpha' },
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      recentNotes: ['docs/alpha.md'],
      noteContentsCache: new Map([
        ['docs/alpha.md', { content: '# alpha', modifiedAt: 1 }],
        ['.vlaina/workspace.md', { content: '# hidden', modifiedAt: 1 }],
        ['.VLAINA/workspace.md', { content: '# hidden uppercase', modifiedAt: 1 }],
      ]),
      noteMetadata: {
        version: 2,
        notes: {
          'docs/alpha.md': { createdAt: 1 },
          '.vlaina/workspace.md': { createdAt: 2 },
          '.VLAINA/workspace.md': { createdAt: 3 },
        },
      },
    });

    await store.getState().applyExternalPathDeletion('.vlaina/workspace.md');
    await store.getState().applyExternalPathDeletion('.VLAINA/workspace.md');

    expect(hoisted.flushCurrentPendingEditorMarkdown).not.toHaveBeenCalled();
    expect(hoisted.persistRecentNotes).not.toHaveBeenCalled();
    expect(hoisted.persistWorkspaceSnapshot).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toEqual({ path: 'docs/alpha.md', content: '# alpha' });
    expect(store.getState().recentNotes).toEqual(['docs/alpha.md']);
    expect(store.getState().noteContentsCache.has('.vlaina/workspace.md')).toBe(true);
    expect(store.getState().noteContentsCache.has('.VLAINA/workspace.md')).toBe(true);
    expect(store.getState().noteMetadata?.notes['.vlaina/workspace.md']).toEqual({ createdAt: 2 });
    expect(store.getState().noteMetadata?.notes['.VLAINA/workspace.md']).toEqual({ createdAt: 3 });
  });

  it('does not remap state into an internal rename target', async () => {
    const store = createNotesStore({
      rootFolder: createFolder('', 'Notes', [
        createFolder('docs', 'docs', [createFile('docs/alpha.md', 'alpha')]),
      ]),
      currentNote: { path: 'docs/alpha.md', content: '# alpha' },
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      recentNotes: ['docs/alpha.md'],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
      noteMetadata: {
        version: 2,
        notes: {
          'docs/alpha.md': { createdAt: 1 },
        },
      },
    });

    await store.getState().applyExternalPathRename('docs/alpha.md', 'docs/.git/config.md');

    expect(store.getState().currentNote).toEqual({ path: 'docs/alpha.md', content: '# alpha' });
    expect(store.getState().openTabs).toEqual([
      { path: 'docs/alpha.md', name: 'alpha', isDirty: false },
    ]);
    expect(store.getState().recentNotes).toEqual(['docs/alpha.md']);
    expect(store.getState().noteContentsCache.has('docs/.git/config.md')).toBe(false);
    expect(store.getState().noteMetadata?.notes['docs/.git/config.md']).toBeUndefined();
    expect(hoisted.persistWorkspaceSnapshot).toHaveBeenCalledTimes(1);
  });

  it('does not remap state into a case-variant internal rename target', async () => {
    const store = createNotesStore({
      rootFolder: createFolder('', 'Notes', [
        createFolder('docs', 'docs', [createFile('docs/alpha.md', 'alpha')]),
      ]),
      currentNote: { path: 'docs/alpha.md', content: '# alpha' },
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      recentNotes: ['docs/alpha.md'],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
      noteMetadata: {
        version: 2,
        notes: {
          'docs/alpha.md': { createdAt: 1 },
        },
      },
    });

    await store.getState().applyExternalPathRename('docs/alpha.md', 'docs/.GIT/config.md');

    expect(store.getState().currentNote).toEqual({ path: 'docs/alpha.md', content: '# alpha' });
    expect(store.getState().openTabs).toEqual([
      { path: 'docs/alpha.md', name: 'alpha', isDirty: false },
    ]);
    expect(store.getState().recentNotes).toEqual(['docs/alpha.md']);
    expect(store.getState().noteContentsCache.has('docs/.GIT/config.md')).toBe(false);
    expect(store.getState().noteMetadata?.notes['docs/.GIT/config.md']).toBeUndefined();
    expect(hoisted.persistWorkspaceSnapshot).toHaveBeenCalledTimes(1);
  });

  it('ignores external renames with unsafe path characters at the action boundary', async () => {
    const store = createNotesStore({
      rootFolder: createFolder('', 'Notes', [
        createFolder('docs', 'docs', [createFile('docs/alpha.md', 'alpha')]),
      ]),
      currentNote: { path: 'docs/alpha.md', content: '# alpha' },
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      recentNotes: ['docs/alpha.md'],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
      noteMetadata: {
        version: 2,
        notes: {
          'docs/alpha.md': { createdAt: 1 },
        },
      },
    });

    await store.getState().applyExternalPathRename('docs/alpha.md', 'docs/beta\u202Egnp.md');
    await store.getState().applyExternalPathRename('docs/secret\u0000.md', 'docs/beta.md');

    expect(hoisted.flushCurrentPendingEditorMarkdown).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toEqual({ path: 'docs/alpha.md', content: '# alpha' });
    expect(store.getState().openTabs).toEqual([
      { path: 'docs/alpha.md', name: 'alpha', isDirty: false },
    ]);
    expect(store.getState().recentNotes).toEqual(['docs/alpha.md']);
    expect(store.getState().noteContentsCache.has('docs/beta\u202Egnp.md')).toBe(false);
    expect(store.getState().noteContentsCache.has('docs/beta.md')).toBe(false);
    expect(store.getState().noteMetadata?.notes['docs/beta\u202Egnp.md']).toBeUndefined();
    expect(hoisted.persistWorkspaceSnapshot).not.toHaveBeenCalled();
  });

  it('ignores external deletions with unsafe path characters at the action boundary', async () => {
    const store = createNotesStore({
      rootFolder: createFolder('', 'Notes', [
        createFolder('docs', 'docs', [createFile('docs/alpha.md', 'alpha')]),
      ]),
      currentNote: { path: 'docs/alpha.md', content: '# alpha' },
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      recentNotes: ['docs/alpha.md'],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });

    await store.getState().applyExternalPathDeletion('docs/secret\uFFFD.md');

    expect(hoisted.flushCurrentPendingEditorMarkdown).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toEqual({ path: 'docs/alpha.md', content: '# alpha' });
    expect(store.getState().openTabs).toEqual([
      { path: 'docs/alpha.md', name: 'alpha', isDirty: false },
    ]);
    expect(store.getState().recentNotes).toEqual(['docs/alpha.md']);
    expect(store.getState().noteContentsCache.has('docs/alpha.md')).toBe(true);
    expect(hoisted.persistWorkspaceSnapshot).not.toHaveBeenCalled();
  });

  it('treats renames into normalized internal paths as external deletions', async () => {
    const store = createNotesStore({
      rootFolder: createFolder('', 'Notes', [
        createFolder('docs', 'docs', [createFile('docs/alpha.md', 'alpha')]),
      ]),
      currentNote: { path: 'docs/keep.md', content: '# keep' },
      openTabs: [
        { path: 'docs/keep.md', name: 'keep', isDirty: false },
        { path: 'docs/alpha.md', name: 'alpha', isDirty: false },
      ],
      recentNotes: ['docs/keep.md', 'docs/alpha.md'],
      noteContentsCache: new Map([
        ['docs/keep.md', { content: '# keep', modifiedAt: 1 }],
        ['docs/alpha.md', { content: '# alpha', modifiedAt: 1 }],
      ]),
      noteMetadata: {
        version: 2,
        notes: {
          'docs/keep.md': { createdAt: 2 },
          'docs/alpha.md': { createdAt: 1 },
        },
      },
    });

    await store.getState().applyExternalPathRename('docs/alpha.md', 'docs/../.git/config.md');

    expect(store.getState().currentNote).toEqual({ path: 'docs/keep.md', content: '# keep' });
    expect(store.getState().openTabs).toEqual([
      { path: 'docs/keep.md', name: 'keep', isDirty: false },
    ]);
    expect(store.getState().recentNotes).toEqual(['docs/keep.md']);
    expect(store.getState().noteContentsCache.has('docs/alpha.md')).toBe(false);
    expect(store.getState().noteMetadata?.notes['docs/alpha.md']).toBeUndefined();
    expect(store.getState().noteMetadata?.notes['docs/../.git/config.md']).toBeUndefined();
    expect(hoisted.persistWorkspaceSnapshot).toHaveBeenCalledTimes(1);
  });

  it('keeps user dot folder renames working', async () => {
    const store = createNotesStore({
      rootFolder: createFolder('', 'Notes', [
        createFolder('.notes', '.notes', [createFile('.notes/alpha.md', 'alpha')]),
      ]),
      currentNote: { path: '.notes/alpha.md', content: '# alpha' },
      openTabs: [{ path: '.notes/alpha.md', name: 'alpha', isDirty: false }],
      recentNotes: ['.notes/alpha.md'],
      noteContentsCache: new Map([['.notes/alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });

    await store.getState().applyExternalPathRename('.notes/alpha.md', '.notes/beta.md');

    expect(store.getState().currentNote).toEqual({ path: '.notes/beta.md', content: '# alpha' });
    expect(store.getState().openTabs).toEqual([
      { path: '.notes/beta.md', name: 'beta', isDirty: false },
    ]);
    expect(store.getState().recentNotes).toEqual(['.notes/beta.md']);
    expect(store.getState().noteContentsCache.has('.notes/beta.md')).toBe(true);
    expect(store.getState().noteContentsCache.has('.notes/alpha.md')).toBe(false);
  });
});
