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
  jumpToHeading: vi.fn(),
  renameHeading: vi.fn(() => true),
  setNotesSidebarView: vi.fn(),
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector: (state: typeof hoisted.notesState) => unknown) => selector(hoisted.notesState),
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
    hoisted.jumpToHeading.mockClear();
    hoisted.renameHeading.mockClear();
    hoisted.setNotesSidebarView.mockClear();
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

  it('shows open target actions without switching sidebar views when no file or starred entry is available', () => {
    hoisted.outlineState.headings = [];
    const openFileListener = vi.fn();
    window.addEventListener('app-open-markdown-target-file', openFileListener);

    try {
      render(<NotesOutline enabled={false} currentNotePath={null} />);

      expect(screen.getByText('notes.outlineEmpty')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'notes.file' }));

      expect(hoisted.setNotesSidebarView).not.toHaveBeenCalled();
      expect(openFileListener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('app-open-markdown-target-file', openFileListener);
    }
  });

  it('keeps the plain outline empty state when starred entries exist', () => {
    hoisted.outlineState.headings = [];
    hoisted.notesState.starredEntries = [{ id: 'starred-note' }];

    render(<NotesOutline enabled={false} currentNotePath={null} />);

    expect(screen.getByText('notes.outlineEmpty')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'notes.file' })).toBeNull();
  });

  it('hides the open target actions when the sidebar is collapsed', () => {
    hoisted.outlineState.headings = [];
    hoisted.uiState.sidebarCollapsed = true;

    render(<NotesOutline enabled={false} currentNotePath={null} />);

    expect(screen.getByText('notes.outlineEmpty')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'notes.file' })).toBeNull();
  });
});
