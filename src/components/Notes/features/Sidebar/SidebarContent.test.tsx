import type { KeyboardEventHandler, ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarContent } from './SidebarContent';
import type { NotesSidebarSearchEntry, NotesSidebarSearchResult } from './notesSidebarSearchResults';

const hoisted = vi.hoisted(() => ({
  applySidebarSearchNavigation: vi.fn(() => Promise.resolve(false)),
  buildNotesSidebarSearchIndex: vi.fn<() => NotesSidebarSearchEntry[]>(() => []),
  clearSidebarSearchHighlights: vi.fn(),
  clearSidebarSearchNavigationPending: vi.fn(),
  countNotesSidebarSearchEntries: vi.fn(() => 0),
  draftNotes: {} as Record<string, { name: string; parentPath: string | null }>,
  markSidebarSearchNavigationPending: vi.fn(),
  noteContentsCache: new Map<string, { content: string; modifiedAt: number | null }>(),
  notesPath: '',
  cancelNoteContentScan: vi.fn(),
  pruneNoteContentsCacheToOpenNotes: vi.fn(),
  queryNotesSidebarSearch: vi.fn<() => NotesSidebarSearchResult[]>(() => []),
  queryNotesSidebarStructuralSearch: vi.fn<() => NotesSidebarSearchResult[]>(() => []),
  revealFolder: vi.fn(),
  scheduleSidebarItemIntoView: vi.fn(),
  consumeSuppressedCurrentNoteSidebarReveal: vi.fn(() => false),
  suppressNextCurrentNoteSidebarReveal: vi.fn(),
  scanAllNotes: vi.fn(() => Promise.resolve()),
  shouldSearchNotesSidebarContents: vi.fn(() => false),
  shouldShowSearchResults: false,
  sidebarTags: [] as Array<{
    tag: string;
    count: number;
    paths: Array<{ path: string; query: string; contentMatchOrdinal: number | null }>;
  }>,
  currentVault: null as { path: string; name: string } | null,
  recentVaults: [] as Array<{ id: string; name: string; path: string; lastOpened: number }>,
  uiState: {
    sidebarCollapsed: false,
    notesPreviewTitle: null as { path: string; title: string } | null,
  },
  openNote: vi.fn(() => Promise.resolve()),
  openNoteByAbsolutePath: vi.fn(() => Promise.resolve()),
  openVault: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector: (state: any) => unknown) => selector({
    openNote: hoisted.openNote,
    openNoteByAbsolutePath: hoisted.openNoteByAbsolutePath,
    draftNotes: hoisted.draftNotes,
    getDisplayName: vi.fn((path: string) => path),
    noteContentsCache: hoisted.noteContentsCache,
    notesPath: hoisted.notesPath,
    cancelNoteContentScan: hoisted.cancelNoteContentScan,
    pruneNoteContentsCacheToOpenNotes: hoisted.pruneNoteContentsCacheToOpenNotes,
    revealFolder: hoisted.revealFolder,
    scanAllNotes: hoisted.scanAllNotes,
    starredEntries: [],
  }),
}));

vi.mock('@/stores/useVaultStore', () => ({
  useVaultStore: Object.assign(
    (selector: (state: any) => unknown) => selector({
      currentVault: hoisted.currentVault,
      recentVaults: hoisted.recentVaults,
      openVault: hoisted.openVault,
    }),
    {
      getState: () => ({
        currentVault: hoisted.currentVault,
        recentVaults: hoisted.recentVaults,
        openVault: hoisted.openVault,
      }),
      setState: (partial: { currentVault?: typeof hoisted.currentVault; recentVaults?: typeof hoisted.recentVaults }) => {
        if ('currentVault' in partial) hoisted.currentVault = partial.currentVault ?? null;
        if ('recentVaults' in partial) hoisted.recentVaults = partial.recentVaults ?? [];
      },
    },
  ),
}));

vi.mock('@/stores/uiSlice', () => ({
  useUIStore: (selector: (state: any) => unknown) => selector(hoisted.uiState),
}));

vi.mock('@/hooks/useTitleSync', () => ({
  useDisplayIcon: () => null,
}));

