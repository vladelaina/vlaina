import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  createNoteImpl: vi.fn(),
  resolveUniquePath: vi.fn(),
  storageAdapter: {
    mkdir: vi.fn(),
    copyFile: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
  },
  persistWorkspaceSnapshot: vi.fn(),
  flushCurrentPendingEditorMarkdown: vi.fn(),
}));

vi.mock('../utils/fs/crudOperations', () => ({
  createNoteImpl: hoisted.createNoteImpl,
}));

vi.mock('../utils/fs/pathOperations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/fs/pathOperations')>();
  return {
    ...actual,
    resolveUniquePath: hoisted.resolveUniquePath,
  };
});

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
    hoisted.storageAdapter.copyFile.mockResolvedValue(undefined);
    hoisted.storageAdapter.stat.mockResolvedValue({
      name: 'alpha 1.md',
      path: '/vault/docs/alpha 1.md',
      isDirectory: false,
      isFile: true,
      size: 12,
      createdAt: 1,
      modifiedAt: 2,
    });
    hoisted.storageAdapter.readFile.mockResolvedValue('# Alpha copy');
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

  it('adds created notes to the normalized result parent path', async () => {
    hoisted.createNoteImpl.mockResolvedValue({
      relativePath: 'archive/Untitled.md',
      fileName: 'Untitled.md',
      content: '',
      modifiedAt: 1,
      size: 0,
      updatedMetadata: {
        version: 2,
        notes: {
          'archive/Untitled.md': { createdAt: 1, updatedAt: 1 },
        },
      },
      newChildren: [],
    });
    const harness = createSliceHarness({
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [{
          id: 'archive',
          name: 'archive',
          path: 'archive',
          isFolder: true,
          expanded: false,
          children: [],
        }],
      },
    });

    await harness.getState().createNote('archive/.');

    expect(harness.getState().rootFolder.children).toEqual([
      expect.objectContaining({
        path: 'archive',
        children: [
          expect.objectContaining({
            path: 'archive/Untitled.md',
            name: 'Untitled',
          }),
        ],
        expanded: true,
      }),
    ]);
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

  it('duplicates a note to a unique sibling path and opens the copied markdown', async () => {
    hoisted.resolveUniquePath.mockResolvedValue({
      relativePath: 'docs/alpha 1.md',
      fullPath: '/vault/docs/alpha 1.md',
      fileName: 'alpha 1.md',
    });
    const harness = createSliceHarness({
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [{
          id: 'docs',
          name: 'docs',
          path: 'docs',
          isFolder: true,
          expanded: true,
          children: [{
            id: 'docs/alpha.md',
            name: 'alpha',
            path: 'docs/alpha.md',
            isFolder: false,
          }],
        }],
      },
      currentNote: { path: 'docs/alpha.md', content: '# Alpha edited' },
      currentNoteRevision: 3,
      isDirty: true,
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: true }],
      saveNote: vi.fn(async () => {
        harness.getState().isDirty = false;
        harness.getState().openTabs = [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }];
      }),
    });

    const duplicatePath = await harness.getState().duplicateNote('docs/alpha.md');
    const state = harness.getState();

    expect(duplicatePath).toBe('docs/alpha 1.md');
    expect(harness.getState().saveNote).toHaveBeenCalledTimes(1);
    expect(hoisted.resolveUniquePath).toHaveBeenCalledWith('/vault', 'docs', 'alpha.md', false);
    expect(hoisted.storageAdapter.copyFile).toHaveBeenCalledWith(
      '/vault/docs/alpha.md',
      '/vault/docs/alpha 1.md',
    );
    expect(hoisted.storageAdapter.readFile).toHaveBeenCalledWith('/vault/docs/alpha 1.md', 10 * 1024 * 1024);
    expect(state.currentNote).toEqual({ path: 'docs/alpha 1.md', content: '# Alpha copy' });
    expect(state.currentNoteRevision).toBe(4);
    expect(state.isDirty).toBe(false);
    expect(state.openTabs).toEqual([{ path: 'docs/alpha 1.md', name: 'alpha 1', isDirty: false }]);
    expect(state.recentNotes).toEqual(['docs/alpha 1.md']);
    expect(state.rootFolder.children[0].children).toEqual([
      expect.objectContaining({ path: 'docs/alpha.md', name: 'alpha' }),
      expect.objectContaining({ path: 'docs/alpha 1.md', name: 'alpha 1' }),
    ]);
    expect(state.noteContentsCache.get('docs/alpha 1.md')).toEqual({
      content: '# Alpha copy',
      modifiedAt: 2,
    });
    expect(state.noteMetadata.notes['docs/alpha 1.md']).toMatchObject({
      createdAt: 1,
      updatedAt: 2,
    });
    expect(hoisted.persistWorkspaceSnapshot).toHaveBeenCalledWith('/vault', expect.objectContaining({
      currentNotePath: 'docs/alpha 1.md',
    }));
  });

  it('keeps a dirty draft tab when duplicating a saved note', async () => {
    hoisted.resolveUniquePath.mockResolvedValue({
      relativePath: 'alpha 1.md',
      fullPath: '/vault/alpha 1.md',
      fileName: 'alpha 1.md',
    });
    const harness = createSliceHarness({
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [{
          id: 'alpha.md',
          name: 'alpha',
          path: 'alpha.md',
          isFolder: false,
        }],
      },
      currentNote: { path: 'draft:current', content: '# Draft' },
      isDirty: true,
      openTabs: [{ path: 'draft:current', name: '', isDirty: true }],
      draftNotes: {
        'draft:current': { parentPath: null, name: '' },
      },
      saveNote: vi.fn(),
    });

    await harness.getState().duplicateNote('alpha.md');
    const state = harness.getState();

    expect(state.saveNote).not.toHaveBeenCalled();
    expect(state.openTabs).toEqual([
      { path: 'draft:current', name: '', isDirty: true },
      { path: 'alpha 1.md', name: 'alpha 1', isDirty: false },
    ]);
    expect(state.draftNotes).toEqual({
      'draft:current': { parentPath: null, name: '' },
    });
  });

  it('keeps the copied note in the tree when opening the duplicate is blocked by size limits', async () => {
    hoisted.resolveUniquePath.mockResolvedValue({
      relativePath: 'huge 1.md',
      fullPath: '/vault/huge 1.md',
      fileName: 'huge 1.md',
    });
    hoisted.storageAdapter.stat.mockResolvedValue({
      name: 'huge 1.md',
      path: '/vault/huge 1.md',
      isDirectory: false,
      isFile: true,
      size: 11 * 1024 * 1024,
      createdAt: 8,
      modifiedAt: 9,
    });
    const harness = createSliceHarness({
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [{
          id: 'huge.md',
          name: 'huge',
          path: 'huge.md',
          isFolder: false,
        }],
      },
      currentNote: { path: 'current.md', content: '# Current' },
      currentNoteRevision: 2,
      openTabs: [{ path: 'current.md', name: 'current', isDirty: false }],
      noteMetadata: {
        version: 2,
        notes: {
          'huge.md': { icon: 'misc.star' },
        },
      },
    });

    await expect(harness.getState().duplicateNote('huge.md')).resolves.toBe('huge 1.md');
    const state = harness.getState();

    expect(hoisted.storageAdapter.copyFile).toHaveBeenCalledWith('/vault/huge.md', '/vault/huge 1.md');
    expect(hoisted.storageAdapter.readFile).not.toHaveBeenCalled();
    expect(state.currentNote).toEqual({ path: 'current.md', content: '# Current' });
    expect(state.openTabs).toEqual([{ path: 'current.md', name: 'current', isDirty: false }]);
    expect(state.rootFolder.children).toEqual([
      expect.objectContaining({ path: 'huge.md', name: 'huge' }),
      expect.objectContaining({ path: 'huge 1.md', name: 'huge 1' }),
    ]);
    expect(state.recentNotes).toEqual(['huge 1.md']);
    expect(state.noteMetadata.notes['huge 1.md']).toMatchObject({
      icon: 'misc.star',
      createdAt: 8,
      updatedAt: 9,
    });
    expect(state.error).toBe('Note file is too large to open.');
  });

  it('rejects internal source paths before copying a note', async () => {
    const harness = createSliceHarness();

    await expect(harness.getState().duplicateNote('.git/config.md'))
      .rejects.toThrow('Path must not be inside an internal notes folder.');

    expect(hoisted.resolveUniquePath).not.toHaveBeenCalled();
    expect(hoisted.storageAdapter.copyFile).not.toHaveBeenCalled();
    expect(harness.getState().error).toBe('Path must not be inside an internal notes folder.');
  });
});
