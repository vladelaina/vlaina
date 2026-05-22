import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotesSidebarPanel } from './NotesSidebarPanel';

const hoisted = vi.hoisted(() => ({
  uiState: {
    appViewMode: 'notes',
    notesSidebarView: 'workspace' as 'workspace' | 'outline',
  },
}));

vi.mock('@/stores/uiSlice', () => ({
  useUIStore: (selector: (state: typeof hoisted.uiState) => unknown) => selector(hoisted.uiState),
}));

vi.mock('./useNotesSidebarSearch', () => ({
  useNotesSidebarSearch: () => ({
    isSearchOpen: false,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    openSearch: vi.fn(),
    closeSearch: vi.fn(),
    toggleSearch: vi.fn(),
  }),
}));

vi.mock('./SidebarContent', () => ({
  SidebarContent: () => <div data-testid="sidebar-files" />,
}));

vi.mock('./Outline', () => ({
  NotesOutline: ({ enabled }: { enabled: boolean }) => (
    <div data-testid="sidebar-outline" data-enabled={String(enabled)} />
  ),
}));

vi.mock('./NotesSidebarPrimitives', () => ({
  NotesSidebarSurface: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('NotesSidebarPanel', () => {
  beforeEach(() => {
    hoisted.uiState.appViewMode = 'notes';
    hoisted.uiState.notesSidebarView = 'workspace';
  });

  it('keeps outline visible for an auto draft when outline is selected', async () => {
    hoisted.uiState.notesSidebarView = 'outline';

    render(
      <NotesSidebarPanel
        rootFolder={null}
        isLoading={false}
        currentNotePath="draft:blank"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
      />,
    );

    expect((await screen.findByTestId('sidebar-files')).parentElement).toHaveClass('hidden');
    expect((await screen.findByTestId('sidebar-outline')).parentElement).toHaveClass('flex');
  });

  it('shows outline for a regular note when outline is selected', async () => {
    hoisted.uiState.notesSidebarView = 'outline';

    render(
      <NotesSidebarPanel
        rootFolder={null}
        isLoading={false}
        currentNotePath="docs/alpha.md"
        createNote={vi.fn(async () => undefined)}
        createFolder={vi.fn(async () => null)}
      />,
    );

    expect((await screen.findByTestId('sidebar-files')).parentElement).toHaveClass('hidden');
    const outline = await screen.findByTestId('sidebar-outline');
    expect(outline.parentElement).toHaveClass('flex');
    expect(outline).toHaveAttribute('data-enabled', 'true');
  });
});