vi.mock('@/components/layout/sidebar/SidebarSearchDrawer', () => ({
  SidebarSearchDrawer: ({
    searchQuery,
    setSearchQuery,
    canSubmit,
    onSubmit,
    canSelectPrevious,
    canSelectNext,
    onSelectPrevious,
    onSelectNext,
  }: {
    searchQuery: string;
    setSearchQuery: (value: string) => void;
    canSubmit: boolean;
    onSubmit: () => void;
    canSelectPrevious?: boolean;
    canSelectNext?: boolean;
    onSelectPrevious?: () => void;
    onSelectNext?: () => void;
  }) => (
    <input
      aria-label="notes-search"
      value={searchQuery}
      onChange={(event) => setSearchQuery(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp' && canSelectPrevious) {
          onSelectPrevious?.();
        }
        if (event.key === 'ArrowDown' && canSelectNext) {
          onSelectNext?.();
        }
        if (event.key === 'Enter' && canSubmit) {
          onSubmit();
        }
      }}
    />
  ),
  useSidebarSearchDrawerState: () => ({
    inputRef: { current: null },
    scrollRootRef: { current: null },
    hideSearch: vi.fn(),
    handleScroll: vi.fn(),
    shouldShowSearchResults: hoisted.shouldShowSearchResults,
  }),
}));

vi.mock('../Starred', () => ({
  StarredSection: () => null,
}));

vi.mock('../common/sidebarHoverRename', () => ({
  triggerHoveredSidebarRename: () => false,
}));

vi.mock('../common/sidebarScrollIntoView', () => ({
  consumeSuppressedCurrentNoteSidebarReveal: hoisted.consumeSuppressedCurrentNoteSidebarReveal,
  scheduleSidebarItemIntoView: hoisted.scheduleSidebarItemIntoView,
  suppressNextCurrentNoteSidebarReveal: hoisted.suppressNextCurrentNoteSidebarReveal,
}));

vi.mock('./useNotesSidebarTags', () => ({
  useNotesSidebarTags: () => ({
    isTagScanPending: false,
    tags: hoisted.sidebarTags,
  }),
}));

vi.mock('./NotesTagsSection', () => ({
  NotesTagsSection: ({
    tags,
    onOpenNote,
  }: {
    tags: Array<{
      tag: string;
      paths: Array<{ path: string; query: string; contentMatchOrdinal: number | null }>;
    }>;
    onOpenNote: (target: { path: string; query: string; contentMatchOrdinal: number | null }) => void;
  }) => (
    <div data-testid="notes-tags-section">
      {tags.map((entry) =>
        entry.paths.map((target) => (
          <button
            key={`${entry.tag}:${target.path}`}
            type="button"
            onClick={() => onOpenNote(target)}
          >
            {entry.tag}:{target.path}
          </button>
        )),
      )}
    </div>
  ),
}));

vi.mock('./NotesSidebarRow', () => ({
  NotesSidebarRow: ({
    children,
    leading,
    main,
    trailing,
    onClick,
    onKeyDown,
    role,
    tabIndex,
  }: {
    children?: ReactNode;
    leading?: ReactNode;
    main?: ReactNode;
    trailing?: ReactNode;
    onClick?: () => void;
    onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
    role?: string;
    tabIndex?: number;
  }) => (
    <div role={role} tabIndex={tabIndex} onClick={onClick} onKeyDown={onKeyDown}>
      {leading}
      {main}
      {trailing}
      {children}
    </div>
  ),
}));

