import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotePathBreadcrumb } from './NotePathBreadcrumb';

const mocks = vi.hoisted(() => {
  const notesState = {
    notesPath: '',
    draftNotes: {},
    starredEntries: [
      {
        id: 'starred-note',
        kind: 'note' as const,
        notesRootPath: '/notesRoot',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
    ],
    revealFolder: vi.fn(),
    setPendingStarredNavigation: vi.fn(),
  };

  const notesRootState = {
    currentNotesRoot: null as { name?: string; path: string } | null,
    openNotesRoot: vi.fn().mockResolvedValue(true),
  };

  const uiState = {
    setNotesSidebarView: vi.fn(),
  };

  return { notesState, notesRootState, uiState };
});

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector: (state: typeof mocks.notesState) => unknown) => selector(mocks.notesState),
}));

vi.mock('@/stores/useNotesRootStore', () => ({
  useNotesRootStore: (selector: (state: typeof mocks.notesRootState) => unknown) => selector(mocks.notesRootState),
}));

vi.mock('@/stores/uiSlice', () => ({
  useUIStore: (selector: (state: typeof mocks.uiState) => unknown) => selector(mocks.uiState),
}));

vi.mock('@/hooks/useTitleSync', () => ({
  useDisplayName: () => null,
}));

vi.mock('@/lib/desktop/homePath', () => ({
  getCachedDesktopHomePath: () => null,
  getDesktopHomePath: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/components/Notes/features/common/sidebarScrollIntoView', () => ({
  scheduleSidebarItemIntoView: vi.fn(),
}));

describe('NotePathBreadcrumb', () => {
  beforeEach(() => {
    mocks.notesState.notesPath = '';
    mocks.notesState.draftNotes = {};
    mocks.notesState.starredEntries = [
      {
        id: 'starred-note',
        kind: 'note',
        notesRootPath: '/notesRoot',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
    ];
    mocks.notesState.revealFolder.mockClear();
    mocks.notesState.setPendingStarredNavigation.mockClear();
    mocks.notesRootState.currentNotesRoot = null;
    mocks.notesRootState.openNotesRoot.mockClear();
    mocks.notesRootState.openNotesRoot.mockResolvedValue(true);
    mocks.uiState.setNotesSidebarView.mockClear();
  });

  it('opens the original starred notesRoot when revealing an absolute starred note from a child folder', async () => {
    render(<NotePathBreadcrumb notePath="/notesRoot/docs/alpha.md" />);

    fireEvent.click(screen.getByRole('button', { name: 'docs' }));

    await waitFor(() => {
      expect(mocks.notesRootState.openNotesRoot).toHaveBeenCalledWith('/notesRoot');
    });
    expect(mocks.notesState.setPendingStarredNavigation).toHaveBeenCalledWith({
      notesRootPath: '/notesRoot',
      kind: 'note',
      relativePath: 'docs/alpha.md',
      skipWorkspaceRestore: true,
    });
    expect(mocks.notesRootState.openNotesRoot).not.toHaveBeenCalledWith('/notesRoot/docs');
  });

  it('opens the original starred notesRoot from the note segment when no workspace is active', async () => {
    render(<NotePathBreadcrumb notePath="/notesRoot/docs/alpha.md" />);

    fireEvent.click(screen.getByRole('button', { name: 'alpha' }));

    await waitFor(() => {
      expect(mocks.notesRootState.openNotesRoot).toHaveBeenCalledWith('/notesRoot');
    });
    expect(mocks.notesState.setPendingStarredNavigation).toHaveBeenCalledWith({
      notesRootPath: '/notesRoot',
      kind: 'note',
      relativePath: 'docs/alpha.md',
      skipWorkspaceRestore: true,
    });
    expect(mocks.notesRootState.openNotesRoot).not.toHaveBeenCalledWith('/notesRoot/docs');
  });

  it('keeps root-notesRoot starred notes anchored to the root notesRoot', async () => {
    mocks.notesState.starredEntries = [
      {
        id: 'root-starred-note',
        kind: 'note',
        notesRootPath: '/',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
    ];

    render(<NotePathBreadcrumb notePath="/docs/alpha.md" />);

    fireEvent.click(screen.getByRole('button', { name: 'docs' }));

    await waitFor(() => {
      expect(mocks.notesRootState.openNotesRoot).toHaveBeenCalledWith('/');
    });
    expect(mocks.notesState.setPendingStarredNavigation).toHaveBeenCalledWith({
      notesRootPath: '/',
      kind: 'note',
      relativePath: 'docs/alpha.md',
      skipWorkspaceRestore: true,
    });
    expect(mocks.notesRootState.openNotesRoot).not.toHaveBeenCalledWith('/docs');
  });

  it('keeps non-starred absolute notes scoped to the clicked parent folder', async () => {
    mocks.notesState.starredEntries = [];

    render(<NotePathBreadcrumb notePath="/external/docs/alpha.md" />);

    fireEvent.click(screen.getByRole('button', { name: 'docs' }));

    await waitFor(() => {
      expect(mocks.notesRootState.openNotesRoot).toHaveBeenCalledWith('/external/docs');
    });
    expect(mocks.notesState.setPendingStarredNavigation).toHaveBeenCalledWith({
      notesRootPath: '/external/docs',
      kind: 'note',
      relativePath: 'alpha.md',
      skipWorkspaceRestore: true,
    });
  });

  it('reveals non-starred absolute notes when opening the filesystem root', async () => {
    mocks.notesState.starredEntries = [];

    render(<NotePathBreadcrumb notePath="/docs/alpha.md" />);

    fireEvent.click(screen.getByRole('button', { name: '/' }));

    await waitFor(() => {
      expect(mocks.notesRootState.openNotesRoot).toHaveBeenCalledWith('/');
    });
    expect(mocks.notesState.setPendingStarredNavigation).toHaveBeenCalledWith({
      notesRootPath: '/',
      kind: 'note',
      relativePath: 'docs/alpha.md',
      skipWorkspaceRestore: true,
    });
  });

  it('reveals an absolute note inside the already-open workspace without reopening the notesRoot', () => {
    mocks.notesState.notesPath = '/notesRoot';

    render(<NotePathBreadcrumb notePath="/notesRoot/docs/alpha.md" />);

    fireEvent.click(screen.getByRole('button', { name: 'alpha' }));

    expect(mocks.notesState.revealFolder).toHaveBeenCalledWith('docs/alpha.md');
    expect(mocks.notesRootState.openNotesRoot).not.toHaveBeenCalled();
    expect(mocks.notesState.setPendingStarredNavigation).not.toHaveBeenCalled();
  });

  it('renders truncated long note labels in the breadcrumb', () => {
    render(<NotePathBreadcrumb notePath="/notesRoot/docs/very-long-note-name.md" />);

    expect(screen.getByRole('button', { name: 'very-long-note-....' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'very-long-note-name' })).not.toBeInTheDocument();
  });
});
