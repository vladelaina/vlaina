import { useEffect, useMemo, useRef, useState } from 'react';
import type { FolderNode } from '@/stores/useNotesStore';
import type { StarredEntry } from '@/stores/notes/types';
import {
  buildNotesSidebarSearchIndex,
  queryNotesSidebarSearch,
  shouldSearchNotesSidebarContents,
} from './notesSidebarSearchResults';

export function useSidebarContentSearchResults({
  rootFolder,
  getDisplayName,
  noteContentsCache,
  scanAllNotes,
  cancelNoteContentScan,
  pruneNoteContentsCacheToOpenNotes,
  searchQuery,
  isSearchOpen,
  starredEntries = [],
  currentVaultPath = null,
}: {
  rootFolder: FolderNode | null;
  getDisplayName: (path: string) => string;
  noteContentsCache: Map<string, { content: string }>;
  scanAllNotes: (options?: { signal?: AbortSignal }) => Promise<unknown>;
  cancelNoteContentScan: () => void;
  pruneNoteContentsCacheToOpenNotes: () => void;
  searchQuery: string;
  isSearchOpen: boolean;
  starredEntries?: StarredEntry[];
  currentVaultPath?: string | null;
}) {
  const contentScanPromiseRef = useRef<Promise<unknown> | null>(null);
  const contentScanAbortControllerRef = useRef<AbortController | null>(null);
  const shouldPruneAfterScanRef = useRef(false);
  const wasContentSearchActiveRef = useRef(false);
  const [isContentScanPending, setIsContentScanPending] = useState(false);

  const searchIndex = useMemo(
    () => buildNotesSidebarSearchIndex(rootFolder, getDisplayName, {
      currentVaultPath,
      starredEntries,
    }),
    [currentVaultPath, getDisplayName, rootFolder, starredEntries],
  );
  const contentSearchEntries = useMemo(
    () => searchIndex.filter((entry) => entry.contentSearchable !== false),
    [searchIndex],
  );
  const searchableNoteCount = contentSearchEntries.length;
  const shouldSearchContents = shouldSearchNotesSidebarContents(searchQuery);
  const isContentSearchActive =
    isSearchOpen && shouldSearchContents && searchableNoteCount > 0;
  const isContentIndexReady = useMemo(
    () =>
      searchableNoteCount > 0 &&
      contentSearchEntries.every((entry) => noteContentsCache.has(entry.path)),
    [contentSearchEntries, noteContentsCache, searchableNoteCount],
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
    const wasContentSearchActive = wasContentSearchActiveRef.current;
    wasContentSearchActiveRef.current = isContentSearchActive;

    if (!isContentSearchActive) {
      setIsContentScanPending(false);
      if (
        wasContentSearchActive ||
        contentScanPromiseRef.current ||
        contentScanAbortControllerRef.current
      ) {
        contentScanAbortControllerRef.current?.abort();
        contentScanAbortControllerRef.current = null;
        cancelNoteContentScan();
        shouldPruneAfterScanRef.current = true;
        pruneNoteContentsCacheToOpenNotes();
      }
      return;
    }

    if (isContentIndexReady) {
      setIsContentScanPending(false);
      return;
    }

    shouldPruneAfterScanRef.current = false;

    if (contentScanPromiseRef.current) {
      setIsContentScanPending(true);
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();
    contentScanAbortControllerRef.current?.abort();
    contentScanAbortControllerRef.current = abortController;
    setIsContentScanPending(true);

    const promise = scanAllNotes({ signal: abortController.signal })
      .catch((_error: unknown) => {
        if (import.meta.env.DEV) {
        }
      })
      .finally(() => {
        if (contentScanPromiseRef.current === promise) {
          contentScanPromiseRef.current = null;
        }
        if (contentScanAbortControllerRef.current === abortController) {
          contentScanAbortControllerRef.current = null;
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
    cancelNoteContentScan,
    isContentIndexReady,
    isContentSearchActive,
    pruneNoteContentsCacheToOpenNotes,
    scanAllNotes,
  ]);

  useEffect(() => {
    return () => {
      contentScanAbortControllerRef.current?.abort();
      cancelNoteContentScan();
    };
  }, [cancelNoteContentScan]);

  return {
    isContentScanPending,
    searchResults,
  };
}
