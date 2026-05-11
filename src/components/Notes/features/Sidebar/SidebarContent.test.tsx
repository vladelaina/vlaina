import type { ReactNode } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
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
  pruneNoteContentsCacheToOpenNotes: vi.fn(),
  queryNotesSidebarSearch: vi.fn<() => NotesSidebarSearchResult[]>(() => []),
  revealFolder: vi.fn(),
  scheduleSidebarItemIntoView: vi.fn(),
  scanAllNotes: vi.fn(() => Promise.resolve()),
  shouldSearchNotesSidebarContents: vi.fn(() => false),
  shouldShowSearchResults: false,
  currentVault: null as { path: string; name: string } | null,
  openNote: vi.fn(() => Promise.resolve()),
  openNoteByAbsolutePath: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector: (state: any) => unknown) => selector({
    openNote: hoisted.openNote,
    openNoteByAbsolutePath: hoisted.openNoteByAbsolutePath,
    draftNotes: hoisted.draftNotes,
    getDisplayName: vi.fn((path: string) => path),
    noteContentsCache: hoisted.noteContentsCache,
    notesPath: hoisted.notesPath,
    pruneNoteContentsCacheToOpenNotes: hoisted.pruneNoteContentsCacheToOpenNotes,
    revealFolder: hoisted.revealFolder,
    scanAllNotes: hoisted.scanAllNotes,
    starredEntries: [],
  }),
}));

vi.mock('@/stores/useVaultStore', () => ({
  useVaultStore: (selector: (state: any) => unknown) => selector({
    currentVault: hoisted.currentVault,
  }),
}));

vi.mock('@/hooks/useTitleSync', () => ({
  useDisplayIcon: () => null,
}));

vi.mock('@/components/layout/sidebar/SidebarSearchDrawer', () => ({
  SidebarSearchDrawer: () => null,
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
  scheduleSidebarItemIntoView: hoisted.scheduleSidebarItemIntoView,
}));

vi.mock('./NotesSidebarRow', () => ({
  NotesSidebarRow: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('./NotesSidebarPrimitives', () => ({
  NotesSidebarScrollArea: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  NotesSidebarHoverEmptyHint: ({
    title,
    actionLabel,
    onAction,
    actions,
  }: {
    title: string;
    actionLabel?: string;
    onAction?: () => void;
    actions?: Array<{ label: string; onAction: () => void }>;
  }) => (
    <div>
      <span>{title}</span>
      {actionLabel ? <button onClick={onAction}>{actionLabel}</button> : null}
      {actions?.map((action) => (
        <button key={action.label} onClick={action.onAction}>{action.label}</button>
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
    onOpen,
  }: {
    results: Array<{ id: string; name: string }>;
    activeResultId?: string | null;
    onOpen: (result: any) => void;
  }) => (
    <div>
      {results.map((result) => (
        <button
          key={result.id}
          data-active={result.id === activeResultId ? 'true' : 'false'}
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
  queryNotesSidebarSearch: hoisted.queryNotesSidebarSearch,
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
    hoisted.openNote.mockClear();
    hoisted.openNote.mockResolvedValue(undefined);
    hoisted.openNoteByAbsolutePath.mockClear();
    hoisted.openNoteByAbsolutePath.mockResolvedValue(undefined);
    hoisted.pruneNoteContentsCacheToOpenNotes.mockClear();
    hoisted.scanAllNotes.mockResolvedValue(undefined);
    hoisted.shouldSearchNotesSidebarContents.mockReturnValue(false);
  });

  it('clears editor highlights when sidebar search is closed', () => {
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

    expect(hoisted.clearSidebarSearchHighlights).toHaveBeenCalledTimes(1);
    expect(hoisted.clearSidebarSearchNavigationPending).toHaveBeenCalledTimes(1);
  });

  it('reveals the current file when leaving sidebar search results', () => {
    hoisted.shouldShowSearchResults = true;
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

    hoisted.shouldShowSearchResults = false;
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

    expect(hoisted.revealFolder).toHaveBeenCalledWith('docs/alpha.md');
    expect(hoisted.scheduleSidebarItemIntoView).toHaveBeenCalledWith('docs/alpha.md', 2);
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

    const { getByText } = render(
      <SidebarContent
        rootFolder={rootFolder}
        isLoading={false}
        currentNotePath={null}
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    expect(getByText('File')).toBeTruthy();
    expect(getByText('New Folder')).toBeTruthy();
  });

  it('shows the hover empty hint before a root folder exists', () => {
    const { getByText } = render(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath="draft:blank"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    expect(getByText('File')).toBeTruthy();
    expect(getByText('New Folder')).toBeTruthy();
  });

  it('does not show the open hint while a vault root is still loading', () => {
    hoisted.currentVault = { path: '/vault', name: 'Vault' };
    hoisted.notesPath = '/vault';

    const { queryByText, getByTestId } = render(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath="docs/alpha.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    expect(queryByText('File')).toBeNull();
    expect(queryByText('New Folder')).toBeNull();
    expect(getByTestId('root-folder-row')).toBeTruthy();
  });

  it('shows the open hint when a remembered vault exists but no notes target is open', () => {
    hoisted.currentVault = { path: '/vault', name: 'Vault' };
    hoisted.notesPath = '';

    const { getByText } = render(
      <SidebarContent
        rootFolder={null}
        isLoading={false}
        currentNotePath={null}
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
        search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
      />,
    );

    expect(getByText('File')).toBeTruthy();
    expect(getByText('New Folder')).toBeTruthy();
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

    const { getByText, queryByText } = render(
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
    expect(getByText('File')).toBeTruthy();
    expect(getByText('New Folder')).toBeTruthy();
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
    window.addEventListener('vlaina-open-markdown-target-file', openFileHandler);
    window.addEventListener('vlaina-open-markdown-target-folder', openFolderHandler);

    try {
      const { getByText } = render(
        <SidebarContent
          rootFolder={null}
          isLoading={false}
          currentNotePath="draft:blank"
          createNote={vi.fn(async () => undefined)}
          createFolder={vi.fn(async () => null)}
          search={createSearchState({ isSearchOpen: false, searchQuery: '' })}
        />,
      );

      expect(getByText('File')).toBeTruthy();
      expect(getByText('New Folder')).toBeTruthy();
      fireEvent.click(getByText('File'));
      fireEvent.click(getByText('New Folder'));

      expect(openFileHandler).toHaveBeenCalledTimes(1);
      expect(openFolderHandler).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('vlaina-open-markdown-target-file', openFileHandler);
      window.removeEventListener('vlaina-open-markdown-target-folder', openFolderHandler);
    }
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

  it('opens external starred search results by absolute path', () => {
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

    expect(hoisted.openNoteByAbsolutePath).toHaveBeenCalledWith('/external/starred.md');
    expect(hoisted.openNote).not.toHaveBeenCalled();
    expect(hoisted.markSidebarSearchNavigationPending).toHaveBeenCalledWith('/external/starred.md');
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
