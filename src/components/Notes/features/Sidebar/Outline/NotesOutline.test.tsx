import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotesOutline } from './NotesOutline';

const hoisted = vi.hoisted(() => ({
  outlineState: {
    headings: [
      { id: 'parent', level: 1, text: 'Parent', from: 0, to: 6 },
      { id: 'child', level: 2, text: 'Child', from: 7, to: 12 },
    ],
    activeId: null as string | null,
  },
  notesState: {
    starredEntries: [] as unknown[],
    starredLoaded: true,
  },
  uiState: {
    sidebarCollapsed: false,
  },
  notesRootState: {
    currentNotesRoot: null as { path: string; name: string } | null,
    recentNotesRoots: [] as Array<{ id: string; name: string; path: string; lastOpened: number }>,
  },
  jumpToHeading: vi.fn(),
  renameHeading: vi.fn(() => true),
  setNotesSidebarView: vi.fn(),
  openNotesRoot: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { count: number; enabled?: boolean }) => ({
    getTotalSize: () => options.count * 38,
    getVirtualItems: () =>
      Array.from(
        { length: options.enabled ? Math.min(options.count, 24) : options.count },
        (_, index) => ({
          index,
          size: 38,
          start: index * 38,
        }),
      ),
    measure: () => {},
    measureElement: () => {},
  }),
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector: (state: typeof hoisted.notesState) => unknown) => selector(hoisted.notesState),
}));

vi.mock('@/stores/useNotesRootStore', () => ({
  useNotesRootStore: (selector: (state: {
    currentNotesRoot: typeof hoisted.notesRootState.currentNotesRoot;
    recentNotesRoots: typeof hoisted.notesRootState.recentNotesRoots;
    openNotesRoot: typeof hoisted.openNotesRoot;
  }) => unknown) =>
    selector({
      currentNotesRoot: hoisted.notesRootState.currentNotesRoot,
      recentNotesRoots: hoisted.notesRootState.recentNotesRoots,
      openNotesRoot: hoisted.openNotesRoot,
    }),
}));

vi.mock('@/stores/uiSlice', () => ({
  useUIStore: (selector: (state: {
    sidebarCollapsed: boolean;
    setNotesSidebarView: typeof hoisted.setNotesSidebarView;
  }) => unknown) =>
    selector({
      sidebarCollapsed: hoisted.uiState.sidebarCollapsed,
      setNotesSidebarView: hoisted.setNotesSidebarView,
    }),
}));

vi.mock('@/hooks/useHeldPageScroll', () => ({
  useHeldPageScroll: vi.fn(),
}));

vi.mock('../NotesSidebarTopActions', () => ({
  NotesSidebarTopActions: () => null,
}));

vi.mock('./useNotesOutline', () => ({
  useNotesOutline: () => ({
    headings: hoisted.outlineState.headings,
    activeId: hoisted.outlineState.activeId,
    jumpToHeading: hoisted.jumpToHeading,
    renameHeading: hoisted.renameHeading,
  }),
}));

