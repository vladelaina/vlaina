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
        vaultPath: '/vault',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
    ],
    revealFolder: vi.fn(),
    setPendingStarredNavigation: vi.fn(),
  };

  const vaultState = {
    currentVault: null as { name?: string; path: string } | null,
    openVault: vi.fn().mockResolvedValue(true),
  };

  const uiState = {
    setNotesSidebarView: vi.fn(),
  };

  return { notesState, vaultState, uiState };
});

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector: (state: typeof mocks.notesState) => unknown) => selector(mocks.notesState),
}));

vi.mock('@/stores/useVaultStore', () => ({
  useVaultStore: (selector: (state: typeof mocks.vaultState) => unknown) => selector(mocks.vaultState),
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
        vaultPath: '/vault',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
    ];
    mocks.notesState.revealFolder.mockClear();
    mocks.notesState.setPendingStarredNavigation.mockClear();
    mocks.vaultState.currentVault = null;
    mocks.vaultState.openVault.mockClear();
    mocks.vaultState.openVault.mockResolvedValue(true);
    mocks.uiState.setNotesSidebarView.mockClear();
  });

  it('opens the original starred vault when revealing an absolute starred note from a child folder', async () => {
    render(<NotePathBreadcrumb notePath="/vault/docs/alpha.md" />);

    fireEvent.click(screen.getByRole('button', { name: 'docs' }));

    await waitFor(() => {
      expect(mocks.vaultState.openVault).toHaveBeenCalledWith('/vault');
    });
    expect(mocks.notesState.setPendingStarredNavigation).toHaveBeenCalledWith({
      vaultPath: '/vault',
      kind: 'note',
      relativePath: 'docs/alpha.md',
      skipWorkspaceRestore: true,
    });
    expect(mocks.vaultState.openVault).not.toHaveBeenCalledWith('/vault/docs');
  });

  it('opens the original starred vault from the note segment when no workspace is active', async () => {
    render(<NotePathBreadcrumb notePath="/vault/docs/alpha.md" />);

    fireEvent.click(screen.getByRole('button', { name: 'alpha' }));

    await waitFor(() => {
      expect(mocks.vaultState.openVault).toHaveBeenCalledWith('/vault');
    });
    expect(mocks.notesState.setPendingStarredNavigation).toHaveBeenCalledWith({
      vaultPath: '/vault',
      kind: 'note',
      relativePath: 'docs/alpha.md',
      skipWorkspaceRestore: true,
    });
    expect(mocks.vaultState.openVault).not.toHaveBeenCalledWith('/vault/docs');
  });

  it('keeps root-vault starred notes anchored to the root vault', async () => {
    mocks.notesState.starredEntries = [
      {
        id: 'root-starred-note',
        kind: 'note',
        vaultPath: '/',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
    ];

    render(<NotePathBreadcrumb notePath="/docs/alpha.md" />);

    fireEvent.click(screen.getByRole('button', { name: 'docs' }));

    await waitFor(() => {
      expect(mocks.vaultState.openVault).toHaveBeenCalledWith('/');
    });
    expect(mocks.notesState.setPendingStarredNavigation).toHaveBeenCalledWith({
      vaultPath: '/',
      kind: 'note',
      relativePath: 'docs/alpha.md',
      skipWorkspaceRestore: true,
    });
    expect(mocks.vaultState.openVault).not.toHaveBeenCalledWith('/docs');
  });

  it('keeps non-starred absolute notes scoped to the clicked parent folder', async () => {
    mocks.notesState.starredEntries = [];

    render(<NotePathBreadcrumb notePath="/external/docs/alpha.md" />);

    fireEvent.click(screen.getByRole('button', { name: 'docs' }));

    await waitFor(() => {
      expect(mocks.vaultState.openVault).toHaveBeenCalledWith('/external/docs');
    });
    expect(mocks.notesState.setPendingStarredNavigation).toHaveBeenCalledWith({
      vaultPath: '/external/docs',
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
      expect(mocks.vaultState.openVault).toHaveBeenCalledWith('/');
    });
    expect(mocks.notesState.setPendingStarredNavigation).toHaveBeenCalledWith({
      vaultPath: '/',
      kind: 'note',
      relativePath: 'docs/alpha.md',
      skipWorkspaceRestore: true,
    });
  });

  it('reveals an absolute note inside the already-open workspace without reopening the vault', () => {
    mocks.notesState.notesPath = '/vault';

    render(<NotePathBreadcrumb notePath="/vault/docs/alpha.md" />);

    fireEvent.click(screen.getByRole('button', { name: 'alpha' }));

    expect(mocks.notesState.revealFolder).toHaveBeenCalledWith('docs/alpha.md');
    expect(mocks.vaultState.openVault).not.toHaveBeenCalled();
    expect(mocks.notesState.setPendingStarredNavigation).not.toHaveBeenCalled();
  });
});
