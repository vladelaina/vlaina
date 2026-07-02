import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createWorkspaceSlice } from './workspaceSlice';
import type { NotesStore } from '../types';

const hoisted = vi.hoisted(() => ({
  persistWorkspaceSnapshot: vi.fn(),
  saveNoteDocument: vi.fn(),
  storageExists: vi.fn(),
}));

vi.mock('../document/noteDocumentPersistence', () => ({
  saveNoteDocument: hoisted.saveNoteDocument,
}));

vi.mock('../workspacePersistence', () => ({
  persistWorkspaceSnapshot: hoisted.persistWorkspaceSnapshot,
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => ({
    exists: hoisted.storageExists,
  }),
  getParentPath: (path: string) => {
    const normalized = path.replace(/\/+/g, '/');
    const index = normalized.lastIndexOf('/');
    return index <= 0 ? '' : normalized.slice(0, index);
  },
  isAbsolutePath: (path: string) => path.startsWith('/'),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/').replace(/\/+/g, '/')),
  normalizeAbsolutePath: (path: string) => path,
  normalizePath: (path: string) => path.replace(/\\/g, '/'),
  relativePath: (base: string, target: string) =>
    target.replace(/\\/g, '/').replace(`${base.replace(/\\/g, '/').replace(/\/+$/, '')}/`, ''),
}));

vi.mock('../pendingEditorMarkdownFlusher', () => ({
  flushCurrentPendingEditorMarkdown: vi.fn(),
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
    rootFolderPath: null,
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

describe('workspace draft save state races', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.storageExists.mockResolvedValue(false);
    hoisted.persistWorkspaceSnapshot.mockReturnValue(undefined);
  });

  it('does not restore a cancelled draft discard prompt when draft save finishes', async () => {
    let resolveSave: ((value: {
      content: string;
      metadata: Record<string, unknown>;
      modifiedAt: number;
      size: number;
      nextCache: Map<string, { content: string; modifiedAt: number | null }>;
    }) => void) | undefined;
    hoisted.saveNoteDocument.mockImplementationOnce(() => new Promise((resolve) => {
      resolveSave = resolve;
    }));
    const store = createNotesStore({
      currentNote: { path: 'draft:blank', content: 'Draft body' },
      isDirty: true,
      openTabs: [{ path: 'draft:blank', name: '', isDirty: true }],
      draftNotes: {
        'draft:blank': { parentPath: null, name: 'Draft title' },
      },
      noteContentsCache: new Map([
        ['draft:blank', { content: 'Draft body', modifiedAt: null }],
      ]),
      pendingDraftDiscardPath: 'draft:blank',
    });

    const save = store.getState().saveNote({ explicit: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
    store.setState({ pendingDraftDiscardPath: null });

    resolveSave?.({
      content: 'Draft saved',
      metadata: { updatedAt: 2 },
      modifiedAt: 2,
      size: 11,
      nextCache: new Map([['Draft title.md', { content: 'Draft saved', modifiedAt: 2 }]]),
    });
    await save;

    expect(store.getState().pendingDraftDiscardPath).toBeNull();
  });

  it('persists the latest current note path when a draft save finishes after switching tabs', async () => {
    let resolveSave: ((value: {
      content: string;
      metadata: Record<string, unknown>;
      modifiedAt: number;
      size: number;
      nextCache: Map<string, { content: string; modifiedAt: number | null }>;
    }) => void) | undefined;
    hoisted.saveNoteDocument.mockImplementationOnce(() => new Promise((resolve) => {
      resolveSave = resolve;
    }));
    const store = createNotesStore({
      currentNote: { path: 'draft:blank', content: 'Draft body' },
      isDirty: true,
      openTabs: [
        { path: 'draft:blank', name: '', isDirty: true },
        { path: 'beta.md', name: 'beta', isDirty: false },
      ],
      draftNotes: {
        'draft:blank': { parentPath: null, name: 'Draft title' },
      },
      noteContentsCache: new Map([
        ['draft:blank', { content: 'Draft body', modifiedAt: null }],
        ['beta.md', { content: '# beta', modifiedAt: 1 }],
      ]),
    });

    const save = store.getState().saveNote({ explicit: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
    store.setState((state) => ({
      currentNote: { path: 'beta.md', content: '# beta' },
      currentNoteRevision: state.currentNoteRevision + 1,
      isDirty: false,
    }));

    resolveSave?.({
      content: 'Draft saved',
      metadata: { updatedAt: 2 },
      modifiedAt: 2,
      size: 11,
      nextCache: new Map([['Draft title.md', { content: 'Draft saved', modifiedAt: 2 }]]),
    });
    await save;

    expect(store.getState().currentNote).toEqual({ path: 'beta.md', content: '# beta' });
    expect(hoisted.persistWorkspaceSnapshot).toHaveBeenCalledWith('/notesRoot', expect.objectContaining({
      currentNotePath: 'beta.md',
    }));
  });

  it('does not clear a newer current draft created while an older draft save is finishing', async () => {
    let resolveSave: ((value: {
      content: string;
      metadata: Record<string, unknown>;
      modifiedAt: number;
      size: number;
      nextCache: Map<string, { content: string; modifiedAt: number | null }>;
    }) => void) | undefined;
    hoisted.saveNoteDocument.mockImplementationOnce(() => new Promise((resolve) => {
      resolveSave = resolve;
    }));
    const store = createNotesStore({
      currentNote: { path: 'draft:first', content: 'First draft body' },
      isDirty: true,
      isNewlyCreated: true,
      openTabs: [{ path: 'draft:first', name: '', isDirty: true }],
      draftNotes: {
        'draft:first': { parentPath: null, name: 'First title' },
      },
      noteContentsCache: new Map([
        ['draft:first', { content: 'First draft body', modifiedAt: null }],
      ]),
    });

    const save = store.getState().saveNote({ explicit: false });
    await new Promise((resolve) => setTimeout(resolve, 0));

    store.setState((state) => ({
      currentNote: { path: 'draft:second', content: '' },
      currentNoteRevision: state.currentNoteRevision + 1,
      isDirty: false,
      isNewlyCreated: true,
      openTabs: [
        ...state.openTabs,
        { path: 'draft:second', name: '', isDirty: false },
      ],
      draftNotes: {
        ...state.draftNotes,
        'draft:second': { parentPath: null, name: '' },
      },
      noteContentsCache: new Map(state.noteContentsCache).set('draft:second', {
        content: '',
        modifiedAt: null,
      }),
    }));

    resolveSave?.({
      content: 'First draft saved',
      metadata: { updatedAt: 2 },
      modifiedAt: 2,
      size: 17,
      nextCache: new Map([['First title.md', { content: 'First draft saved', modifiedAt: 2 }]]),
    });
    await save;

    expect(store.getState().currentNote).toEqual({ path: 'draft:second', content: '' });
    expect(store.getState().isNewlyCreated).toBe(true);
    expect(store.getState().draftNotes).toEqual({
      'draft:second': { parentPath: null, name: '' },
    });
    expect(store.getState().openTabs).toEqual([
      { path: 'First title.md', name: 'First title', isDirty: false },
      { path: 'draft:second', name: '', isDirty: false },
    ]);
  });
});