describe('NotesOutline', () => {
  beforeEach(() => {
    hoisted.outlineState.headings = [
      { id: 'parent', level: 1, text: 'Parent', from: 0, to: 6 },
      { id: 'child', level: 2, text: 'Child', from: 7, to: 12 },
    ];
    hoisted.outlineState.activeId = null;
    hoisted.notesState.starredEntries = [];
    hoisted.notesState.starredLoaded = true;
    hoisted.uiState.sidebarCollapsed = false;
    hoisted.notesRootState.currentNotesRoot = null;
    hoisted.notesRootState.recentNotesRoots = [];
    hoisted.jumpToHeading.mockClear();
    hoisted.renameHeading.mockClear();
    hoisted.setNotesSidebarView.mockClear();
    hoisted.openNotesRoot.mockClear();
    hoisted.openNotesRoot.mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  it('colors collapsed-section chevrons blue on hover in inactive outline rows', () => {
    render(<NotesOutline enabled />);

    const toggle = screen.getByRole('button', { name: 'Collapse section' });
    const affordance = toggle.querySelector('[aria-hidden="true"]');

    expect(affordance?.className).toContain('text-[color:var(--vlaina-collapse-triangle-sidebar-soft-fg)]');
    expect(affordance?.className).toContain('group-hover/sidebar-row:text-[color:var(--vlaina-collapse-triangle-hover-fg)]');
    expect(affordance?.className).toContain('group-focus-within/sidebar-row:text-[color:var(--vlaina-collapse-triangle-hover-fg)]');
    expect(affordance?.className).toContain('hover:text-[color:var(--vlaina-collapse-triangle-hover-fg)]');
    expect(affordance?.className).not.toContain('hover:text-[var(--vlaina-sidebar-notes-text)]');
  });

  it('jumps to an outline heading immediately when clicked', () => {
    render(<NotesOutline enabled />);

    fireEvent.click(screen.getByRole('button', { name: 'Parent' }));

    expect(hoisted.jumpToHeading).toHaveBeenCalledWith('parent');
  });

  it('virtualizes large outlines instead of rendering every heading row', () => {
    hoisted.outlineState.headings = Array.from({ length: 220 }, (_, index) => ({
      id: `heading-${index + 1}`,
      level: 1,
      text: `Heading ${index + 1}`,
      from: index,
      to: index + 1,
    }));

    render(<NotesOutline enabled />);

    expect(screen.getByRole('button', { name: 'Heading 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Heading 220' })).toBeNull();
  });

  it('shows the empty workspace panel without outline empty text when no file is open', () => {
    hoisted.outlineState.headings = [];
    const openFileListener = vi.fn();
    window.addEventListener('app-open-markdown-target-file', openFileListener);

    try {
      render(<NotesOutline enabled={false} currentNotePath={null} />);

      expect(screen.queryByText('notes.outlineEmpty')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'notes.file' }));

      expect(hoisted.setNotesSidebarView).not.toHaveBeenCalled();
      expect(openFileListener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('app-open-markdown-target-file', openFileListener);
    }
  });

  it('keeps the empty workspace panel vertically aligned with the files view', () => {
    hoisted.outlineState.headings = [];

    const { container } = render(<NotesOutline enabled={false} currentNotePath={null} />);
    const blankRoot = container.querySelector('[data-notes-sidebar-blank-drag-root="true"]');

    expect(screen.getByTestId('empty-workspace-panel')).toBeInTheDocument();
    expect(blankRoot).toHaveClass('min-h-[var(--vlaina-size-160px)]');
    expect(blankRoot).not.toHaveClass('pb-8');
  });

  it('shows outline empty only after a file is open', () => {
    hoisted.outlineState.headings = [];

    render(<NotesOutline enabled currentNotePath="note.md" />);

    expect(screen.getByText('notes.outlineEmpty')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'notes.file' })).toBeNull();
  });

  it('hides the empty workspace panel when the sidebar is collapsed and no file is open', () => {
    hoisted.outlineState.headings = [];
    hoisted.uiState.sidebarCollapsed = true;

    render(<NotesOutline enabled={false} currentNotePath={null} />);

    expect(screen.queryByText('notes.outlineEmpty')).toBeNull();
    expect(screen.queryByRole('button', { name: 'notes.file' })).toBeNull();
  });

  it('shows the empty workspace panel when the collapsed sidebar is peeking', () => {
    hoisted.outlineState.headings = [];
    hoisted.uiState.sidebarCollapsed = true;

    const { container } = render(<NotesOutline enabled={false} currentNotePath={null} isPeeking />);

    expect(screen.getByTestId('empty-workspace-panel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'notes.file' })).toBeInTheDocument();

    const scrollRoot = container.querySelector<HTMLElement>('[data-notes-sidebar-scroll-root="true"]');
    expect(scrollRoot).toHaveClass('pt-0');
    expect(scrollRoot).toHaveClass('app-scrollbar-rounded');
    expect(scrollRoot).not.toHaveClass('pt-4');
    expect(scrollRoot).not.toHaveClass('pb-4');
  });

  it('opens a recent notes root from the outline empty workspace panel', () => {
    hoisted.outlineState.headings = [];
    hoisted.notesRootState.currentNotesRoot = { path: '/notes-roots/current', name: 'Current' };
    hoisted.notesRootState.recentNotesRoots = [
      { id: 'notes-root-current', name: 'Current', path: '/notes-roots/current', lastOpened: 3 },
      { id: 'notes-root-alpha', name: 'Alpha', path: '/notes-roots/alpha', lastOpened: 2 },
      { id: 'notes-root-beta', name: 'Beta', path: '/notes-roots/beta', lastOpened: 1 },
    ];

    render(<NotesOutline enabled={false} currentNotePath={null} />);

    fireEvent.click(screen.getByText('Current'));

    expect(hoisted.openNotesRoot).toHaveBeenCalledWith('/notes-roots/current');
  });
});
