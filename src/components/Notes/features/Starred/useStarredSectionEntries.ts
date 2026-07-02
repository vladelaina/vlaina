import { useMemo } from 'react';
import { joinPath } from '@/lib/storage/adapter';
import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { useNotesStore } from '@/stores/useNotesStore';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import type { FileTreeNode, StarredEntry } from '@/stores/notes/types';
import { getStarredEntryAbsolutePath, isSameStarredNotesRootPath, normalizeStarredNotesRootPath } from '@/stores/notes/starred';
import { flushCurrentTitleCommit } from '../Editor/utils/titleCommitRegistry';
import { suppressNextCurrentNoteSidebarReveal } from '../common/sidebarScrollIntoView';
import { buildNodeLookup, sortStarredEntries } from './starredSectionUtils';

export interface StarredSectionEntryViewModel {
  entry: StarredEntry;
  isCurrentNotesRootEntry: boolean;
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
  const rootFolderPath = useNotesStore((state) => state.rootFolderPath);
  const openNote = useNotesStore((state) => state.openNote);
  const openNoteByAbsolutePath = useNotesStore((state) => state.openNoteByAbsolutePath);
  const removeStarredEntry = useNotesStore((state) => state.removeStarredEntry);
  const currentNotesRoot = useNotesRootStore((state) => state.currentNotesRoot);

  const currentNotesRootPath = currentNotesRoot?.path ? normalizeStarredNotesRootPath(currentNotesRoot.path) : '';
  const sortedStarredEntries = useMemo(() => sortStarredEntries(starredEntries), [starredEntries]);
  const currentNotesRootRootFolder =
    rootFolderPath && currentNotesRootPath && isSameStarredNotesRootPath(rootFolderPath, currentNotesRootPath)
      ? rootFolder
      : null;
  const nodeLookup = useMemo(() => buildNodeLookup(currentNotesRootRootFolder), [currentNotesRootRootFolder]);

  const entries = useMemo<StarredSectionEntryViewModel[]>(
    () =>
      sortedStarredEntries.map((entry) => {
        const isCurrentNotesRootEntry =
          isSameStarredNotesRootPath(entry.notesRootPath, currentNotesRootPath);
        const treeNode = isCurrentNotesRootEntry
          ? nodeLookup.get(entry.relativePath) ?? null
          : null;
        const normalizedCurrentNotePath = normalizeNotePathKey(currentNotePath);
        const entryRelativePath = normalizeNotePathKey(entry.relativePath);
        const isActive =
          entry.kind === 'note' &&
          normalizedCurrentNotePath != null &&
          (isCurrentNotesRootEntry
            ? normalizedCurrentNotePath === entryRelativePath
            : normalizedCurrentNotePath === getStarredEntryAbsolutePath(entry));

        return {
          entry,
          isCurrentNotesRootEntry,
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

              const shouldOpenInNewTab = openInNewTab;
              const isLatestCurrentNotesRootEntry =
                isSameStarredNotesRootPath(latestEntry.notesRootPath, currentNotesRootPath);

              if (!isLatestCurrentNotesRootEntry) {
                const absolutePath = await joinPath(latestEntry.notesRootPath, latestEntry.relativePath);
                await openNoteByAbsolutePath(absolutePath, shouldOpenInNewTab);
                return;
              }

              if (!shouldOpenInNewTab) {
                suppressNextCurrentNoteSidebarReveal(latestEntry.relativePath);
              }

              await openNote(latestEntry.relativePath, shouldOpenInNewTab);
            })().catch(() => undefined);
          },
          onRemove: () => {
            removeStarredEntry(entry.id);
          },
        };
      }),
    [
      currentNotePath,
      currentNotesRootPath,
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
