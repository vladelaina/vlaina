import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  deleteNoteImpl: vi.fn(),
  deleteFolderImpl: vi.fn(),
  cancelPendingSystemTrash: vi.fn(),
  isPendingSystemTrashCommitting: vi.fn(),
  restoreNoteItemFromPendingTrash: vi.fn(),
  schedulePendingSystemTrash: vi.fn(),
  getStateForPathDeletion: vi.fn(),
  getStateForPathRename: vi.fn(),
  persistWorkspaceSnapshot: vi.fn(),
  saveStarredRegistry: vi.fn(),
  saveNoteDocument: vi.fn(),
  flushCurrentPendingEditorMarkdown: vi.fn(),
}));

vi.mock('../utils/fs/deleteOperations', () => ({
  deleteNoteImpl: hoisted.deleteNoteImpl,
  deleteFolderImpl: hoisted.deleteFolderImpl,
}));

vi.mock('../utils/fs/trashOperations', () => ({
  cancelPendingSystemTrash: hoisted.cancelPendingSystemTrash,
  isPendingSystemTrashCommitting: hoisted.isPendingSystemTrashCommitting,
  restoreNoteItemFromPendingTrash: hoisted.restoreNoteItemFromPendingTrash,
  schedulePendingSystemTrash: hoisted.schedulePendingSystemTrash,
}));

vi.mock('../utils/fs/pathStateEffects', () => ({
  getStateForPathDeletion: hoisted.getStateForPathDeletion,
  getStateForPathRename: hoisted.getStateForPathRename,
}));

vi.mock('../workspacePersistence', () => ({
  persistWorkspaceSnapshot: hoisted.persistWorkspaceSnapshot,
}));

vi.mock('../pendingEditorMarkdownFlusher', () => ({
  flushCurrentPendingEditorMarkdown: hoisted.flushCurrentPendingEditorMarkdown,
}));

vi.mock('../document/noteDocumentPersistence', () => ({
  saveNoteDocument: hoisted.saveNoteDocument,
}));

vi.mock('../starred', async () => {
  const actual = await vi.importActual<typeof import('../starred')>('../starred');
  return {
    ...actual,
    saveStarredRegistry: hoisted.saveStarredRegistry,
  };
});

import { createFileSystemSlice } from './fileSystemSlice';
import type { FileTreeNode } from '../types';

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
    notesPath: '/notesRoot',
    currentNote: null,
    currentNoteRevision: 0,
    isDirty: false,
    error: null,
    recentNotes: [],
    openTabs: [],
    noteContentsCache: new Map(),
    draftNotes: {},
    noteMetadata: { version: 2, notes: {} },
    displayNames: new Map(),
    starredEntries: [],
    starredNotes: [],
    starredFolders: [],
    openNote: vi.fn(),
    saveNote: vi.fn(async () => {
      state = { ...state, isDirty: false };
    }),
    loadFileTree: vi.fn().mockResolvedValue(undefined),
    pendingDeletedItems: [],
    discardDraftNote: vi.fn(),
    fileTreeSortMode: 'name-asc',
    ...overrides,
  };

  return {
    getState: () => state,
  };
}

function createFile(path: string, name: string): FileTreeNode {
  return { id: path, path, name, isFolder: false };
}

function pruneDeletedState({
  path,
  recentNotes,
  displayNames,
  noteContentsCache,
}: {
  path: string;
  recentNotes: string[];
  displayNames: Map<string, string>;
  noteContentsCache: Map<string, { content: string; modifiedAt: number | null }>;
}) {
  const shouldRemove = (candidate: string) => candidate === path || candidate.startsWith(`${path}/`);
  const nextDisplayNames = new Map(displayNames);
  const nextNoteContentsCache = new Map(noteContentsCache);

  for (const key of nextDisplayNames.keys()) {
    if (shouldRemove(key)) {
      nextDisplayNames.delete(key);
    }
  }
  for (const key of nextNoteContentsCache.keys()) {
    if (shouldRemove(key)) {
      nextNoteContentsCache.delete(key);
    }
  }

  return {
    nextRecentNotes: recentNotes.filter((recentPath) => !shouldRemove(recentPath)),
    nextDisplayNames,
    nextNoteContentsCache,
  };
}

function trashedItem(path: string, kind: 'file' | 'folder') {
  return {
    id: `delete-${path}`,
    kind,
    originalPath: path,
    originalFullPath: `/notesRoot/${path}`,
    stagingPath: `/app/.vlaina/notes/notes-roots/notes-root-test/trash/delete-${path}/${path.split('/').pop() ?? path}`,
    deletedAt: 1,
  };
}