vi.mock('./NotesSidebarPrimitives', () => ({
  NotesSidebarScrollArea: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  NotesSidebarPillEmptyHint: ({ actions }: { actions?: Array<{ label: string; onAction: () => void }> }) => (
    <div data-testid="pill-empty-hint">
      {actions?.map((action) => (
        <button key={action.label} type="button" onClick={action.onAction}>
          {action.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('./NotesSidebarTopActions', () => ({
  NotesSidebarTopActions: () => null,
}));

vi.mock('./RootFolderRow', () => ({
  RootFolderRow: ({ rootFolder }: { rootFolder: { children: Array<{ name: string }> } | null }) => (
    <div data-testid="root-folder-row">
      {rootFolder?.children.map((node) => (
        <div key={node.name}>{node.name}</div>
      ))}
    </div>
  ),
}));

vi.mock('./SidebarSearchResultsList', () => ({
  SidebarSearchResultsList: ({
    results,
    activeResultId,
    highlightedResultId,
    onOpen,
  }: {
    results: Array<{ id: string; name: string }>;
    activeResultId?: string | null;
    highlightedResultId?: string | null;
    onOpen: (result: any) => void;
  }) => (
    <div>
      {results.map((result) => (
        <button
          key={result.id}
          data-active={result.id === activeResultId ? 'true' : 'false'}
          data-highlighted={result.id === highlightedResultId ? 'true' : 'false'}
          onClick={() => onOpen(result)}
        >
          {result.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('./notesSidebarSearchResults', () => ({
  buildNotesSidebarSearchIndex: hoisted.buildNotesSidebarSearchIndex,
  countNotesSidebarSearchEntries: hoisted.countNotesSidebarSearchEntries,
  NOTES_SIDEBAR_MAX_SEARCH_RESULTS: 200,
  queryNotesSidebarSearch: hoisted.queryNotesSidebarSearch,
  queryNotesSidebarStructuralSearch: hoisted.queryNotesSidebarStructuralSearch,
  shouldSearchNotesSidebarContents: hoisted.shouldSearchNotesSidebarContents,
}));

vi.mock('./sidebarSearchNavigation', () => ({
  applySidebarSearchNavigation: hoisted.applySidebarSearchNavigation,
  clearSidebarSearchHighlights: hoisted.clearSidebarSearchHighlights,
  clearSidebarSearchNavigationPending: hoisted.clearSidebarSearchNavigationPending,
  markSidebarSearchNavigationPending: hoisted.markSidebarSearchNavigationPending,
}));

vi.mock('../Editor/utils/editorViewRegistry', () => ({
  getCurrentEditorView: () => null,
}));

const createSearchState = (overrides: Partial<Parameters<typeof SidebarContent>[0]['search']> = {}) => ({
  isSearchOpen: true,
  searchQuery: '1',
  setSearchQuery: vi.fn(),
  openSearch: vi.fn(),
  closeSearch: vi.fn(),
  toggleSearch: vi.fn(),
  ...overrides,
});

const createSearchEntries = (): NotesSidebarSearchEntry[] => [
  { path: 'docs/alpha.md', name: 'alpha', preview: 'docs/' },
  { path: 'docs/beta.md', name: 'beta', preview: 'docs/' },
];

describe('SidebarContent search highlight cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.shouldShowSearchResults = false;
    hoisted.buildNotesSidebarSearchIndex.mockReturnValue([]);
    hoisted.countNotesSidebarSearchEntries.mockReturnValue(0);
    hoisted.draftNotes = {};
    hoisted.noteContentsCache = new Map();
    hoisted.notesPath = '';
    hoisted.currentVault = null;
    hoisted.recentVaults = [];
    hoisted.uiState.sidebarCollapsed = false;
    hoisted.uiState.notesPreviewTitle = null;
    hoisted.openNote.mockClear();
    hoisted.openNote.mockResolvedValue(undefined);
    hoisted.openNoteByAbsolutePath.mockClear();
    hoisted.openNoteByAbsolutePath.mockResolvedValue(undefined);
    hoisted.openVault.mockClear();
    hoisted.openVault.mockResolvedValue(true);
    hoisted.consumeSuppressedCurrentNoteSidebarReveal.mockClear();
    hoisted.consumeSuppressedCurrentNoteSidebarReveal.mockReturnValue(false);
    hoisted.suppressNextCurrentNoteSidebarReveal.mockClear();
    hoisted.sidebarTags = [];
    hoisted.queryNotesSidebarStructuralSearch.mockReset();
    hoisted.queryNotesSidebarStructuralSearch.mockImplementation(() => hoisted.queryNotesSidebarSearch());
    hoisted.cancelNoteContentScan.mockClear();
    hoisted.pruneNoteContentsCacheToOpenNotes.mockClear();
    hoisted.scanAllNotes.mockResolvedValue(undefined);
    hoisted.shouldSearchNotesSidebarContents.mockReturnValue(false);
  });

  it('shows the live preview title for an empty current draft in the sidebar tree', async () => {
    hoisted.draftNotes = {
      'draft:blank': { parentPath: null, name: '' },
    };
    hoisted.uiState.notesPreviewTitle = { path: 'draft:blank', title: 'Live Draft' };

    render(
      <SidebarContent
        rootFolder={{
          id: '',
          name: 'Notes',
          path: '',
          isFolder: true,
          expanded: true,
          children: [],
        }}
        isLoading={false}
        currentNotePath="draft:blank"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    expect(await screen.findByText('Live Draft')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-workspace-panel')).not.toBeInTheDocument();
  });

  it('clears editor highlights when sidebar search is closed', async () => {
    const { rerender } = render(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath="docs/alpha.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState()}
      />,
    );

    expect(hoisted.clearSidebarSearchHighlights).not.toHaveBeenCalled();

    rerender(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath="docs/alpha.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    await waitFor(() => {
      expect(hoisted.clearSidebarSearchHighlights).toHaveBeenCalledTimes(1);
      expect(hoisted.clearSidebarSearchNavigationPending).toHaveBeenCalledTimes(1);
    });
  });

  it('reveals the current file when leaving sidebar search results', () => {
    hoisted.shouldShowSearchResults = true;
    const rootFolder = {
      id: 'root',
      name: 'Notes',
      path: '',
      isFolder: true as const,
      expanded: true,
      children: [{ id: 'docs', name: 'docs', path: 'docs', isFolder: true as const, expanded: false, children: [] }],
    };
    const { rerender } = render(
      <SidebarContent
        rootFolder={rootFolder}
        isLoading={false}
        currentNotePath="docs/alpha.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState()}
      />,
    );

    hoisted.shouldShowSearchResults = false;
    rerender(
      <SidebarContent
        rootFolder={rootFolder}
        isLoading={false}
        currentNotePath="docs/alpha.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    expect(hoisted.revealFolder).toHaveBeenCalledWith('docs/alpha.md');
    expect(hoisted.scheduleSidebarItemIntoView).toHaveBeenCalledWith('docs/alpha.md', 3);
  });

  it('reveals the current file when the file tree first renders', () => {
    const rootFolder = {
      id: 'root',
      name: 'Notes',
      path: '',
      isFolder: true as const,
      expanded: true,
      children: [{ id: 'docs', name: 'docs', path: 'docs', isFolder: true as const, expanded: false, children: [] }],
    };

    render(
      <SidebarContent
        rootFolder={rootFolder}
        isLoading={false}
        currentNotePath="docs/restored.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    expect(hoisted.revealFolder).toHaveBeenCalledWith('docs/restored.md');
    expect(hoisted.scheduleSidebarItemIntoView).toHaveBeenCalledWith('docs/restored.md', 3);
  });

  it('does not reveal the main tree after opening the current note from starred', () => {
    hoisted.consumeSuppressedCurrentNoteSidebarReveal.mockReturnValue(true);
    const rootFolder = {
      id: 'root',
      name: 'Notes',
      path: '',
      isFolder: true as const,
      expanded: true,
      children: [{ id: 'docs', name: 'docs', path: 'docs', isFolder: true as const, expanded: false, children: [] }],
    };

    render(
      <SidebarContent
        rootFolder={rootFolder}
        isLoading={false}
        currentNotePath="docs/starred.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    expect(hoisted.consumeSuppressedCurrentNoteSidebarReveal).toHaveBeenCalledWith('docs/starred.md', null);
    expect(hoisted.revealFolder).not.toHaveBeenCalled();
    expect(hoisted.scheduleSidebarItemIntoView).not.toHaveBeenCalled();
  });

  it('does not reveal the main tree after opening a note from tags', async () => {
    hoisted.sidebarTags = [
      {
        tag: 'topic',
        count: 1,
        paths: [{ path: 'docs/tagged.md', query: '#topic', contentMatchOrdinal: 0 }],
      },
    ];
    const rootFolder = {
      id: 'root',
      name: 'Notes',
      path: '',
      isFolder: true as const,
      expanded: true,
      children: [{ id: 'docs', name: 'docs', path: 'docs', isFolder: true as const, expanded: false, children: [] }],
    };

    const { getByText, rerender } = render(
      <SidebarContent
        rootFolder={rootFolder}
        isLoading={false}
        currentNotePath="docs/current.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );
    hoisted.revealFolder.mockClear();
    hoisted.scheduleSidebarItemIntoView.mockClear();
    hoisted.consumeSuppressedCurrentNoteSidebarReveal.mockClear();

    await Promise.all([
      import('../Editor/utils/editorViewRegistry'),
      import('./sidebarSearchNavigation'),
    ]);

    fireEvent.click(getByText('topic:docs/tagged.md'));

    expect(hoisted.suppressNextCurrentNoteSidebarReveal).toHaveBeenCalledWith('docs/tagged.md');
    await waitFor(() => {
      expect(hoisted.openNote).toHaveBeenCalledWith('docs/tagged.md');
    });

    hoisted.consumeSuppressedCurrentNoteSidebarReveal.mockReturnValue(true);
    rerender(
      <SidebarContent
        rootFolder={rootFolder}
        isLoading={false}
        currentNotePath="docs/tagged.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    expect(hoisted.consumeSuppressedCurrentNoteSidebarReveal).toHaveBeenCalledWith('docs/tagged.md', null);
    expect(hoisted.revealFolder).not.toHaveBeenCalled();
    expect(hoisted.scheduleSidebarItemIntoView).not.toHaveBeenCalled();
  });

  it('shows an empty file tree hint when the vault has no files', () => {
    const { getByTestId } = render(
      <SidebarContent
        rootFolder={{ id: 'root', path: '', name: 'Vault', isFolder: true, expanded: true, children: [] }}
        isLoading={false}
        currentNotePath={null}
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    expect(getByTestId('empty-workspace-panel')).toBeInTheDocument();
  });

  it('shows the open hint when the notes tree has no entries', () => {
    const rootFolder = {
      id: 'root',
      name: 'Notes',
      path: '',
      isFolder: true as const,
      expanded: true,
      children: [],
    };

    const { getByTestId } = render(
      <SidebarContent
        rootFolder={rootFolder}
        isLoading={false}
        currentNotePath={null}
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    expect(getByTestId('empty-workspace-panel')).toBeTruthy();
  });

  it('shows the hover empty hint before a root folder exists', () => {
    const { getByTestId } = render(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath="draft:blank"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    expect(getByTestId('empty-workspace-panel')).toBeTruthy();
  });

  it('renders the empty panel inside the sidebar blank area before a root folder exists', () => {
    const { getByTestId } = render(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath="draft:blank"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    const panel = getByTestId('empty-workspace-panel');

    expect(panel.closest('[data-notes-sidebar-blank-drag-root="true"]')).not.toBeNull();
  });

  it('hides the empty hint when the sidebar is collapsed', () => {
    hoisted.uiState.sidebarCollapsed = true;

    const { queryByTestId } = render(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath="draft:blank"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    expect(queryByTestId('empty-workspace-panel')).toBeNull();
  });

  it('does not show the open hint while a vault root is still loading', () => {
    hoisted.currentVault = { path: '/vault', name: 'Vault' };
    hoisted.notesPath = '/vault';

    const { queryByTestId, getByTestId } = render(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath="docs/alpha.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    expect(queryByTestId('empty-workspace-panel')).toBeNull();
    expect(getByTestId('root-folder-row')).toBeTruthy();
  });

  it('shows the open hint when a remembered vault exists but no notes target is open', () => {
    hoisted.currentVault = { path: '/vault', name: 'Vault' };
    hoisted.notesPath = '';

    const { getByTestId } = render(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath={null}
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    expect(getByTestId('empty-workspace-panel')).toBeTruthy();
  });

  it('does not inject a blank in-memory draft into an empty root folder', () => {
    hoisted.draftNotes = {
      'draft:blank': {
        name: '',
        parentPath: null,
      },
    };
    const rootFolder = {
      id: 'root',
      name: 'Notes',
      path: '',
      isFolder: true as const,
      expanded: true,
      children: [],
    };

    const { getByTestId, queryByText } = render(
      <SidebarContent
        rootFolder={rootFolder}
        isLoading={false}
        currentNotePath="draft:blank"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    expect(queryByText('Untitled')).toBeNull();
    expect(getByTestId('empty-workspace-panel')).toBeTruthy();
  });

  it('shows the current in-memory draft after it has content', () => {
    hoisted.draftNotes = {
      'draft:blank': {
        name: '',
        parentPath: null,
      },
    };
    hoisted.noteContentsCache = new Map([
      ['draft:blank', { content: 'Draft body', modifiedAt: null }],
    ]);
    const rootFolder = {
      id: 'root',
      name: 'Notes',
      path: '',
      isFolder: true as const,
      expanded: true,
      children: [],
    };

    const { getByText } = render(
      <SidebarContent
        rootFolder={rootFolder}
        isLoading={false}
        currentNotePath="draft:blank"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    expect(getByText('Untitled')).toBeTruthy();
  });

  it('opens files and folders from the empty hint actions', () => {
    const openFileHandler = vi.fn();
    const openFolderHandler = vi.fn();
    window.addEventListener('app-open-markdown-target-file', openFileHandler);
    window.addEventListener('app-open-markdown-target-folder', openFolderHandler);

    try {
      const { getByTestId } = render(
        <SidebarContent
          rootFolder={null}
          isLoading={false}
          currentNotePath="draft:blank"
          createNote={vi.fn(async () => undefined)}
          createFolder={vi.fn(async () => null)}
          search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
        />,
      );

      const hint = getByTestId('empty-workspace-panel');
      expect(hint).toBeTruthy();
      fireEvent.click(within(hint).getByRole('button', { name: 'Open File' }));
      fireEvent.click(within(hint).getByRole('button', { name: 'Open Folder' }));

      expect(openFileHandler).toHaveBeenCalledTimes(1);
      expect(openFolderHandler).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('app-open-markdown-target-file', openFileHandler);
      window.removeEventListener('app-open-markdown-target-folder', openFolderHandler);
    }
  });

  it('opens a recent vault from the empty workspace panel', () => {
    hoisted.currentVault = { path: '/vaults/alpha', name: 'Alpha Vault' };
    hoisted.recentVaults = [
      { id: 'vault-alpha', name: 'Alpha Vault', path: '/vaults/alpha', lastOpened: 2 },
      { id: 'vault-beta', name: 'Beta Vault', path: '/vaults/beta', lastOpened: 1 },
    ];

    render(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath={null}
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    expect(screen.queryByText('Alpha Vault')).toBeNull();
    expect(screen.queryByText('/vaults/beta')).toBeNull();
    fireEvent.click(screen.getByText('Beta Vault'));

    expect(hoisted.openVault).toHaveBeenCalledWith('/vaults/beta');
  });

  it('limits recent vaults in the empty workspace panel', () => {
    hoisted.recentVaults = Array.from({ length: 10 }, (_, index) => ({
      id: `vault-${index + 1}`,
      name: `Vault ${index + 1}`,
      path: `/vaults/${index + 1}`,
      lastOpened: 10 - index,
    }));

    render(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath={null}
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />
    );

    expect(screen.getByText('Vault 1')).toBeInTheDocument();
    expect(screen.getByText('Vault 8')).toBeInTheDocument();
    expect(screen.queryByText('Vault 9')).toBeNull();
    expect(screen.queryByText('Vault 10')).toBeNull();
  });

  it('scans note contents when cached entries do not cover the current file tree', () => {
    hoisted.shouldShowSearchResults = true;
    hoisted.shouldSearchNotesSidebarContents.mockReturnValue(true);
    hoisted.scanAllNotes.mockReturnValue(new Promise<void>(() => {}));
    hoisted.countNotesSidebarSearchEntries.mockReturnValue(2);
    hoisted.buildNotesSidebarSearchIndex.mockReturnValue(createSearchEntries());
    hoisted.noteContentsCache = new Map([
      ['other/one.md', { content: 'cached', modifiedAt: 1 }],
      ['other/two.md', { content: 'cached', modifiedAt: 1 }],
    ]);

    render(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath="docs/alpha.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: true, searchQuery: 'alpha' })}
      />,
    );

    expect(hoisted.scanAllNotes).toHaveBeenCalledTimes(1);
  });

  it('does not rescan note contents when every current search entry is cached', () => {
    hoisted.shouldShowSearchResults = true;
    hoisted.shouldSearchNotesSidebarContents.mockReturnValue(true);
    hoisted.countNotesSidebarSearchEntries.mockReturnValue(2);
    hoisted.buildNotesSidebarSearchIndex.mockReturnValue(createSearchEntries());
    hoisted.noteContentsCache = new Map([
      ['docs/alpha.md', { content: 'alpha body', modifiedAt: 1 }],
      ['docs/beta.md', { content: 'beta body', modifiedAt: 1 }],
    ]);

    render(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath="docs/alpha.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: true, searchQuery: 'alpha' })}
      />,
    );

    expect(hoisted.scanAllNotes).not.toHaveBeenCalled();
  });

  it('does not rescan note contents for uncached external starred entries that are not content searchable', () => {
    hoisted.shouldShowSearchResults = true;
    hoisted.shouldSearchNotesSidebarContents.mockReturnValue(true);
    hoisted.buildNotesSidebarSearchIndex.mockReturnValue([
      ...createSearchEntries(),
      {
        path: '/external/starred.md',
        openPath: '/external/starred.md',
        name: 'starred',
        preview: 'external/',
        isExternal: true,
        contentSearchable: false,
      },
    ]);
    hoisted.noteContentsCache = new Map([
      ['docs/alpha.md', { content: 'alpha body', modifiedAt: 1 }],
      ['docs/beta.md', { content: 'beta body', modifiedAt: 1 }],
    ]);

    render(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath="docs/alpha.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: true, searchQuery: 'alpha' })}
      />,
    );

    expect(hoisted.scanAllNotes).not.toHaveBeenCalled();
  });

  it('does not prune hover-prefetched note contents while sidebar search is already closed', () => {
    hoisted.shouldSearchNotesSidebarContents.mockReturnValue(false);
    hoisted.noteContentsCache = new Map([
      ['docs/alpha.md', { content: 'alpha body', modifiedAt: 1 }],
    ]);

    const { rerender } = render(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath="docs/alpha.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    hoisted.pruneNoteContentsCacheToOpenNotes.mockClear();
    hoisted.cancelNoteContentScan.mockClear();
    hoisted.noteContentsCache = new Map([
      ['docs/alpha.md', { content: 'alpha body', modifiedAt: 1 }],
      ['docs/beta.md', { content: 'beta body from hover prefetch', modifiedAt: 2 }],
    ]);

    rerender(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath="docs/alpha.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    expect(hoisted.cancelNoteContentScan).not.toHaveBeenCalled();
    expect(hoisted.pruneNoteContentsCacheToOpenNotes).not.toHaveBeenCalled();
  });

  it('prunes scanned note contents when sidebar search closes', () => {
    hoisted.shouldShowSearchResults = true;
    hoisted.shouldSearchNotesSidebarContents.mockReturnValue(true);
    hoisted.countNotesSidebarSearchEntries.mockReturnValue(2);
    hoisted.buildNotesSidebarSearchIndex.mockReturnValue(createSearchEntries());
    hoisted.noteContentsCache = new Map([
      ['docs/alpha.md', { content: 'alpha body', modifiedAt: 1 }],
      ['docs/beta.md', { content: 'beta body', modifiedAt: 1 }],
    ]);

    const { rerender } = render(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath="docs/alpha.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: true, searchQuery: 'alpha' })}
      />,
    );

    hoisted.pruneNoteContentsCacheToOpenNotes.mockClear();
    rerender(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath="docs/alpha.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    expect(hoisted.pruneNoteContentsCacheToOpenNotes).toHaveBeenCalledTimes(1);
  });

  it('opens external starred search results by absolute path', async () => {
    hoisted.shouldShowSearchResults = true;
    hoisted.queryNotesSidebarSearch.mockReturnValue([
      {
        id: '/external/starred.md::name',
        path: '/external/starred.md',
        openPath: '/external/starred.md',
        name: 'starred',
        preview: 'external/',
        isExternal: true,
        matchIndex: 0,
        matchKind: 'name',
        contentSnippet: null,
        contentMatchOrdinal: null,
      },
    ]);

    const { getByText } = render(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath="docs/alpha.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: true, searchQuery: 'starred' })}
      />,
    );

    fireEvent.click(getByText('starred'));

    await waitFor(() => {
      expect(hoisted.openNoteByAbsolutePath).toHaveBeenCalledWith('/external/starred.md');
    });
    expect(hoisted.openNote).not.toHaveBeenCalled();
    expect(hoisted.markSidebarSearchNavigationPending).toHaveBeenCalledWith('/external/starred.md');
  });

  it('uses arrow key selection when submitting sidebar search results', async () => {
    hoisted.shouldShowSearchResults = true;
    hoisted.queryNotesSidebarSearch.mockReturnValue([
      {
        id: 'docs/alpha.md::name',
        path: 'docs/alpha.md',
        name: 'alpha',
        preview: 'docs/',
        matchIndex: 0,
        matchKind: 'name',
        contentSnippet: null,
        contentMatchOrdinal: null,
      },
      {
        id: 'docs/beta.md::name',
        path: 'docs/beta.md',
        name: 'beta',
        preview: 'docs/',
        matchIndex: 0,
        matchKind: 'name',
        contentSnippet: null,
        contentMatchOrdinal: null,
      },
    ]);

    const { getByLabelText, getByText } = render(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath="docs/alpha.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: true, searchQuery: 'a' })}
      />,
    );

    expect(getByText('alpha')).toHaveAttribute('data-highlighted', 'true');

    const input = getByLabelText('notes-search');
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    await waitFor(() => {
      expect(getByText('beta')).toHaveAttribute('data-highlighted', 'true');
    });

    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(hoisted.openNote).toHaveBeenCalledWith('docs/beta.md');
    });
  });

  it('does not mark sidebar navigation pending when jumping between matches in the current note', async () => {
    hoisted.shouldShowSearchResults = true;
    hoisted.queryNotesSidebarSearch.mockReturnValue([
      {
        id: 'docs/alpha.md::content::1',
        path: 'docs/alpha.md',
        name: 'alpha',
        preview: 'docs/',
        matchIndex: 12,
        matchKind: 'content',
        contentSnippet: 'Second alpha match',
        contentMatchOrdinal: 1,
      },
    ]);

    const { getByText } = render(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath="docs/alpha.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: true, searchQuery: 'alpha' })}
      />,
    );

    fireEvent.click(getByText('alpha'));

    await waitFor(() => {
      expect(hoisted.applySidebarSearchNavigation).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'docs/alpha.md',
          contentMatchOrdinal: 1,
        }),
      );
    });
    expect(hoisted.markSidebarSearchNavigationPending).not.toHaveBeenCalled();
    expect(hoisted.openNote).not.toHaveBeenCalled();
    expect(hoisted.openNoteByAbsolutePath).not.toHaveBeenCalled();
  });

  it('clears active search result selection when the query changes', async () => {
    const reusableResult = {
      id: 'docs/alpha.md::content::0',
      path: 'docs/alpha.md',
      name: 'alpha',
      preview: 'docs/',
      matchIndex: 0,
      matchKind: 'content' as const,
      contentSnippet: 'alpha match',
      contentMatchOrdinal: 0,
    };
    hoisted.shouldShowSearchResults = true;
    hoisted.queryNotesSidebarSearch.mockReturnValue([reusableResult]);

    const { getByText, rerender } = render(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath="docs/alpha.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: true, searchQuery: 'alpha' })}
      />,
    );

    fireEvent.click(getByText('alpha'));
    await waitFor(() => {
      expect(getByText('alpha')).toHaveAttribute('data-active', 'true');
    });

    rerender(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath="docs/alpha.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: true, searchQuery: 'beta' })}
      />,
    );

    await waitFor(() => {
      expect(getByText('alpha')).toHaveAttribute('data-active', 'false');
    });
  });
});
