import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStarredSectionEntries } from './useStarredSectionEntries';
import { registerCurrentTitleCommitter } from '../Editor/utils/titleCommitRegistry';

type MockFileNode = {
  id: string;
  name: string;
  path: string;
  isFolder: false;
};

type MockFolderNode = {
  id: string;
  name: string;
  path: string;
  isFolder: true;
  children: Array<MockFileNode | MockFolderNode>;
  expanded: boolean;
};

type MockNotesState = {
  starredEntries: Array<{
    id: string;
    kind: 'note' | 'folder';
    notesRootPath: string;
    relativePath: string;
    addedAt: number;
  }>;
  starredLoaded: boolean;
  currentNote: { path: string; content: string } | null;
  isDirty: boolean;
  rootFolder: {
    id: string;
    name: string;
    path: string;
    isFolder: true;
    children: Array<MockFileNode | MockFolderNode>;
    expanded: boolean;
  } | null;
  rootFolderPath: string | null;
  openNote: ReturnType<typeof vi.fn>;
  openNoteByAbsolutePath: ReturnType<typeof vi.fn>;
  toggleFolder: ReturnType<typeof vi.fn>;
  revealFolder: ReturnType<typeof vi.fn>;
  removeStarredEntry: ReturnType<typeof vi.fn>;
  setPendingStarredNavigation: ReturnType<typeof vi.fn>;
};

const mocked = vi.hoisted(() => {
  const notesState: MockNotesState = {
    starredEntries: [],
    starredLoaded: true,
    currentNote: null,
    isDirty: false,
    rootFolder: null,
    rootFolderPath: null,
    openNote: vi.fn(async () => undefined),
    openNoteByAbsolutePath: vi.fn(async () => undefined),
    toggleFolder: vi.fn(),
    revealFolder: vi.fn(),
    removeStarredEntry: vi.fn(),
    setPendingStarredNavigation: vi.fn(),
  };

  const notesRootState = {
    currentNotesRoot: { path: '/notes-root-a' } as { path: string } | null,
    recentNotesRoots: [
      { path: '/notes-root-a', name: 'NotesRoot A' },
      { path: '/notes-root-b', name: 'NotesRoot B' },
    ],
    openNotesRoot: vi.fn(async () => true),
  };

  return {
    notesState,
    notesRootState,
    suppressNextCurrentNoteSidebarReveal: vi.fn(),
  };
});

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: Object.assign(
    (selector?: (state: MockNotesState) => unknown) =>
      selector ? selector(mocked.notesState) : mocked.notesState,
    { getState: () => mocked.notesState },
  ),
}));

vi.mock('@/stores/useNotesRootStore', () => ({
  useNotesRootStore: (selector?: (state: typeof mocked.notesRootState) => unknown) =>
    selector ? selector(mocked.notesRootState) : mocked.notesRootState,
}));

vi.mock('../common/sidebarScrollIntoView', () => ({
  suppressNextCurrentNoteSidebarReveal: mocked.suppressNextCurrentNoteSidebarReveal,
}));

