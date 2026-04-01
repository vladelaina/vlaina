import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentVaultPath, useNotesStore } from '@/stores/notes/useNotesStore';
import { useVaultStore } from './useVaultStore';

const hoisted = vi.hoisted(() => ({
  saveStarredRegistry: vi.fn(),
}));

vi.mock('@/stores/notes/starred', async () => {
  const actual = await vi.importActual<typeof import('@/stores/notes/starred')>('@/stores/notes/starred');
  return {
    ...actual,
    saveStarredRegistry: hoisted.saveStarredRegistry,
  };
});

describe('useVaultStore external sync', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    useVaultStore.setState({
      currentVault: null,
      recentVaults: [],
      isLoading: false,
      error: null,
    });

    useNotesStore.setState({
      notesPath: 'C:/vault-old',
      starredEntries: [
        {
          id: 'note-1',
          kind: 'note',
          vaultPath: 'C:/vault-old',
          relativePath: 'docs/alpha.md',
          addedAt: 1,
        },
        {
          id: 'folder-1',
          kind: 'folder',
          vaultPath: 'C:/vault-old',
          relativePath: 'docs',
          addedAt: 2,
        },
      ],
      starredNotes: ['docs/alpha.md'],
      starredFolders: ['docs'],
      pendingStarredNavigation: {
        vaultPath: 'C:/vault-old',
        kind: 'note',
        relativePath: 'docs/alpha.md',
      },
      clearAssetUrlCache: vi.fn(),
    });
  });

  it('syncs the current vault path after an external root rename', () => {
    useVaultStore.setState({
      currentVault: {
        id: 'vault-1',
        name: 'vault-old',
        path: 'C:\\vault-old',
        lastOpened: 10,
      },
      recentVaults: [
        {
          id: 'vault-1',
          name: 'vault-old',
          path: 'C:\\vault-old',
          lastOpened: 10,
        },
      ],
    });

    useVaultStore.getState().syncCurrentVaultExternalPath('C:\\vault-new');

    expect(useVaultStore.getState().currentVault).toMatchObject({
      id: 'vault-1',
      name: 'vault-new',
      path: 'C:/vault-new',
    });
    expect(useVaultStore.getState().recentVaults[0]).toMatchObject({
      id: 'vault-1',
      name: 'vault-new',
      path: 'C:/vault-new',
    });
    expect(useNotesStore.getState().notesPath).toBe('C:/vault-new');
    expect(useNotesStore.getState().starredEntries).toEqual([
      expect.objectContaining({ vaultPath: 'C:/vault-new', relativePath: 'docs/alpha.md' }),
      expect.objectContaining({ vaultPath: 'C:/vault-new', relativePath: 'docs' }),
    ]);
    expect(useNotesStore.getState().pendingStarredNavigation).toEqual({
      vaultPath: 'C:/vault-new',
      kind: 'note',
      relativePath: 'docs/alpha.md',
    });
    expect(getCurrentVaultPath()).toBe('C:/vault-new');
    expect(hoisted.saveStarredRegistry).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ vaultPath: 'C:/vault-new', relativePath: 'docs/alpha.md' }),
        expect.objectContaining({ vaultPath: 'C:/vault-new', relativePath: 'docs' }),
      ])
    );
    expect(useNotesStore.getState().clearAssetUrlCache).toHaveBeenCalledTimes(1);
  });

  it('deduplicates mixed-slash recent vault entries during external path sync', () => {
    useVaultStore.setState({
      currentVault: {
        id: 'vault-1',
        name: 'vault-old',
        path: 'C:\\vault-old',
        lastOpened: 10,
      },
      recentVaults: [
        {
          id: 'vault-1',
          name: 'vault-old',
          path: 'C:\\vault-old',
          lastOpened: 10,
        },
        {
          id: 'vault-2',
          name: 'vault-new',
          path: 'C:/vault-new',
          lastOpened: 9,
        },
      ],
    });

    useVaultStore.getState().syncCurrentVaultExternalPath('C:\\vault-new');

    expect(useVaultStore.getState().recentVaults).toEqual([
      expect.objectContaining({ id: 'vault-1', path: 'C:/vault-new' }),
    ]);
  });
});