describe('fileSystemSlice dirty tab deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.flushCurrentPendingEditorMarkdown.mockReturnValue(false);
    hoisted.schedulePendingSystemTrash.mockImplementation(() => undefined);
    hoisted.isPendingSystemTrashCommitting.mockReturnValue(false);
    hoisted.getStateForPathDeletion.mockImplementation(pruneDeletedState);
    hoisted.saveNoteDocument.mockResolvedValue({
      content: '# saved beta',
      metadata: { updatedAt: 4 },
      modifiedAt: 5,
      size: 12,
    });
  });

  it('saves a dirty background note before deleting its file', async () => {
    let deleteContext: any = null;
    hoisted.deleteNoteImpl.mockImplementation(async (_notesPath, _path, context) => {
      deleteContext = context;
      return {
        updatedTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
        updatedStarredEntries: [],
        updatedStarredNotes: [],
        updatedStarredFolders: [],
        nextAction: null,
        updatedMetadata: { version: 2, notes: {} },
        newChildren: [createFile('alpha.md', 'alpha')],
        trashedItem: trashedItem('beta.md', 'file'),
      };
    });

    const harness = createSliceHarness({
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [createFile('alpha.md', 'alpha'), createFile('beta.md', 'beta')],
      },
      currentNote: { path: 'alpha.md', content: '# alpha' },
      openTabs: [
        { path: 'alpha.md', name: 'alpha', isDirty: false },
        { path: 'beta.md', name: 'beta', isDirty: true },
      ],
      noteContentsCache: new Map([
        ['alpha.md', { content: '# alpha', modifiedAt: 1 }],
        ['beta.md', { content: '# unsaved beta', modifiedAt: 2 }],
      ]),
    });

    await harness.getState().deleteNote('beta.md');

    expect(hoisted.saveNoteDocument).toHaveBeenCalledWith({
      notesPath: '/notesRoot',
      currentNote: { path: 'beta.md', content: '# unsaved beta' },
      cache: expect.any(Map),
    });
    expect(hoisted.saveNoteDocument.mock.invocationCallOrder[0])
      .toBeLessThan(hoisted.deleteNoteImpl.mock.invocationCallOrder[0]);
    expect(deleteContext.openTabs).toEqual([
      { path: 'alpha.md', name: 'alpha', isDirty: false },
      { path: 'beta.md', name: 'beta', isDirty: false },
    ]);
    expect(deleteContext.noteMetadata.notes['beta.md']).toEqual({ updatedAt: 4 });
    expect(harness.getState().openTabs).toEqual([
      { path: 'alpha.md', name: 'alpha', isDirty: false },
    ]);
    expect(harness.getState().noteContentsCache.has('beta.md')).toBe(false);
  });

  it('saves dirty background notes inside a folder before deleting the folder', async () => {
    let deleteContext: any = null;
    hoisted.deleteFolderImpl.mockImplementation(async (_notesPath, _path, context) => {
      deleteContext = context;
      return {
        updatedTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
        updatedStarredEntries: [],
        updatedStarredNotes: [],
        updatedStarredFolders: [],
        nextAction: null,
        updatedMetadata: { version: 2, notes: {} },
        newChildren: [createFile('alpha.md', 'alpha')],
        trashedItem: trashedItem('docs', 'folder'),
      };
    });

    const harness = createSliceHarness({
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [
          createFile('alpha.md', 'alpha'),
          {
            id: 'docs',
            path: 'docs',
            name: 'docs',
            isFolder: true,
            expanded: true,
            children: [createFile('docs/beta.md', 'beta')],
          },
        ],
      },
      currentNote: { path: 'alpha.md', content: '# alpha' },
      openTabs: [
        { path: 'alpha.md', name: 'alpha', isDirty: false },
        { path: 'docs/beta.md', name: 'beta', isDirty: true },
      ],
      noteContentsCache: new Map([
        ['alpha.md', { content: '# alpha', modifiedAt: 1 }],
        ['docs/beta.md', { content: '# unsaved beta', modifiedAt: 2 }],
      ]),
    });

    await harness.getState().deleteFolder('docs');

    expect(hoisted.saveNoteDocument).toHaveBeenCalledWith({
      notesPath: '/notesRoot',
      currentNote: { path: 'docs/beta.md', content: '# unsaved beta' },
      cache: expect.any(Map),
    });
    expect(hoisted.saveNoteDocument.mock.invocationCallOrder[0])
      .toBeLessThan(hoisted.deleteFolderImpl.mock.invocationCallOrder[0]);
    expect(deleteContext.openTabs).toEqual([
      { path: 'alpha.md', name: 'alpha', isDirty: false },
      { path: 'docs/beta.md', name: 'beta', isDirty: false },
    ]);
    expect(deleteContext.noteMetadata.notes['docs/beta.md']).toEqual({ updatedAt: 4 });
    expect(harness.getState().openTabs).toEqual([
      { path: 'alpha.md', name: 'alpha', isDirty: false },
    ]);
    expect(harness.getState().noteContentsCache.has('docs/beta.md')).toBe(false);
  });
});
