import { useMemo } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import type { FileTreeNode, StarredEntry } from '@/stores/notes/types';
import { normalizeStarredVaultPath } from '@/stores/notes/starred';
import { buildNodeLookup, getVaultLabel, sortStarredEntries } from './starredSectionUtils';

export interface StarredSectionEntryViewModel {
  entry: StarredEntry;
  isCurrentVaultEntry: boolean;
  isActive: boolean;
  treeNode: FileTreeNode | null;
  onOpen: (openInNewTab?: boolean) => void;
  onRemove: () => void;
}

export function useStarredSectionEntries() {
  const {
    starredEntries,
    starredLoaded,
    currentNote,
    rootFolder,
    openNote,
    toggleFolder,
    revealFolder,
    removeStarredEntry,
    setPendingStarredNavigation,
  } = useNotesStore();
  const { currentVault, recentVaults, openVault } = useVaultStore();

  const currentVaultPath = currentVault?.path ? normalizeStarredVaultPath(currentVault.path) : '';
  const sortedStarredEntries = useMemo(() => sortStarredEntries(starredEntries), [starredEntries]);
  const nodeLookup = useMemo(() => buildNodeLookup(rootFolder), [rootFolder]);

  const entries = useMemo<StarredSectionEntryViewModel[]>(
    () =>
      sortedStarredEntries.map((entry) => {
        const isCurrentVaultEntry =
          normalizeStarredVaultPath(entry.vaultPath) === currentVaultPath;
        const treeNode = isCurrentVaultEntry
          ? nodeLookup.get(entry.relativePath) ?? null
          : null;
        const vaultLabel = getVaultLabel(entry.vaultPath, recentVaults);
        const isActive =
          entry.kind === 'note' &&
          isCurrentVaultEntry &&
          currentNote?.path === entry.relativePath;

        return {
          entry,
          isCurrentVaultEntry,
          isActive,
          treeNode,
          onOpen: (openInNewTab = false) => {
            void (async () => {
              if (isCurrentVaultEntry) {
                if (entry.kind === 'folder') {
                  if (treeNode?.isFolder) {
                    toggleFolder(treeNode.path);
                  } else {
                    revealFolder(entry.relativePath);
                  }
                } else {
                  await openNote(entry.relativePath, openInNewTab);
                }
                return;
              }

              setPendingStarredNavigation({
                vaultPath: entry.vaultPath,
                kind: entry.kind,
                relativePath: entry.relativePath,
                openInNewTab,
                skipWorkspaceRestore: entry.kind === 'note',
              });

              const opened = await openVault(entry.vaultPath, vaultLabel);
              if (!opened) {
                setPendingStarredNavigation(null);
              }
            })();
          },
          onRemove: () => removeStarredEntry(entry.id),
        };
      }),
    [
      currentNote?.path,
      currentVaultPath,
      nodeLookup,
      openNote,
      openVault,
      recentVaults,
      removeStarredEntry,
      revealFolder,
      setPendingStarredNavigation,
      sortedStarredEntries,
      toggleFolder,
    ],
  );

  return {
    starredLoaded,
    hasEntries: starredEntries.length > 0,
    entries,
  };
}
