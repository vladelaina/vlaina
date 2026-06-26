import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createFeatureSlice } from './featureSlice';
import type { NotesStore } from '../types';

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  safeWriteTextFile: vi.fn(),
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

vi.mock('../storage', async () => {
  const actual = await vi.importActual<typeof import('../storage')>('../storage');
  return {
    ...actual,
    safeWriteTextFile: mocks.safeWriteTextFile,
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
    rootFolderPath: null,
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
    saveNote: vi.fn(async () => undefined),
  };

  return createStore<NotesStore>()((set, get, api) => ({
    ...(baseState as unknown as NotesStore),
    ...(createFeatureSlice(set, get, api) as unknown as NotesStore),
    ...(overrides as NotesStore),
  }));
}

describe('featureSlice metadata dirty background tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readFile.mockResolvedValue('');
    mocks.safeWriteTextFile.mockResolvedValue(undefined);
    mocks.stat.mockResolvedValue({ modifiedAt: 1, size: 16 });
  });

  it('keeps the file tree reference stable when cover metadata does not affect sorting', async () => {
    const notePath = 'alpha.md';
    const betaPath = 'beta.md';
    const rootFolder: NonNullable<NotesStore['rootFolder']> = {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: [
        { id: notePath, name: 'alpha', path: notePath, isFolder: false },
        { id: betaPath, name: 'beta', path: betaPath, isFolder: false },
      ],
    };
    const store = createNotesStore({
      rootFolder,
      currentNote: { path: notePath, content: '# Alpha' },
      openTabs: [{ path: notePath, name: 'alpha', isDirty: false }],
      fileTreeSortMode: 'updated-desc',
      noteContentsCache: new Map([[notePath, { content: '# Alpha', modifiedAt: 10 }]]),
      noteMetadata: {
        version: 2,
        notes: {
          [notePath]: { updatedAt: 10 },
          [betaPath]: { updatedAt: 2 },
        },
      },
    });

    store.getState().setNoteCover(notePath, {
      assetPath: '@monet/1',
      positionX: 50,
      positionY: 50,
      height: 200,
      scale: 1,
    });

    await vi.waitFor(() => {
      expect(store.getState().noteMetadata?.notes[notePath]?.cover?.assetPath).toBe('@monet/1');
    });
    await vi.waitFor(() => {
      expect(mocks.stat).toHaveBeenCalledTimes(2);
    });

    expect(store.getState().rootFolder).toBe(rootFolder);
  });

  it('still rebuilds the file tree when metadata changes the active sort timestamp', async () => {
    const notePath = 'alpha.md';
    const betaPath = 'beta.md';
    const rootFolder: NonNullable<NotesStore['rootFolder']> = {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: [
        { id: betaPath, name: 'beta', path: betaPath, isFolder: false },
        { id: notePath, name: 'alpha', path: notePath, isFolder: false },
      ],
    };
    const store = createNotesStore({
      rootFolder,
      currentNote: { path: notePath, content: '# Alpha' },
      openTabs: [{ path: notePath, name: 'alpha', isDirty: false }],
      fileTreeSortMode: 'updated-desc',
      noteContentsCache: new Map([[notePath, { content: '# Alpha', modifiedAt: 10 }]]),
      noteMetadata: {
        version: 2,
        notes: {
          [betaPath]: { updatedAt: 2 },
        },
      },
    });

    store.getState().setNoteCover(notePath, {
      assetPath: '@monet/1',
      positionX: 50,
      positionY: 50,
      height: 200,
      scale: 1,
    });

    await vi.waitFor(() => {
      expect(store.getState().noteMetadata?.notes[notePath]?.updatedAt).toBe(10);
    });

    expect(store.getState().rootFolder).not.toBe(rootFolder);
    expect(store.getState().rootFolder?.children.map((node) => node.path)).toEqual([
      notePath,
      betaPath,
    ]);
  });

  it('keeps vault metadata changes in memory for a dirty background tab', async () => {
    const notePath = 'docs/alpha.md';
    const store = createNotesStore({
      currentNote: { path: 'docs/beta.md', content: '# Beta' },
      openTabs: [
        { path: notePath, name: 'alpha', isDirty: true },
        { path: 'docs/beta.md', name: 'beta', isDirty: false },
      ],
      noteContentsCache: new Map([
        [notePath, { content: '# Unsaved alpha', modifiedAt: 1 }],
        ['docs/beta.md', { content: '# Beta', modifiedAt: 1 }],
      ]),
    });

    store.getState().setNoteIcon(notePath, '💡');

    await vi.waitFor(() => {
      expect(store.getState().noteMetadata?.notes[notePath]?.icon).toBe('💡');
    });

    expect(mocks.safeWriteTextFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toEqual({ path: 'docs/beta.md', content: '# Beta' });
    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().openTabs).toEqual([
      { path: notePath, name: 'alpha', isDirty: true },
      { path: 'docs/beta.md', name: 'beta', isDirty: false },
    ]);
    expect(store.getState().noteContentsCache.get(notePath)?.content).toContain('# Unsaved alpha');
    expect(store.getState().noteContentsCache.get(notePath)?.content).toContain('vlaina_icon');
  });

  it('keeps absolute metadata changes in memory for a dirty background tab', async () => {
    const notePath = '/notes/alpha.md';
    const store = createNotesStore({
      notesPath: '',
      rootFolder: null,
      currentNote: { path: '/notes/beta.md', content: '# Beta' },
      openTabs: [
        { path: notePath, name: 'alpha', isDirty: true },
        { path: '/notes/beta.md', name: 'beta', isDirty: false },
      ],
      noteContentsCache: new Map([
        [notePath, { content: '# Unsaved alpha', modifiedAt: 1 }],
        ['/notes/beta.md', { content: '# Beta', modifiedAt: 1 }],
      ]),
    });

    store.getState().setNoteCover(notePath, {
      assetPath: '@monet/1',
      positionX: 50,
      positionY: 50,
      height: 200,
      scale: 1,
    });

    await vi.waitFor(() => {
      expect(store.getState().noteMetadata?.notes[notePath]?.cover?.assetPath).toBe('@monet/1');
    });

    expect(mocks.safeWriteTextFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toEqual({ path: '/notes/beta.md', content: '# Beta' });
    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().openTabs).toEqual([
      { path: notePath, name: 'alpha', isDirty: true },
      { path: '/notes/beta.md', name: 'beta', isDirty: false },
    ]);
    expect(store.getState().noteContentsCache.get(notePath)?.content).toContain('# Unsaved alpha');
    expect(store.getState().noteContentsCache.get(notePath)?.content).toContain('vlaina_cover');
  });
});
