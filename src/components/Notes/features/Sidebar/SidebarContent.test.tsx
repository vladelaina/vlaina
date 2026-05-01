import type { ReactNode } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarContent } from './SidebarContent';
import type { NotesSidebarSearchEntry } from './notesSidebarSearchResults';

const hoisted = vi.hoisted(() => ({
  applySidebarSearchNavigation: vi.fn(() => Promise.resolve(false)),
  buildNotesSidebarSearchIndex: vi.fn<() => NotesSidebarSearchEntry[]>(() => []),
  clearSidebarSearchHighlights: vi.fn(),
  clearSidebarSearchNavigationPending: vi.fn(),
  countNotesSidebarSearchEntries: vi.fn(() => 0),
  markSidebarSearchNavigationPending: vi.fn(),
  noteContentsCache: new Map<string, { content: string; modifiedAt: number | null }>(),
  queryNotesSidebarSearch: vi.fn(() => []),
  revealFolder: vi.fn(),
  scheduleSidebarItemIntoView: vi.fn(),
  scanAllNotes: vi.fn(() => Promise.resolve()),
  shouldSearchNotesSidebarContents: vi.fn(() => false),
  shouldShowSearchResults: false,
}));

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector: (state: any) => unknown) => selector({
    openNote: vi.fn(() => Promise.resolve()),
    getDisplayName: vi.fn((path: string) => path),
    noteContentsCache: hoisted.noteContentsCache,
    revealFolder: hoisted.revealFolder,
    scanAllNotes: hoisted.scanAllNotes,
    starredEntries: [],
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
  }: {
    title: string;
    actionLabel?: string;
    onAction?: () => void;
  }) => (
    <div>
      <span>{title}</span>
      {actionLabel ? <button onClick={onAction}>{actionLabel}</button> : null}
    </div>
  ),
}));

vi.mock('./NotesSidebarTopActions', () => ({
  NotesSidebarTopActions: () => null,
}));

vi.mock('./RootFolderRow', () => ({
  RootFolderRow: () => null,
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
    hoisted.noteContentsCache = new Map();
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

  it('shows the hover empty hint when the notes directory has no notes', () => {
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

    expect(getByText('No notes yet')).toBeTruthy();
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

    expect(getByText('No notes yet')).toBeTruthy();
  });

  it('opens the markdown picker from the empty hint action', () => {
    const openHandler = vi.fn();
    window.addEventListener('vlaina-open-markdown-file', openHandler);

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

    fireEvent.click(getByText('Open'));

    expect(openHandler).toHaveBeenCalledTimes(1);
    window.removeEventListener('vlaina-open-markdown-file', openHandler);
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
});