describe('useStarredSectionEntries', () => {
  afterEach(() => {
    registerCurrentTitleCommitter(() => undefined)();
  });

  beforeEach(() => {
    mocked.notesState.starredEntries = [];
    mocked.notesState.starredLoaded = true;
    mocked.notesState.currentNote = null;
    mocked.notesState.isDirty = false;
    mocked.notesState.rootFolder = null;
    mocked.notesState.rootFolderPath = null;
    mocked.notesState.openNote.mockReset();
    mocked.notesState.openNote.mockResolvedValue(undefined);
    mocked.notesState.openNoteByAbsolutePath.mockReset();
    mocked.notesState.openNoteByAbsolutePath.mockResolvedValue(undefined);
    mocked.notesState.toggleFolder.mockReset();
    mocked.notesState.revealFolder.mockReset();
    mocked.notesState.removeStarredEntry.mockReset();
    mocked.notesState.setPendingStarredNavigation.mockReset();
    mocked.suppressNextCurrentNoteSidebarReveal.mockReset();
    mocked.notesRootState.currentNotesRoot = { path: '/notes-root-a' };
    mocked.notesRootState.recentNotesRoots = [
      { path: '/notes-root-a', name: 'NotesRoot A' },
      { path: '/notes-root-b', name: 'NotesRoot B' },
    ];
    mocked.notesRootState.openNotesRoot.mockReset();
    mocked.notesRootState.openNotesRoot.mockResolvedValue(true);
  });

  it('opens a current-notesRoot note without setting pending starred navigation', async () => {
    mocked.notesState.starredEntries = [
      {
        id: 'note-1',
        kind: 'note',
        notesRootPath: '/notes-root-a',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
    ];

    const { result } = renderHook(() => useStarredSectionEntries());

    await act(async () => {
      await result.current.entries[0]?.onOpen(true);
    });

    expect(mocked.notesState.openNote).toHaveBeenCalledWith('docs/alpha.md', true);
    expect(mocked.notesState.setPendingStarredNavigation).not.toHaveBeenCalled();
    expect(mocked.notesRootState.openNotesRoot).not.toHaveBeenCalled();
  });

  it('does not open a current-notesRoot starred folder', async () => {
    mocked.notesState.starredEntries = [
      {
        id: 'folder-1',
        kind: 'folder',
        notesRootPath: '/notes-root-a',
        relativePath: 'docs',
        addedAt: 1,
      },
    ];
    mocked.notesState.rootFolder = {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: [
        {
          id: 'docs',
          name: 'docs',
          path: 'docs',
          isFolder: true,
          expanded: false,
          children: [],
        },
      ],
    };
    mocked.notesState.rootFolderPath = '/notes-root-a';

    const { result } = renderHook(() => useStarredSectionEntries());

    await act(async () => {
      await result.current.entries[0]?.onOpen();
    });

    expect(mocked.notesState.toggleFolder).not.toHaveBeenCalled();
    expect(mocked.notesState.revealFolder).not.toHaveBeenCalled();
    expect(mocked.notesState.setPendingStarredNavigation).not.toHaveBeenCalled();
    expect(mocked.notesState.openNote).not.toHaveBeenCalled();
  });

  it('opens a cross-notesRoot starred note without switching to the target notesRoot', async () => {
    mocked.notesState.starredEntries = [
      {
        id: 'note-2',
        kind: 'note',
        notesRootPath: '/notes-root-b',
        relativePath: 'docs/beta.md',
        addedAt: 1,
      },
    ];

    const { result } = renderHook(() => useStarredSectionEntries());

    await act(async () => {
      await result.current.entries[0]?.onOpen();
    });

    expect(mocked.notesState.openNoteByAbsolutePath).toHaveBeenCalledWith(
      '/notes-root-b/docs/beta.md',
      false,
    );
    expect(mocked.notesState.setPendingStarredNavigation).not.toHaveBeenCalled();
    expect(mocked.notesRootState.openNotesRoot).not.toHaveBeenCalled();
    expect(mocked.notesState.openNote).not.toHaveBeenCalled();
  });

  it('does not resolve current-notesRoot tree nodes from a preserved previous-notesRoot tree', () => {
    mocked.notesState.starredEntries = [
      {
        id: 'note-1',
        kind: 'note',
        notesRootPath: '/notes-root-a',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
    ];
    mocked.notesState.rootFolderPath = '/notes-root-old';
    mocked.notesState.rootFolder = {
      id: '',
      name: 'Old notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: [
        {
          id: 'docs/alpha.md',
          name: 'alpha',
          path: 'docs/alpha.md',
          isFolder: false,
        },
      ],
    };

    const { result } = renderHook(() => useStarredSectionEntries());

    expect(result.current.entries[0]?.treeNode).toBeNull();
  });

  it('marks an opened cross-notesRoot starred note as active', () => {
    mocked.notesState.currentNote = { path: '/notes-root-b/docs/beta.md', content: '# beta' };
    mocked.notesState.starredEntries = [
      {
        id: 'note-2',
        kind: 'note',
        notesRootPath: '/notes-root-b',
        relativePath: 'docs/beta.md',
        addedAt: 1,
      },
    ];

    const { result } = renderHook(() => useStarredSectionEntries());

    expect(result.current.entries[0]?.isActive).toBe(true);
  });

  it('lets the workspace decide how to handle a dirty current note', async () => {
    mocked.notesState.currentNote = { path: 'docs/alpha.md', content: 'dirty text' };
    mocked.notesState.isDirty = true;
    mocked.notesState.starredEntries = [
      {
        id: 'note-3',
        kind: 'note',
        notesRootPath: '/notes-root-b',
        relativePath: 'docs/gamma.md',
        addedAt: 1,
      },
    ];

    const { result } = renderHook(() => useStarredSectionEntries());

    await act(async () => {
      await result.current.entries[0]?.onOpen();
    });

    expect(mocked.notesState.openNoteByAbsolutePath).toHaveBeenCalledWith(
      '/notes-root-b/docs/gamma.md',
      false,
    );
  });

  it('flushes pending title rename before opening the latest starred path', async () => {
    mocked.notesState.starredEntries = [
      {
        id: 'note-4',
        kind: 'note',
        notesRootPath: '/notes-root-a',
        relativePath: 'docs/old.md',
        addedAt: 1,
      },
    ];
    registerCurrentTitleCommitter(async () => {
      mocked.notesState.starredEntries = [
        {
          id: 'note-4',
          kind: 'note',
          notesRootPath: '/notes-root-a',
          relativePath: 'docs/new.md',
          addedAt: 1,
        },
      ];
    });

    const { result } = renderHook(() => useStarredSectionEntries());

    await act(async () => {
      await result.current.entries[0]?.onOpen();
    });

    expect(mocked.notesState.openNote).toHaveBeenCalledWith('docs/new.md', false);
    expect(mocked.suppressNextCurrentNoteSidebarReveal).toHaveBeenCalledWith('docs/new.md');
    expect(mocked.notesState.openNote).not.toHaveBeenCalledWith('docs/old.md', false);
  });

  it('isolates rejected starred note opens', async () => {
    mocked.notesState.openNote.mockRejectedValueOnce(new Error('open failed'));
    mocked.notesState.starredEntries = [
      {
        id: 'note-5',
        kind: 'note',
        notesRootPath: '/notes-root-a',
        relativePath: 'docs/broken.md',
        addedAt: 1,
      },
    ];

    const { result } = renderHook(() => useStarredSectionEntries());

    await act(async () => {
      result.current.entries[0]?.onOpen();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocked.notesState.openNote).toHaveBeenCalledWith('docs/broken.md', false);
  });

  it('does not open a cross-notesRoot starred folder', async () => {
    mocked.notesState.starredEntries = [
      {
        id: 'folder-2',
        kind: 'folder',
        notesRootPath: '/notes-root-b',
        relativePath: 'archive',
        addedAt: 1,
      },
    ];
    mocked.notesRootState.openNotesRoot.mockResolvedValue(false);

    const { result } = renderHook(() => useStarredSectionEntries());

    await act(async () => {
      await result.current.entries[0]?.onOpen();
    });

    expect(mocked.notesState.setPendingStarredNavigation).not.toHaveBeenCalled();
    expect(mocked.notesRootState.openNotesRoot).not.toHaveBeenCalled();
  });
});
