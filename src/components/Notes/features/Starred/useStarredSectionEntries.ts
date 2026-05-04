import { useMemo } from 'react';
import { joinPath } from '@/lib/storage/adapter';
import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { useNotesStore } from '@/stores/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import type { FileTreeNode, StarredEntry } from '@/stores/notes/types';
import { normalizeStarredVaultPath } from '@/stores/notes/starred';
import { flushCurrentTitleCommit } from '../Editor/utils/titleCommitRegistry';
import { buildNodeLookup, sortStarredEntries } from './starredSectionUtils';

function getStarredAbsolutePath(entry: StarredEntry) {
  const vaultPath = normalizeStarredVaultPath(entry.vaultPath);
  const relativePath = normalizeNotePathKey(entry.relativePath);
  if (!relativePath) {
    return vaultPath;
  }

  return `${vaultPath}/${relativePath}`.replace(/\/+/g, '/');
}

export interface StarredSectionEntryViewModel {
  entry: StarredEntry;
  isCurrentVaultEntry: boolean;
  isActive: boolean;
  treeNode: FileTreeNode | null;
  onOpen: (openInNewTab?: boolean) => void;
  onRemove: () => void;
}

export function useStarredSectionEntries() {
  const starredEntries = useNotesStore((state) => state.starredEntries);
  const starredLoaded = useNotesStore((state) => state.starredLoaded);
  const currentNotePath = useNotesStore((state) => state.currentNote?.path);
  const rootFolder = useNotesStore((state) => state.rootFolder);
  const openNote = useNotesStore((state) => state.openNote);
  const openNoteByAbsolutePath = useNotesStore((state) => state.openNoteByAbsolutePath);
  const removeStarredEntry = useNotesStore((state) => state.removeStarredEntry);
  const currentVault = useVaultStore((state) => state.currentVault);

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
        const normalizedCurrentNotePath = normalizeNotePathKey(currentNotePath);
        const entryRelativePath = normalizeNotePathKey(entry.relativePath);
        const isActive =
          entry.kind === 'note' &&
          normalizedCurrentNotePath != null &&
          (isCurrentVaultEntry
            ? normalizedCurrentNotePath === entryRelativePath
            : normalizedCurrentNotePath === getStarredAbsolutePath(entry));

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
      currentNotePath,
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
