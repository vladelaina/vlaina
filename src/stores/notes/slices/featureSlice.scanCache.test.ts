import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createFeatureSlice } from './featureSlice';
import type { NotesStore } from '../types';
import { createCachedNoteContentEntry } from '../document/noteContentCache';

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));

vi.mock('@/lib/storage/adapter', async () => {
  const actual = await vi.importActual<typeof import('@/lib/storage/adapter')>('@/lib/storage/adapter');
  return {
    ...actual,
    getStorageAdapter: () => ({
      readFile: mocks.readFile,
      stat: mocks.stat,
    }),
  };
});

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
    saveNote: vi.fn(async () => undefined),
  };

  return createStore<NotesStore>()((set, get, api) => ({
    ...(baseState as unknown as NotesStore),
    ...(createFeatureSlice(set, get, api) as unknown as NotesStore),
    ...(overrides as NotesStore),
  }));
}

describe('featureSlice scan cache validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.stat.mockResolvedValue({ isFile: true, size: 7 });
    mocks.readFile.mockResolvedValue('# Disk!');
  });

  it('does not reuse scanned note content when stat has size but no modified time', async () => {
    const notePath = 'docs/alpha.md';
    const store = createNotesStore({
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [
          {
            id: notePath,
            name: 'alpha.md',
            path: notePath,
            isFolder: false,
          },
        ],
      },
      noteContentsCache: new Map([
        [notePath, createCachedNoteContentEntry('# Cache', null, { size: 7 })],
      ]),
    });

    await store.getState().scanAllNotes();

    expect(mocks.readFile).toHaveBeenCalledWith('/vault/docs/alpha.md');
    expect(store.getState().noteContentsCache.get(notePath)).toEqual({
      content: '# Disk!',
      modifiedAt: null,
    });
    expect(store.getState().noteContentsCache.get(notePath)?.size).toBe(7);
  });

  it('caps full-vault scan tree traversal across non-markdown nodes', async () => {
    const store = createNotesStore({
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [
          {
            id: 'early.md',
            name: 'early.md',
            path: 'early.md',
            isFolder: false,
          },
          ...Array.from({ length: 19_999 }, (_, index) => ({
            id: `asset-${index}.png`,
            name: `asset-${index}.png`,
            path: `asset-${index}.png`,
            isFolder: false as const,
          })),
          {
            id: 'late.md',
            name: 'late.md',
            path: 'late.md',
            isFolder: false,
          },
        ],
      },
    });

    await store.getState().scanAllNotes();

    expect(mocks.stat).toHaveBeenCalledTimes(1);
    expect(mocks.readFile).toHaveBeenCalledWith('/vault/early.md');
    expect(mocks.readFile).not.toHaveBeenCalledWith('/vault/late.md');
    expect(store.getState().noteContentsCache.has('early.md')).toBe(true);
    expect(store.getState().noteContentsCache.has('late.md')).toBe(false);
  });
});
