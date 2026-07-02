import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createWorkspaceSlice } from './workspaceSlice';
import type { NotesStore } from '../types';

const MAX_NOTE_DOCUMENT_BYTES = 10 * 1024 * 1024;

const storageAdapter = vi.hoisted(() => ({
  stat: vi.fn<(path: string) => Promise<{ isFile?: boolean; isDirectory?: boolean; modifiedAt?: number | null; size?: number | null } | null>>(),
  readFile: vi.fn<(path: string, maxBytes?: number) => Promise<string>>(),
}));

const hoisted = vi.hoisted(() => ({
  persistWorkspaceSnapshot: vi.fn(),
  flushCurrentPendingEditorMarkdown: vi.fn(),
}));

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
}));

function createNotesStore(overrides: Partial<NotesStore> = {}) {
  const baseState = {
    rootFolder: null,
    rootFolderPath: '/notesRoot',
    currentNote: null,
    currentNoteRevision: 0,
    currentNoteDiskRevision: 0,
    notesPath: '/notesRoot',
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

describe('workspaceSlice external mutation races', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageAdapter.stat.mockReset();
    storageAdapter.readFile.mockReset();
    storageAdapter.stat.mockResolvedValue({ isFile: true, modifiedAt: 4, size: 16 });
    hoisted.flushCurrentPendingEditorMarkdown.mockReset();
  });

  it('does not open a note after that path is deleted while disk read is pending', async () => {
    let resolveRead: (content: string) => void = () => {
      throw new Error('read did not start');
    };
    storageAdapter.readFile.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveRead = resolve;
        })
    );

    const store = createNotesStore({
      currentNote: { path: 'alpha.md', content: '# alpha' },
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });

    const open = store.getState().openNote('beta.md');
    await vi.waitFor(() => {
      expect(storageAdapter.readFile).toHaveBeenCalledWith('/notesRoot/beta.md', MAX_NOTE_DOCUMENT_BYTES);
    });

    await store.getState().applyExternalPathDeletion('beta.md');
    resolveRead('# beta');
    await open;

    expect(store.getState().currentNote).toEqual({ path: 'alpha.md', content: '# alpha' });
    expect(store.getState().openTabs).toEqual([{ path: 'alpha.md', name: 'alpha', isDirty: false }]);
    expect(store.getState().recentNotes).toEqual([]);
    expect(store.getState().noteContentsCache.has('beta.md')).toBe(false);
  });

  it('does not cache a prefetched note after that path is renamed while disk read is pending', async () => {
    let resolveRead: (content: string) => void = () => {
      throw new Error('read did not start');
    };
    storageAdapter.readFile.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveRead = resolve;
        })
    );

    const store = createNotesStore({
      currentNote: { path: 'alpha.md', content: '# alpha' },
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['alpha.md', { content: '# alpha', modifiedAt: 1 }]]),
    });

    const prefetch = store.getState().prefetchNote('beta.md');
    await vi.waitFor(() => {
      expect(storageAdapter.readFile).toHaveBeenCalledWith('/notesRoot/beta.md', MAX_NOTE_DOCUMENT_BYTES);
    });

    await store.getState().applyExternalPathRename('beta.md', 'gamma.md');
    resolveRead('# beta');
    await prefetch;

    expect(store.getState().currentNote).toEqual({ path: 'alpha.md', content: '# alpha' });
    expect(store.getState().openTabs).toEqual([{ path: 'alpha.md', name: 'alpha', isDirty: false }]);
    expect(store.getState().noteContentsCache.has('beta.md')).toBe(false);
    expect(store.getState().noteContentsCache.has('gamma.md')).toBe(false);
  });
});
