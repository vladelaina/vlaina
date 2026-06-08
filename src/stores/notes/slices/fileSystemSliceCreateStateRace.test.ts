import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  createNoteImpl: vi.fn(),
  resolveUniquePath: vi.fn(),
  storageAdapter: {
    mkdir: vi.fn(),
  },
  persistWorkspaceSnapshot: vi.fn(),
  flushCurrentPendingEditorMarkdown: vi.fn(),
}));

vi.mock('../utils/fs/crudOperations', () => ({
  createNoteImpl: hoisted.createNoteImpl,
}));

vi.mock('../utils/fs/pathOperations', () => ({
  resolveUniquePath: hoisted.resolveUniquePath,
}));

vi.mock('@/lib/storage/adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/storage/adapter')>();
  return {
    ...actual,
    getStorageAdapter: () => hoisted.storageAdapter,
  };
});

vi.mock('../workspacePersistence', () => ({
  persistWorkspaceSnapshot: hoisted.persistWorkspaceSnapshot,
}));

vi.mock('../pendingEditorMarkdownFlusher', () => ({
  flushCurrentPendingEditorMarkdown: hoisted.flushCurrentPendingEditorMarkdown,
}));

import { createFileSystemSlice } from './fileSystemSlice';

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
    notesPath: '/vault',
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
    isDirty: false,
    error: null,
    recentNotes: [],
    openTabs: [],
    noteContentsCache: new Map(),
    draftNotes: {},
    noteMetadata: { version: 2, notes: {} },
    displayNames: new Map(),
    saveNote: vi.fn(),
    fileTreeSortMode: 'name-asc',
    ...overrides,
  };

  return {
    getState: () => state,
  };
}

describe('fileSystemSlice create state races', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.flushCurrentPendingEditorMarkdown.mockReturnValue(false);
    hoisted.storageAdapter.mkdir.mockResolvedValue(undefined);
  });

  it('preserves latest recent notes while note creation is in flight', async () => {
    let resolveCreate: (value: Record<string, unknown>) => void;
    hoisted.createNoteImpl.mockImplementation(() => new Promise((resolve) => {
      resolveCreate = resolve;
    }));
    const harness = createSliceHarness({
      recentNotes: ['old.md'],
    });

    const creation = harness.getState().createNote();
    await new Promise((resolve) => setTimeout(resolve, 0));

    harness.getState().recentNotes = ['beta.md', 'old.md'];

    resolveCreate!({
      relativePath: 'Untitled.md',
      fileName: 'Untitled.md',
      content: '',
      modifiedAt: 1,
      size: 0,
      updatedMetadata: {
        version: 2,
        notes: {
          'Untitled.md': { createdAt: 1, updatedAt: 1 },
        },
      },
      updatedRecent: ['Untitled.md', 'old.md'],
      newChildren: [],
    });
    await creation;

    expect(harness.getState().recentNotes).toEqual(['Untitled.md', 'beta.md', 'old.md']);
  });

  it('uses the latest tree sort mode when folder creation is in flight', async () => {
    let resolveMkdir: () => void;
    hoisted.resolveUniquePath.mockResolvedValue({
      relativePath: 'alpha',
      fullPath: '/vault/alpha',
      fileName: 'alpha',
    });
    hoisted.storageAdapter.mkdir.mockImplementation(() => new Promise<void>((resolve) => {
      resolveMkdir = resolve;
    }));
    const harness = createSliceHarness({
      fileTreeSortMode: 'name-desc',
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [{
          id: 'beta',
          name: 'beta',
          path: 'beta',
          isFolder: true,
          expanded: false,
          children: [],
        }],
      },
    });

    const creation = harness.getState().createFolder('', 'alpha');
    await new Promise((resolve) => setTimeout(resolve, 0));

    harness.getState().fileTreeSortMode = 'name-asc';

    resolveMkdir!();
    await creation;

    expect(harness.getState().rootFolder.children.map((node: { path: string }) => node.path)).toEqual([
      'alpha',
      'beta',
    ]);
    expect(hoisted.persistWorkspaceSnapshot).toHaveBeenCalledWith('/vault', expect.objectContaining({
      fileTreeSortMode: 'name-asc',
    }));
  });
});
