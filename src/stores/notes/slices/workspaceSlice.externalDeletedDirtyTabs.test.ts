import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createWorkspaceSlice } from './workspaceSlice';
import type { FolderNode, NoteFile, NotesStore } from '../types';

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
  const baseState = {
    rootFolder: createFolder('', 'Notes', []),
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

describe('workspaceSlice external deletion dirty tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.flushCurrentPendingEditorMarkdown.mockReset();
  });

  it('preserves a dirty background tab when its disk file is deleted externally', async () => {
    const keepFile = createFile('docs/keep.md', 'keep');
    const removeFile = createFile('docs/remove.md', 'remove');
    const store = createNotesStore({
      rootFolder: createFolder('', 'Notes', [
        createFolder('docs', 'docs', [keepFile, removeFile]),
      ]),
      currentNote: { path: 'docs/keep.md', content: '# keep' },
      openTabs: [
        { path: 'docs/keep.md', name: 'keep', isDirty: false },
        { path: 'docs/remove.md', name: 'remove', isDirty: true },
      ],
      recentNotes: ['docs/keep.md', 'docs/remove.md'],
      displayNames: new Map([
        ['docs/keep.md', 'keep'],
        ['docs/remove.md', 'remove'],
      ]),
      noteContentsCache: new Map([
        ['docs/keep.md', { content: '# keep', modifiedAt: 1 }],
        ['docs/remove.md', { content: '# unsaved remove', modifiedAt: 2 }],
      ]),
    });

    await store.getState().applyExternalPathDeletion('docs/remove.md');

    expect(store.getState().currentNote).toEqual({ path: 'docs/keep.md', content: '# keep' });
    expect(store.getState().openTabs).toEqual([
      { path: 'docs/keep.md', name: 'keep', isDirty: false },
      { path: 'docs/remove.md', name: 'remove', isDirty: true },
    ]);
    expect(store.getState().recentNotes).toEqual(['docs/keep.md', 'docs/remove.md']);
    expect(store.getState().displayNames.get('docs/remove.md')).toBe('remove');
    expect(store.getState().noteContentsCache.get('docs/remove.md')).toEqual({
      content: '# unsaved remove',
      modifiedAt: 2,
    });
    expect(store.getState().rootFolder?.children[0]).toEqual(
      createFolder('docs', 'docs', [keepFile, removeFile]),
    );
    expect(hoisted.openStoredNotePath).not.toHaveBeenCalled();
  });

  it('still prunes a clean background tab when its disk file is deleted externally', async () => {
    const keepFile = createFile('docs/keep.md', 'keep');
    const removeFile = createFile('docs/remove.md', 'remove');
    const store = createNotesStore({
      rootFolder: createFolder('', 'Notes', [
        createFolder('docs', 'docs', [keepFile, removeFile]),
      ]),
      currentNote: { path: 'docs/keep.md', content: '# keep' },
      openTabs: [
        { path: 'docs/keep.md', name: 'keep', isDirty: false },
        { path: 'docs/remove.md', name: 'remove', isDirty: false },
      ],
      recentNotes: ['docs/keep.md', 'docs/remove.md'],
      displayNames: new Map([
        ['docs/keep.md', 'keep'],
        ['docs/remove.md', 'remove'],
      ]),
      noteContentsCache: new Map([
        ['docs/keep.md', { content: '# keep', modifiedAt: 1 }],
        ['docs/remove.md', { content: '# remove', modifiedAt: 2 }],
      ]),
    });

    await store.getState().applyExternalPathDeletion('docs/remove.md');

    expect(store.getState().openTabs).toEqual([
      { path: 'docs/keep.md', name: 'keep', isDirty: false },
    ]);
    expect(store.getState().recentNotes).toEqual(['docs/keep.md']);
    expect(store.getState().displayNames.has('docs/remove.md')).toBe(false);
    expect(store.getState().noteContentsCache.has('docs/remove.md')).toBe(false);
    expect(store.getState().rootFolder?.children[0]).toEqual(
      createFolder('docs', 'docs', [keepFile]),
    );
  });
});
