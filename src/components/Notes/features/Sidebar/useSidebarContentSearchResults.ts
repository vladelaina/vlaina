import { useEffect, useMemo, useRef, useState } from 'react';
import type { FolderNode } from '@/stores/useNotesStore';
import type { StarredEntry } from '@/stores/notes/types';
import {
  buildNotesSidebarSearchIndex,
  NOTES_SIDEBAR_MAX_SEARCH_RESULTS,
  queryNotesSidebarSearch,
  queryNotesSidebarStructuralSearch,
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
  const isMountedRef = useRef(true);
  const scanInvalidatedWhileRunningRef = useRef(false);
  const shouldPruneAfterScanRef = useRef(false);
  const wasContentSearchActiveRef = useRef(false);
  const [isContentScanPending, setIsContentScanPending] = useState(false);
  const [scanCompletionRevision, setScanCompletionRevision] = useState(0);

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
  const structuralSearchResults = useMemo(
    () => queryNotesSidebarStructuralSearch(searchIndex, searchQuery),
    [searchIndex, searchQuery],
  );
  const structuralResultsFillLimit =
    structuralSearchResults.length >= NOTES_SIDEBAR_MAX_SEARCH_RESULTS;
  const isContentSearchActive =
    isSearchOpen && shouldSearchContents && searchableNoteCount > 0 && !structuralResultsFillLimit;
  const isContentIndexReady = useMemo(
    () =>
      searchableNoteCount > 0 &&
      contentSearchEntries.every((entry) => noteContentsCache.has(entry.path)),
    [contentSearchEntries, noteContentsCache, searchableNoteCount],
  );

  const searchResults = useMemo(
    () => {
      if (!shouldSearchContents || structuralResultsFillLimit) {
        return structuralSearchResults;
      }

      return queryNotesSidebarSearch(
        searchIndex,
        searchQuery,
        (path) => noteContentsCache.get(path)?.content,
        structuralSearchResults,
      );
    },
    [
      noteContentsCache,
      searchIndex,
      searchQuery,
      shouldSearchContents,
      structuralResultsFillLimit,
      structuralSearchResults,
    ],
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
      scanInvalidatedWhileRunningRef.current = true;
      setIsContentScanPending(true);
      return;
    }

    const abortController = new AbortController();
    scanInvalidatedWhileRunningRef.current = false;
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

        const shouldRecheckScan = scanInvalidatedWhileRunningRef.current;
        scanInvalidatedWhileRunningRef.current = false;
        if (isMountedRef.current) {
          setIsContentScanPending(false);
          if (shouldRecheckScan) {
            setScanCompletionRevision((revision) => revision + 1);
          }
        }

        if (shouldPruneAfterScanRef.current) {
          pruneNoteContentsCacheToOpenNotes();
        }
      });

    contentScanPromiseRef.current = promise;
  }, [
    cancelNoteContentScan,
    contentSearchEntries,
    isContentIndexReady,
    isContentSearchActive,
    pruneNoteContentsCacheToOpenNotes,
    scanCompletionRevision,
    scanAllNotes,
  ]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      contentScanAbortControllerRef.current?.abort();
      cancelNoteContentScan();
    };
  }, [cancelNoteContentScan]);

  return {
    isContentScanPending,
    searchResults,
  };
}
