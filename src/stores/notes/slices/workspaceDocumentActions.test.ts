import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createWorkspaceSlice } from './workspaceSlice';
import type { NotesStore } from '../types';

const mocks = vi.hoisted(() => ({
  chooseDraftSavePath: vi.fn(),
  dispatchOpenMarkdownTargetEvent: vi.fn(),
  persistWorkspaceSnapshot: vi.fn(),
  saveNoteDocument: vi.fn(),
}));

vi.mock('../draftNoteSave', async () => {
  const actual = await vi.importActual<typeof import('../draftNoteSave')>('../draftNoteSave');
  return {
    ...actual,
    chooseDraftSavePath: mocks.chooseDraftSavePath,
  };
});

vi.mock('../document/noteDocumentPersistence', () => ({
  saveNoteDocument: mocks.saveNoteDocument,
}));

vi.mock('../workspacePersistence', () => ({
  persistWorkspaceSnapshot: mocks.persistWorkspaceSnapshot,
}));

vi.mock('@/components/Notes/features/OpenTarget/openTargetEvents', () => ({
  dispatchOpenMarkdownTargetEvent: mocks.dispatchOpenMarkdownTargetEvent,
}));

vi.mock('@/lib/storage/adapter', () => ({
  isAbsolutePath: (path: string) => path.startsWith('/'),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/').replace(/\/+/g, '/')),
  normalizePath: (path: string) => path.replace(/\\/g, '/'),
  relativePath: (base: string, target: string) =>
    target.replace(/\\/g, '/').replace(`${base.replace(/\\/g, '/').replace(/\/+$/, '')}/`, ''),
  getParentPath: (path: string) => {
    const index = path.replace(/\\/g, '/').lastIndexOf('/');
    return index <= 0 ? '' : path.slice(0, index);
  },
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

describe('workspace document actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chooseDraftSavePath.mockResolvedValue('/vault/Untitled.md');
    mocks.saveNoteDocument.mockResolvedValue({
      content: 'draft text',
      metadata: { updatedAt: 1 },
      modifiedAt: 1,
      nextCache: new Map([['Untitled.md', { content: 'draft text', modifiedAt: 1 }]]),
    });
    mocks.persistWorkspaceSnapshot.mockReturnValue(undefined);
  });

  it('keeps the active tab dirty when a draft save fails after the file write step', async () => {
    mocks.persistWorkspaceSnapshot.mockImplementation(() => {
      throw new Error('snapshot failed');
    });
    const store = createNotesStore({
      currentNote: { path: 'draft:blank', content: 'draft text' },
      isDirty: true,
      openTabs: [{ path: 'draft:blank', name: '', isDirty: true }],
      draftNotes: {
        'draft:blank': { parentPath: null, name: '' },
      },
      noteContentsCache: new Map([['draft:blank', { content: 'draft text', modifiedAt: null }]]),
    });

    await store.getState().saveNote({ explicit: true });

    expect(store.getState().error).toBe('snapshot failed');
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().openTabs).toEqual([{ path: 'Untitled.md', name: 'Untitled', isDirty: true }]);
  });

  it('dispatches an open target after saving a draft outside the current vault', async () => {
    mocks.chooseDraftSavePath.mockResolvedValue('/home/vladelaina/sdf.md');
    mocks.saveNoteDocument.mockResolvedValue({
      content: 'draft text',
      metadata: { updatedAt: 1 },
      modifiedAt: 1,
      nextCache: new Map([
        ['draft:blank', { content: 'draft text', modifiedAt: null }],
        ['/home/vladelaina/sdf.md', { content: 'draft text', modifiedAt: 1 }],
      ]),
    });
    const store = createNotesStore({
      currentNote: { path: 'draft:blank', content: 'draft text' },
      isDirty: true,
      openTabs: [{ path: 'draft:blank', name: '', isDirty: true }],
      draftNotes: {
        'draft:blank': { parentPath: null, name: 'sdf' },
      },
      noteContentsCache: new Map([['draft:blank', { content: 'draft text', modifiedAt: null }]]),
    });

    await store.getState().saveNote({ explicit: true });

    expect(store.getState().currentNote?.path).toBe('/home/vladelaina/sdf.md');
    expect(store.getState().openTabs).toEqual([{ path: '/home/vladelaina/sdf.md', name: 'sdf', isDirty: false }]);
    expect(mocks.dispatchOpenMarkdownTargetEvent).toHaveBeenCalledWith('/home/vladelaina/sdf.md');
  });
});
