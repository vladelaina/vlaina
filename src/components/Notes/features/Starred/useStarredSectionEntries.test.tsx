import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStarredSectionEntries } from './useStarredSectionEntries';

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
    vaultPath: string;
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
    openNote: vi.fn(async () => undefined),
    openNoteByAbsolutePath: vi.fn(async () => undefined),
    toggleFolder: vi.fn(),
    revealFolder: vi.fn(),
    removeStarredEntry: vi.fn(),
    setPendingStarredNavigation: vi.fn(),
  };

  const vaultState = {
    currentVault: { path: '/vault-a' } as { path: string } | null,
    recentVaults: [
      { path: '/vault-a', name: 'Vault A' },
      { path: '/vault-b', name: 'Vault B' },
    ],
    openVault: vi.fn(async () => true),
  };

  return {
    notesState,
    vaultState,
  };
});

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector?: (state: MockNotesState) => unknown) =>
    selector ? selector(mocked.notesState) : mocked.notesState,
}));

vi.mock('@/stores/useVaultStore', () => ({
  useVaultStore: (selector?: (state: typeof mocked.vaultState) => unknown) =>
    selector ? selector(mocked.vaultState) : mocked.vaultState,
}));

describe('useStarredSectionEntries', () => {
  beforeEach(() => {
    mocked.notesState.starredEntries = [];
    mocked.notesState.starredLoaded = true;
    mocked.notesState.currentNote = null;
    mocked.notesState.isDirty = false;
    mocked.notesState.rootFolder = null;
    mocked.notesState.openNote.mockReset();
    mocked.notesState.openNote.mockResolvedValue(undefined);
    mocked.notesState.openNoteByAbsolutePath.mockReset();
    mocked.notesState.openNoteByAbsolutePath.mockResolvedValue(undefined);
    mocked.notesState.toggleFolder.mockReset();
    mocked.notesState.revealFolder.mockReset();
    mocked.notesState.removeStarredEntry.mockReset();
    mocked.notesState.setPendingStarredNavigation.mockReset();
    mocked.vaultState.currentVault = { path: '/vault-a' };
    mocked.vaultState.recentVaults = [
      { path: '/vault-a', name: 'Vault A' },
      { path: '/vault-b', name: 'Vault B' },
    ];
    mocked.vaultState.openVault.mockReset();
    mocked.vaultState.openVault.mockResolvedValue(true);
  });

  it('opens a current-vault note without setting pending starred navigation', async () => {
    mocked.notesState.starredEntries = [
      {
        id: 'note-1',
        kind: 'note',
        vaultPath: '/vault-a',
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
    expect(mocked.vaultState.openVault).not.toHaveBeenCalled();
  });

  it('does not open a current-vault starred folder', async () => {
    mocked.notesState.starredEntries = [
      {
        id: 'folder-1',
        kind: 'folder',
        vaultPath: '/vault-a',
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

    const { result } = renderHook(() => useStarredSectionEntries());

    await act(async () => {
      await result.current.entries[0]?.onOpen();
    });

    expect(mocked.notesState.toggleFolder).not.toHaveBeenCalled();
    expect(mocked.notesState.revealFolder).not.toHaveBeenCalled();
    expect(mocked.notesState.setPendingStarredNavigation).not.toHaveBeenCalled();
    expect(mocked.notesState.openNote).not.toHaveBeenCalled();
  });

  it('opens a cross-vault starred note without switching to the target vault', async () => {
    mocked.notesState.starredEntries = [
      {
        id: 'note-2',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: 'docs/beta.md',
        addedAt: 1,
      },
    ];

    const { result } = renderHook(() => useStarredSectionEntries());

    await act(async () => {
      await result.current.entries[0]?.onOpen();
    });

    expect(mocked.notesState.openNoteByAbsolutePath).toHaveBeenCalledWith(
      '/vault-b/docs/beta.md',
      false,
    );
    expect(mocked.notesState.setPendingStarredNavigation).not.toHaveBeenCalled();
    expect(mocked.vaultState.openVault).not.toHaveBeenCalled();
    expect(mocked.notesState.openNote).not.toHaveBeenCalled();
  });

  it('opens a starred note in a new tab when the current note is dirty', async () => {
    mocked.notesState.currentNote = { path: 'draft:blank', content: 'draft text' };
    mocked.notesState.isDirty = true;
    mocked.notesState.starredEntries = [
      {
        id: 'note-3',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: 'docs/gamma.md',
        addedAt: 1,
      },
    ];

    const { result } = renderHook(() => useStarredSectionEntries());

    await act(async () => {
      await result.current.entries[0]?.onOpen();
    });

    expect(mocked.notesState.openNoteByAbsolutePath).toHaveBeenCalledWith(
      '/vault-b/docs/gamma.md',
      true,
    );
  });

  it('does not open a cross-vault starred folder', async () => {
    mocked.notesState.starredEntries = [
      {
        id: 'folder-2',
        kind: 'folder',
        vaultPath: '/vault-b',
        relativePath: 'archive',
        addedAt: 1,
      },
    ];
    mocked.vaultState.openVault.mockResolvedValue(false);

    const { result } = renderHook(() => useStarredSectionEntries());

    await act(async () => {
      await result.current.entries[0]?.onOpen();
    });

    expect(mocked.notesState.setPendingStarredNavigation).not.toHaveBeenCalled();
    expect(mocked.vaultState.openVault).not.toHaveBeenCalled();
  });
});
