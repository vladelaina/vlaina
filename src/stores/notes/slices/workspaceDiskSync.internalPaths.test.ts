import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createWorkspaceSlice } from './workspaceSlice';
import type { NotesStore } from '../types';

const storageAdapter = vi.hoisted(() => ({
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  stat: vi.fn<(path: string) => Promise<{ isFile?: boolean; isDirectory?: boolean; modifiedAt?: number | null; size?: number | null } | null>>(),
  readFile: vi.fn<(path: string) => Promise<string>>(),
}));

const hoisted = vi.hoisted(() => ({
  flushCurrentPendingEditorMarkdown: vi.fn(),
  persistWorkspaceSnapshot: vi.fn(),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => storageAdapter,
  getBaseName: (path: string) => path.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ?? '',
  getParentPath: (path: string) => {
    const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
    const index = normalized.lastIndexOf('/');
    return index > 0 ? normalized.slice(0, index) : null;
  },
  isAbsolutePath: (path: string) => path.startsWith('/'),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/').replace(/\/+/g, '/')),
  normalizeAbsolutePath: (path: string) => path,
}));

vi.mock('../pendingEditorMarkdownFlusher', () => ({
  flushCurrentPendingEditorMarkdown: hoisted.flushCurrentPendingEditorMarkdown,
}));

vi.mock('../workspacePersistence', () => ({
  persistWorkspaceSnapshot: hoisted.persistWorkspaceSnapshot,
}));

function createNotesStore(overrides: Partial<NotesStore> = {}) {
  const baseState = {
    rootFolder: {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: [],
    },
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

describe('workspace disk sync internal paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.flushCurrentPendingEditorMarkdown.mockReturnValue(false);
    storageAdapter.exists.mockResolvedValue(true);
    storageAdapter.stat.mockResolvedValue({ isFile: true, modifiedAt: 2, size: 16 });
    storageAdapter.readFile.mockResolvedValue('# updated');
  });

  it('does not stat or read stale internal current-note paths', async () => {
    const store = createNotesStore({
      currentNote: { path: 'docs/.git/config.md', content: '# hidden' },
      openTabs: [{ path: 'docs/.git/config.md', name: 'config', isDirty: false }],
      noteContentsCache: new Map([['docs/.git/config.md', { content: '# hidden', modifiedAt: 1 }]]),
    });

    const result = await store.getState().syncCurrentNoteFromDisk({ force: true });

    expect(result).toBe('ignored');
    expect(hoisted.flushCurrentPendingEditorMarkdown).not.toHaveBeenCalled();
    expect(storageAdapter.exists).not.toHaveBeenCalled();
    expect(storageAdapter.stat).not.toHaveBeenCalled();
    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toEqual({ path: 'docs/.git/config.md', content: '# hidden' });
    expect(store.getState().error).toBe('Path must not be inside an internal notes folder.');
  });

  it('does not sync current notes when the active vault is internal', async () => {
    const store = createNotesStore({
      notesPath: '/vault/.vlaina',
      currentNote: { path: 'docs/alpha.md', content: '# alpha' },
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['docs/alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });

    const result = await store.getState().syncCurrentNoteFromDisk({ force: true });

    expect(result).toBe('ignored');
    expect(hoisted.flushCurrentPendingEditorMarkdown).not.toHaveBeenCalled();
    expect(storageAdapter.exists).not.toHaveBeenCalled();
    expect(storageAdapter.stat).not.toHaveBeenCalled();
    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().error).toBe('Path must not be inside an internal notes folder.');
  });

  it('continues to sync user dot-folder notes', async () => {
    const store = createNotesStore({
      currentNote: { path: '.notes/alpha.md', content: '# alpha' },
      openTabs: [{ path: '.notes/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['.notes/alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });

    const result = await store.getState().syncCurrentNoteFromDisk({ force: true });

    expect(result).toBe('reloaded');
    expect(storageAdapter.readFile).toHaveBeenCalledWith('/vault/.notes/alpha.md');
    expect(store.getState().currentNote).toEqual({ path: '.notes/alpha.md', content: '# updated' });
    expect(store.getState().error).toBeNull();
  });
});
