import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentVaultPath, useNotesStore } from '@/stores/notes/useNotesStore';
import { useVaultStore } from './useVaultStore';

const hoisted = vi.hoisted(() => ({
  saveStarredRegistry: vi.fn(),
  moveVaultSystemStore: vi.fn(async () => undefined),
  flushCurrentPendingEditorMarkdown: vi.fn(),
}));

vi.mock('@/stores/notes/starred', async () => {
  const actual = await vi.importActual<typeof import('@/stores/notes/starred')>('@/stores/notes/starred');
  return {
    ...actual,
    saveStarredRegistry: hoisted.saveStarredRegistry,
  };
});

vi.mock('@/stores/notes/systemStoragePaths', () => ({
  moveVaultSystemStore: hoisted.moveVaultSystemStore,
}));

vi.mock('@/stores/notes/pendingEditorMarkdownFlusher', () => ({
  flushCurrentPendingEditorMarkdown: hoisted.flushCurrentPendingEditorMarkdown,
}));

describe('useVaultStore external sync', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    useVaultStore.setState({
      currentVault: null,
      recentVaults: [],
      isLoading: false,
      hasInitialized: true,
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
      currentNote: null,
      openTabs: [],
      noteContentsCache: new Map(),
      isDirty: false,
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
    expect(hoisted.moveVaultSystemStore).toHaveBeenCalledWith('C:/vault-old', 'C:/vault-new');
    expect(useNotesStore.getState().clearAssetUrlCache).toHaveBeenCalledTimes(1);
  });

  it('flushes pending editor markdown before syncing an externally renamed vault path', () => {
    useVaultStore.setState({
      currentVault: {
        id: 'vault-1',
        name: 'vault-old',
        path: 'C:/vault-old',
        lastOpened: 10,
      },
      recentVaults: [
        {
          id: 'vault-1',
          name: 'vault-old',
          path: 'C:/vault-old',
          lastOpened: 10,
        },
      ],
    });
    useNotesStore.setState({
      currentNote: { path: 'docs/alpha.md', content: 'Old alpha' },
      openTabs: [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['docs/alpha.md', { content: 'Old alpha', modifiedAt: 1 }]]),
      isDirty: false,
    });
    hoisted.flushCurrentPendingEditorMarkdown.mockImplementation(() => {
      useNotesStore.setState((state) => ({
        currentNote: { path: 'docs/alpha.md', content: 'Pending alpha' },
        currentNoteRevision: state.currentNoteRevision + 1,
        isDirty: true,
        openTabs: state.openTabs.map((tab) =>
          tab.path === 'docs/alpha.md' ? { ...tab, isDirty: true } : tab
        ),
        noteContentsCache: new Map(state.noteContentsCache).set('docs/alpha.md', {
          content: 'Pending alpha',
          modifiedAt: 1,
        }),
      }));
      return true;
    });

    useVaultStore.getState().syncCurrentVaultExternalPath('C:/vault-new');

    expect(hoisted.flushCurrentPendingEditorMarkdown).toHaveBeenCalledTimes(1);
    expect(useNotesStore.getState().notesPath).toBe('C:/vault-new');
    expect(useNotesStore.getState().currentNote).toEqual({
      path: 'docs/alpha.md',
      content: 'Pending alpha',
    });
    expect(useNotesStore.getState().noteContentsCache.get('docs/alpha.md')).toEqual({
      content: 'Pending alpha',
      modifiedAt: 1,
    });
    expect(useNotesStore.getState().openTabs).toEqual([
      { path: 'docs/alpha.md', name: 'alpha', isDirty: true },
    ]);
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

  it('reloads recent vault metadata after a cross-window storage update without switching vaults', () => {
    useVaultStore.setState({
      currentVault: {
        id: 'vault-1',
        name: 'Alpha',
        path: '/vaults/alpha',
        lastOpened: 1,
      },
      recentVaults: [
        {
          id: 'vault-1',
          name: 'Alpha',
          path: '/vaults/alpha',
          lastOpened: 1,
        },
      ],
    });

    const nextRecentVaults = [
      {
        id: 'vault-2',
        name: 'Beta',
        path: '/vaults/beta',
        lastOpened: 2,
      },
      {
        id: 'vault-1',
        name: 'Alpha Renamed',
        path: '/vaults/alpha',
        lastOpened: 1,
      },
    ];
    localStorage.setItem('vlaina-vaults', JSON.stringify(nextRecentVaults));
    localStorage.setItem('vlaina-current-vault', 'vault-2');

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vlaina-vaults',
      newValue: JSON.stringify(nextRecentVaults),
    }));

    expect(useVaultStore.getState().recentVaults).toEqual([
      expect.objectContaining({ id: 'vault-2', name: 'Beta' }),
      expect.objectContaining({ id: 'vault-1', name: 'Alpha Renamed' }),
    ]);
    expect(useVaultStore.getState().currentVault).toMatchObject({
      id: 'vault-1',
      name: 'Alpha Renamed',
      path: '/vaults/alpha',
    });
    expect(useNotesStore.getState().notesPath).toBe('C:/vault-old');
    expect(typeof useVaultStore.getState().openVault).toBe('function');
  });

  it('ignores oversized cross-window recent vault storage updates', () => {
    useVaultStore.setState({
      currentVault: {
        id: 'vault-1',
        name: 'Alpha',
        path: '/vaults/alpha',
        lastOpened: 1,
      },
      recentVaults: [
        {
          id: 'vault-1',
          name: 'Alpha',
          path: '/vaults/alpha',
          lastOpened: 1,
        },
      ],
    });

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vlaina-vaults',
      newValue: '['.padEnd(70 * 1024, ' '),
    }));

    expect(useVaultStore.getState().recentVaults).toEqual([
      expect.objectContaining({ id: 'vault-1', name: 'Alpha' }),
    ]);
    expect(useVaultStore.getState().currentVault).toMatchObject({
      id: 'vault-1',
      name: 'Alpha',
      path: '/vaults/alpha',
    });
  });
});
