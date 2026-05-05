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

describe('featureSlice draft metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readFile.mockResolvedValue('');
    mocks.safeWriteTextFile.mockResolvedValue(undefined);
    mocks.stat.mockResolvedValue({ modifiedAt: 1 });
  });

  it('materializes an active draft instead of writing metadata to a draft path', async () => {
    const saveNote = vi.fn(async () => undefined);
    const store = createNotesStore({
      currentNote: { path: 'draft:blank', content: '' },
      openTabs: [{ path: 'draft:blank', name: '', isDirty: false }],
      draftNotes: {
        'draft:blank': { parentPath: null, name: '' },
      },
      noteContentsCache: new Map([['draft:blank', { content: '', modifiedAt: null }]]),
      saveNote,
    });

    store.getState().setNoteIcon('draft:blank', 'sparkles');

    await vi.waitFor(() => {
      expect(saveNote).toHaveBeenCalledWith({ explicit: false });
    });

    expect(store.getState().currentNote?.path).toBe('draft:blank');
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().openTabs).toEqual([
      { path: 'draft:blank', name: '', isDirty: true },
    ]);
    expect(store.getState().noteMetadata?.notes['draft:blank']?.icon).toBe('sparkles');
  });

  it('stores active draft metadata in memory when no vault is selected', async () => {
    const saveNote = vi.fn(async () => undefined);
    const store = createNotesStore({
      notesPath: '',
      rootFolder: null,
      currentNote: { path: 'draft:blank', content: '' },
      openTabs: [{ path: 'draft:blank', name: '', isDirty: false }],
      draftNotes: {
        'draft:blank': { parentPath: null, name: '' },
      },
      noteContentsCache: new Map([['draft:blank', { content: '', modifiedAt: null }]]),
      saveNote,
    });

    store.getState().setNoteIcon('draft:blank', 'sparkles');
    store.getState().setNoteCover('draft:blank', {
      assetPath: '@monet/1',
      positionX: 50,
      positionY: 50,
      height: 200,
      scale: 1,
    });

    await vi.waitFor(() => {
      expect(store.getState().noteMetadata?.notes['draft:blank']?.cover?.assetPath).toBe('@monet/1');
    });

    expect(saveNote).not.toHaveBeenCalled();
    expect(store.getState().noteMetadata?.notes['draft:blank']?.icon).toBe('sparkles');
    expect(store.getState().currentNote?.path).toBe('draft:blank');
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().openTabs).toEqual([
      { path: 'draft:blank', name: '', isDirty: true },
    ]);
  });

  it('keeps preserved draft metadata in memory instead of implicitly saving into the new vault', async () => {
    const saveNote = vi.fn(async () => undefined);
    const store = createNotesStore({
      notesPath: '/vault-next',
      currentNote: { path: 'draft:blank', content: '' },
      openTabs: [{ path: 'draft:blank', name: '', isDirty: false }],
      draftNotes: {
        'draft:blank': { parentPath: null, name: '', originNotesPath: '' },
      },
      noteContentsCache: new Map([['draft:blank', { content: '', modifiedAt: null }]]),
      saveNote,
    });

    store.getState().setNoteIcon('draft:blank', 'sparkles');
    store.getState().setNoteCover('draft:blank', {
      assetPath: '@monet/1',
      positionX: 50,
      positionY: 50,
      height: 200,
      scale: 1,
    });

    await vi.waitFor(() => {
      expect(store.getState().noteMetadata?.notes['draft:blank']?.cover?.assetPath).toBe('@monet/1');
    });

    expect(saveNote).not.toHaveBeenCalled();
    expect(store.getState().noteMetadata?.notes['draft:blank']?.icon).toBe('sparkles');
    expect(store.getState().currentNote?.path).toBe('draft:blank');
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().openTabs).toEqual([
      { path: 'draft:blank', name: '', isDirty: true },
    ]);
  });

  it('writes metadata for an absolute note opened without a vault', async () => {
    const store = createNotesStore({
      notesPath: '',
      rootFolder: null,
      currentNote: { path: '/notes/alpha.md', content: '# Alpha' },
      openTabs: [{ path: '/notes/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['/notes/alpha.md', { content: '# Alpha', modifiedAt: 1 }]]),
    });

    store.getState().setNoteIcon('/notes/alpha.md', 'sparkles');

    await vi.waitFor(() => {
      expect(mocks.safeWriteTextFile).toHaveBeenCalled();
    });

    expect(mocks.safeWriteTextFile.mock.calls[0]?.[0]).toBe('/notes/alpha.md');
    expect(store.getState().noteMetadata?.notes['/notes/alpha.md']?.icon).toBe('sparkles');
    expect(store.getState().currentNote?.content).toContain('vlaina_icon');
    expect(store.getState().isDirty).toBe(false);
  });

  it('removes stale absolute-note icon and cover metadata after frontmatter deletion', async () => {
    const notePath = '/notes/alpha.md';
    const content = [
      '---',
      'vlaina_cover: "@monet/4"',
      'vlaina_cover_x: 50',
      'vlaina_cover_y: 50',
      'vlaina_cover_height: 200',
      'vlaina_cover_scale: 1',
      'vlaina_icon: "sparkles"',
      '---',
      '# Alpha',
    ].join('\n');
    const store = createNotesStore({
      notesPath: '',
      rootFolder: null,
      currentNote: { path: notePath, content },
      openTabs: [{ path: notePath, name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([[notePath, { content, modifiedAt: 1 }]]),
      noteMetadata: {
        version: 2,
        notes: {
          [notePath]: {
            icon: 'sparkles',
            cover: {
              assetPath: '@monet/4',
              positionX: 50,
              positionY: 50,
              height: 200,
              scale: 1,
            },
          },
        },
      },
    });

    store.getState().setNoteIcon(notePath, null);

    await vi.waitFor(() => {
      expect(store.getState().currentNote?.content).not.toContain('vlaina_icon');
    });
    expect(store.getState().noteMetadata?.notes[notePath]?.icon).toBeUndefined();
    expect(store.getState().noteMetadata?.notes[notePath]?.cover?.assetPath).toBe('@monet/4');

    store.getState().setNoteCover(notePath, null);

    await vi.waitFor(() => {
      expect(store.getState().currentNote?.content).not.toContain('vlaina_cover');
    });
    expect(store.getState().noteMetadata?.notes[notePath]?.icon).toBeUndefined();
    expect(store.getState().noteMetadata?.notes[notePath]?.cover).toBeUndefined();
  });
});
