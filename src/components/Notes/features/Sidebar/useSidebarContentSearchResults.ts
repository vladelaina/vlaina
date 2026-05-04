import { useEffect, useMemo, useRef, useState } from 'react';
import type { FolderNode } from '@/stores/useNotesStore';
import {
  buildNotesSidebarSearchIndex,
  countNotesSidebarSearchEntries,
  queryNotesSidebarSearch,
  shouldSearchNotesSidebarContents,
} from './notesSidebarSearchResults';

export function useSidebarContentSearchResults({
  rootFolder,
  getDisplayName,
  noteContentsCache,
  scanAllNotes,
  pruneNoteContentsCacheToOpenNotes,
  searchQuery,
  isSearchOpen,
}: {
  rootFolder: FolderNode | null;
  getDisplayName: (path: string) => string;
  noteContentsCache: Map<string, { content: string }>;
  scanAllNotes: () => Promise<unknown>;
  pruneNoteContentsCacheToOpenNotes: () => void;
  searchQuery: string;
  isSearchOpen: boolean;
}) {
  const contentScanPromiseRef = useRef<Promise<unknown> | null>(null);
  const shouldPruneAfterScanRef = useRef(false);
  const [isContentScanPending, setIsContentScanPending] = useState(false);

  const searchIndex = useMemo(
    () => buildNotesSidebarSearchIndex(rootFolder, getDisplayName),
    [getDisplayName, rootFolder],
  );
  const searchableNoteCount = useMemo(
    () => countNotesSidebarSearchEntries(rootFolder),
    [rootFolder],
  );
  const shouldSearchContents = shouldSearchNotesSidebarContents(searchQuery);
  const isContentIndexReady = useMemo(
    () =>
      searchableNoteCount > 0 &&
      searchIndex.every((entry) => noteContentsCache.has(entry.path)),
    [noteContentsCache, searchableNoteCount, searchIndex],
  );

  const searchResults = useMemo(
    () =>
      queryNotesSidebarSearch(
        searchIndex,
        searchQuery,
        (path) => noteContentsCache.get(path)?.content,
      ),
    [noteContentsCache, searchIndex, searchQuery],
  );

  useEffect(() => {
    if (
      !isSearchOpen ||
      !shouldSearchContents ||
      searchableNoteCount === 0 ||
      isContentIndexReady
    ) {
      setIsContentScanPending(false);
      if (!isSearchOpen || !shouldSearchContents) {
        shouldPruneAfterScanRef.current = true;
        pruneNoteContentsCacheToOpenNotes();
      }
      return;
    }

    shouldPruneAfterScanRef.current = false;

    if (contentScanPromiseRef.current) {
      setIsContentScanPending(true);
      return;
    }

    let cancelled = false;
    setIsContentScanPending(true);

    const promise = scanAllNotes()
      .catch((error: unknown) => {
        if (import.meta.env.DEV) {
          console.warn('[SidebarContent] scanAllNotes failed:', error);
        }
      })
      .finally(() => {
        if (contentScanPromiseRef.current === promise) {
          contentScanPromiseRef.current = null;
        }

        if (!cancelled) {
          setIsContentScanPending(false);
        }

        if (shouldPruneAfterScanRef.current) {
          pruneNoteContentsCacheToOpenNotes();
        }
      });

    contentScanPromiseRef.current = promise;

    return () => {
      cancelled = true;
    };
  }, [
    isContentIndexReady,
    isSearchOpen,
    pruneNoteContentsCacheToOpenNotes,
    scanAllNotes,
    searchableNoteCount,
    shouldSearchContents,
  ]);

  return {
    isContentScanPending,
    searchResults,
  };
}
