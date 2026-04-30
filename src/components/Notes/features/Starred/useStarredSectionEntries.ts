import { useMemo } from 'react';
import { joinPath } from '@/lib/storage/adapter';
import { useNotesStore } from '@/stores/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import type { FileTreeNode, StarredEntry } from '@/stores/notes/types';
import { normalizeStarredVaultPath } from '@/stores/notes/starred';
import { flushCurrentTitleCommit } from '../Editor/utils/titleCommitRegistry';
import { buildNodeLookup, sortStarredEntries } from './starredSectionUtils';

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
    openNoteByAbsolutePath,
    removeStarredEntry,
  } = useNotesStore();
  const { currentVault } = useVaultStore();

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
              await flushCurrentTitleCommit();

              const notesState = useNotesStore.getState();
              const latestEntry =
                notesState.starredEntries.find((candidate) => candidate.id === entry.id) ?? entry;
              if (latestEntry.kind === 'folder') {
                return;
              }

              const shouldOpenInNewTab = openInNewTab || notesState.isDirty;
              const isLatestCurrentVaultEntry =
                normalizeStarredVaultPath(latestEntry.vaultPath) === currentVaultPath;

              if (!isLatestCurrentVaultEntry) {
                const absolutePath = await joinPath(latestEntry.vaultPath, latestEntry.relativePath);
                await openNoteByAbsolutePath(absolutePath, shouldOpenInNewTab);
                return;
              }

              await openNote(latestEntry.relativePath, shouldOpenInNewTab);
            })();
          },
          onRemove: () => {
            removeStarredEntry(entry.id);
          },
        };
      }),
    [
      currentNote?.path,
      currentVaultPath,
      nodeLookup,
      openNote,
      openNoteByAbsolutePath,
      removeStarredEntry,
      sortedStarredEntries,
    ],
  );

  return {
    starredLoaded,
    hasEntries: starredEntries.length > 0,
    entries,
  };
}
