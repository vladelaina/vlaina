import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentNotesRootPath, useNotesStore } from '@/stores/notes/useNotesStore';
import { useNotesRootStore } from './useNotesRootStore';

const hoisted = vi.hoisted(() => ({
  saveStarredRegistry: vi.fn(),
  moveNotesRootSystemStore: vi.fn(async () => undefined),
  moveWhiteboardNotesRootStore: vi.fn(async () => undefined),
  flushCurrentPendingEditorMarkdown: vi.fn(),
}));

vi.mock('@/stores/notes/starred', async () => {
  const actual = await vi.importActual<typeof import('@/stores/notes/starred')>('@/stores/notes/starred');
  return {
    ...actual,
    saveStarredRegistry: hoisted.saveStarredRegistry,
  };
});

vi.mock('@/stores/notes/systemStoragePaths', () => ({
  moveNotesRootSystemStore: hoisted.moveNotesRootSystemStore,
}));

vi.mock('@/lib/storage/whiteboardStoragePaths', () => ({
  moveWhiteboardNotesRootStore: hoisted.moveWhiteboardNotesRootStore,
}));

vi.mock('@/stores/notes/pendingEditorMarkdownFlusher', () => ({
  flushCurrentPendingEditorMarkdown: hoisted.flushCurrentPendingEditorMarkdown,
}));

