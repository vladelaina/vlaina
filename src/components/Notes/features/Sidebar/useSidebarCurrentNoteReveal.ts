import { useEffect, useRef, type RefObject } from 'react';
import { isAbsolutePath } from '@/lib/storage/adapter';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import type { FolderNode } from '@/stores/useNotesStore';
import {
  consumeSuppressedCurrentNoteSidebarReveal,
  scheduleSidebarItemIntoView,
} from '../common/sidebarScrollIntoView';

export function useSidebarCurrentNoteReveal({
  active,
  currentNotePath,
  displayRootFolder,
  revealFolder,
  scrollRootRef,
  shouldShowSearchResults,
}: {
  active: boolean;
  currentNotePath?: string | null;
  displayRootFolder: FolderNode | null;
  revealFolder: (path: string) => void;
  scrollRootRef: RefObject<HTMLElement | null>;
  shouldShowSearchResults: boolean;
}) {
  const wasShowingSearchResultsRef = useRef(shouldShowSearchResults);
  const lastRevealedCurrentNotePathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    const wasShowingSearchResults = wasShowingSearchResultsRef.current;
    wasShowingSearchResultsRef.current = shouldShowSearchResults;
    const justLeftSearchResults = wasShowingSearchResults && !shouldShowSearchResults;

    if (
      shouldShowSearchResults ||
      !currentNotePath ||
      isDraftNotePath(currentNotePath) ||
      isAbsolutePath(currentNotePath) ||
      !displayRootFolder
    ) {
      return;
    }

    if (!justLeftSearchResults && lastRevealedCurrentNotePathRef.current === currentNotePath) {
      return;
    }

    lastRevealedCurrentNotePathRef.current = currentNotePath;
    if (consumeSuppressedCurrentNoteSidebarReveal(currentNotePath, scrollRootRef.current)) {
      return;
    }

    revealFolder(currentNotePath);
    scheduleSidebarItemIntoView(currentNotePath, 3);
  }, [active, currentNotePath, displayRootFolder, revealFolder, scrollRootRef, shouldShowSearchResults]);
}