describe('useNotesRootStore external sync', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    useNotesRootStore.setState({
      currentNotesRoot: null,
      recentNotesRoots: [],
      isLoading: false,
      hasInitialized: true,
      error: null,
    });

    useNotesStore.setState({
      notesPath: 'C:/notes-root-old',
      starredEntries: [
        {
          id: 'note-1',
          kind: 'note',
          notesRootPath: 'C:/notes-root-old',
          relativePath: 'docs/alpha.md',
          addedAt: 1,
        },
        {
          id: 'folder-1',
          kind: 'folder',
          notesRootPath: 'C:/notes-root-old',
          relativePath: 'docs',
          addedAt: 2,
        },
      ],
      starredNotes: ['docs/alpha.md'],
      starredFolders: ['docs'],
      pendingStarredNavigation: {
        notesRootPath: 'C:/notes-root-old',
        kind: 'note',
        relativePath: 'docs/alpha.md',
      },
      clearAssetUrlCache: vi.fn(),
      currentNote: null,
      openTabs: [],
      noteContentsCache: new Map(),
      isDirty: false,
    });
  });

  it('syncs the opened folder path after an external root rename', () => {
    useNotesRootStore.setState({
      currentNotesRoot: {
        id: 'notes-root-1',
        name: 'notes-root-old',
        path: 'C:\\notes-root-old',
        lastOpened: 10,
      },
      recentNotesRoots: [
        {
          id: 'notes-root-1',
          name: 'notes-root-old',
          path: 'C:\\notes-root-old',
          lastOpened: 10,
        },
      ],
    });

    useNotesRootStore.getState().syncCurrentNotesRootExternalPath('C:\\notes-root-new');

    expect(useNotesRootStore.getState().currentNotesRoot).toMatchObject({
      id: 'notes-root-1',
      name: 'notes-root-new',
      path: 'C:/notes-root-new',
    });
    expect(useNotesRootStore.getState().recentNotesRoots[0]).toMatchObject({
      id: 'notes-root-1',
      name: 'notes-root-new',
      path: 'C:/notes-root-new',
    });
    expect(useNotesStore.getState().notesPath).toBe('C:/notes-root-new');
    expect(useNotesStore.getState().starredEntries).toEqual([
      expect.objectContaining({ notesRootPath: 'C:/notes-root-new', relativePath: 'docs/alpha.md' }),
      expect.objectContaining({ notesRootPath: 'C:/notes-root-new', relativePath: 'docs' }),
    ]);
    expect(useNotesStore.getState().pendingStarredNavigation).toEqual({
      notesRootPath: 'C:/notes-root-new',
      kind: 'note',
      relativePath: 'docs/alpha.md',
    });
    expect(getCurrentNotesRootPath()).toBe('C:/notes-root-new');
    expect(hoisted.saveStarredRegistry).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ notesRootPath: 'C:/notes-root-new', relativePath: 'docs/alpha.md' }),
        expect.objectContaining({ notesRootPath: 'C:/notes-root-new', relativePath: 'docs' }),
      ])
    );
    expect(hoisted.moveNotesRootSystemStore).toHaveBeenCalledWith('C:/notes-root-old', 'C:/notes-root-new');
    expect(hoisted.moveWhiteboardNotesRootStore).toHaveBeenCalledWith('C:/notes-root-old', 'C:/notes-root-new');
    expect(useNotesStore.getState().clearAssetUrlCache).toHaveBeenCalledTimes(1);
  });

  it('flushes pending editor markdown before syncing an externally renamed opened folder path', () => {
    useNotesRootStore.setState({
      currentNotesRoot: {
        id: 'notes-root-1',
        name: 'notes-root-old',
        path: 'C:/notes-root-old',
        lastOpened: 10,
      },
      recentNotesRoots: [
        {
          id: 'notes-root-1',
          name: 'notes-root-old',
          path: 'C:/notes-root-old',
          lastOpened: 10,
        },
      ],
    });
    useNotesStore.setState({
      currentNote: { path: 'docs/alpha.md', content: 'Old alpha' },
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['docs/alpha.md', { content: 'Old alpha', modifiedAt: 1 }]]),
      isDirty: false,
    });
    hoisted.flushCurrentPendingEditorMarkdown.mockImplementation(() => {
      useNotesStore.setState((state) => ({
        currentNote: { path: 'docs/alpha.md', content: 'Pending alpha' },
        currentNoteRevision: state.currentNoteRevision + 1,
        isDirty: true,
        openTabs: state.openTabs.map((tab) =>
          tab.path === 'docs/alpha.md' ? { ...tab, isDirty: true } : tab
        ),
        noteContentsCache: new Map(state.noteContentsCache).set('docs/alpha.md', {
          content: 'Pending alpha',
          modifiedAt: 1,
        }),
      }));
      return true;
    });

    useNotesRootStore.getState().syncCurrentNotesRootExternalPath('C:/notes-root-new');

    expect(hoisted.flushCurrentPendingEditorMarkdown).toHaveBeenCalledTimes(1);
    expect(useNotesStore.getState().notesPath).toBe('C:/notes-root-new');
    expect(useNotesStore.getState().currentNote).toEqual({
      path: 'docs/alpha.md',
      content: 'Pending alpha',
    });
    expect(useNotesStore.getState().noteContentsCache.get('docs/alpha.md')).toEqual({
      content: 'Pending alpha',
      modifiedAt: 1,
    });
    expect(useNotesStore.getState().openTabs).toEqual([
      { path: 'docs/alpha.md', name: 'alpha', isDirty: true },
    ]);
  });

  it('deduplicates mixed-slash recent notesRoot entries during external path sync', () => {
    useNotesRootStore.setState({
      currentNotesRoot: {
        id: 'notes-root-1',
        name: 'notes-root-old',
        path: 'C:\\notes-root-old',
        lastOpened: 10,
      },
      recentNotesRoots: [
        {
          id: 'notes-root-1',
          name: 'notes-root-old',
          path: 'C:\\notes-root-old',
          lastOpened: 10,
        },
        {
          id: 'notes-root-2',
          name: 'notes-root-new',
          path: 'C:/notes-root-new',
          lastOpened: 9,
        },
      ],
    });

    useNotesRootStore.getState().syncCurrentNotesRootExternalPath('C:\\notes-root-new');

    expect(useNotesRootStore.getState().recentNotesRoots).toEqual([
      expect.objectContaining({ id: 'notes-root-1', path: 'C:/notes-root-new' }),
    ]);
  });

  it('reloads recent notesRoot metadata after a cross-window storage update without switching notes-roots', () => {
    useNotesRootStore.setState({
      currentNotesRoot: {
        id: 'notes-root-1',
        name: 'Alpha',
        path: '/notes-roots/alpha',
        lastOpened: 1,
      },
      recentNotesRoots: [
        {
          id: 'notes-root-1',
          name: 'Alpha',
          path: '/notes-roots/alpha',
          lastOpened: 1,
        },
      ],
    });

    const nextRecentNotesRoots = [
      {
        id: 'notes-root-2',
        name: 'Beta',
        path: '/notes-roots/beta',
        lastOpened: 2,
      },
      {
        id: 'notes-root-1',
        name: 'Alpha Renamed',
        path: '/notes-roots/alpha',
        lastOpened: 1,
      },
    ];
    localStorage.setItem('vlaina-notes-roots', JSON.stringify(nextRecentNotesRoots));
    localStorage.setItem('vlaina-current-notes-root', 'notes-root-2');

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vlaina-notes-roots',
      newValue: JSON.stringify(nextRecentNotesRoots),
    }));

    expect(useNotesRootStore.getState().recentNotesRoots).toEqual([
      expect.objectContaining({ id: 'notes-root-2', name: 'Beta' }),
      expect.objectContaining({ id: 'notes-root-1', name: 'Alpha Renamed' }),
    ]);
    expect(useNotesRootStore.getState().currentNotesRoot).toMatchObject({
      id: 'notes-root-1',
      name: 'Alpha Renamed',
      path: '/notes-roots/alpha',
    });
    expect(useNotesStore.getState().notesPath).toBe('C:/notes-root-old');
    expect(typeof useNotesRootStore.getState().openNotesRoot).toBe('function');
  });

  it('ignores oversized cross-window recent notesRoot storage updates', () => {
    useNotesRootStore.setState({
      currentNotesRoot: {
        id: 'notes-root-1',
        name: 'Alpha',
        path: '/notes-roots/alpha',
        lastOpened: 1,
      },
      recentNotesRoots: [
        {
          id: 'notes-root-1',
          name: 'Alpha',
          path: '/notes-roots/alpha',
          lastOpened: 1,
        },
      ],
    });

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vlaina-notes-roots',
      newValue: '['.padEnd(70 * 1024, ' '),
    }));

    expect(useNotesRootStore.getState().recentNotesRoots).toEqual([
      expect.objectContaining({ id: 'notes-root-1', name: 'Alpha' }),
    ]);
    expect(useNotesRootStore.getState().currentNotesRoot).toMatchObject({
      id: 'notes-root-1',
      name: 'Alpha',
      path: '/notes-roots/alpha',
    });
  });
});
