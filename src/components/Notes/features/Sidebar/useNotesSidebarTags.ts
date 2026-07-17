import { useEffect, useMemo, useRef, useState } from 'react';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import type { StarredEntry } from '@/stores/notes/types';
import type { FolderNode } from '@/stores/useNotesStore';
import {
  buildNotesSidebarTagsFromTagIndex,
  buildNotesSidebarTagScopeEntries,
  createNotesSidebarTagIndex,
  reconcileNotesSidebarTagIndex,
  type NotesSidebarTagIndex,
} from './notesSidebarTags';
import {
  isFreshSidebarTagContentEntry,
  useNotesSidebarTagContentCache,
  MAX_TAG_DIRECT_READ_CONTENT_CHARS,
  MAX_TAG_DIRECT_READ_MISSING_PATHS,
} from './useNotesSidebarTagContentCache';

const TAG_SCAN_IDLE_DELAY_MS = 250;
export const MAX_TAG_AUTO_SCAN_SCOPE_ENTRIES = 500;

export {
  MAX_TAG_DIRECT_READ_CONTENT_CHARS,
  MAX_TAG_DIRECT_READ_MISSING_PATHS,
};

export function useNotesSidebarTags({
  rootFolder,
  noteContentsCache,
  noteContentsCacheRevision = 0,
  liveNoteContent,
  scanAllNotes,
  starredEntries = [],
  currentNotesRootPath = null,
  active = true,
}: {
  rootFolder: FolderNode | null;
  noteContentsCache: Map<string, { content: string }>;
  noteContentsCacheRevision?: number;
  liveNoteContent?: { path: string; content: string } | null;
  scanAllNotes: (options?: { signal?: AbortSignal }) => Promise<unknown>;
  starredEntries?: StarredEntry[];
  currentNotesRootPath?: string | null;
  active?: boolean;
}) {
  const scanPromiseRef = useRef<Promise<unknown> | null>(null);
  const scanAbortControllerRef = useRef<AbortController | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const scanInvalidatedWhileRunningRef = useRef(false);
  const tagIndexRef = useRef<NotesSidebarTagIndex>(createNotesSidebarTagIndex());
  const [isTagScanPending, setIsTagScanPending] = useState(false);
  const [scanCompletionRevision, setScanCompletionRevision] = useState(0);
  const isInternalTagNotesRootPath = currentNotesRootPath
    ? hasInternalNotePathSegment(currentNotesRootPath)
    : false;
  const scopeEntries = useMemo(
    () => {
      if (isInternalTagNotesRootPath) {
        return [];
      }

      return buildNotesSidebarTagScopeEntries({
        rootFolder,
        starredEntries,
        currentNotesRootPath,
      });
    },
    [currentNotesRootPath, isInternalTagNotesRootPath, rootFolder, starredEntries],
  );
  const missingIndexedContent = useMemo(
    () => scopeEntries.some(
      (entry) =>
        liveNoteContent?.path !== entry.path &&
        !noteContentsCache.has(entry.path),
    ),
    [liveNoteContent?.path, noteContentsCache, scopeEntries],
  );
  const missingIndexedContentCount = useMemo(
    () => scopeEntries.filter(
      (entry) =>
        liveNoteContent?.path !== entry.path &&
        !noteContentsCache.has(entry.path),
    ).length,
    [liveNoteContent?.path, noteContentsCache, scopeEntries],
  );
  const shouldUseDirectReads = missingIndexedContentCount > 0
    && missingIndexedContentCount <= MAX_TAG_DIRECT_READ_MISSING_PATHS;
  const sidebarTagContentCache = useNotesSidebarTagContentCache({
    active,
    currentNotesRootPath,
    liveNoteContentPath: liveNoteContent?.path,
    missingIndexedContent,
    noteContentsCache,
    noteContentsCacheRevision,
    scopeEntries,
  });
  const tags = useMemo(
    () => {
      const getContentSource = (path: string) => {
        if (liveNoteContent?.path === path) {
          return liveNoteContent;
        }

        const cachedNote = noteContentsCache.get(path);
        if (cachedNote) {
          return cachedNote;
        }

        const sidebarCachedNote = sidebarTagContentCache.get(path);
        return isFreshSidebarTagContentEntry(
          sidebarCachedNote,
          noteContentsCacheRevision,
          currentNotesRootPath,
        )
          ? sidebarCachedNote
          : undefined;
      };
      const index = reconcileNotesSidebarTagIndex(
        tagIndexRef.current,
        scopeEntries,
        (path) => getContentSource(path)?.content,
        getContentSource,
      );

      return buildNotesSidebarTagsFromTagIndex(index);
    },
    [
      liveNoteContent?.content,
      liveNoteContent?.path,
      noteContentsCache,
      noteContentsCacheRevision,
      currentNotesRootPath,
      scopeEntries,
      sidebarTagContentCache,
    ],
  );
  const missingIndexedContentAfterDirectRead = useMemo(
    () => scopeEntries.some(
      (entry) =>
        liveNoteContent?.path !== entry.path &&
        !noteContentsCache.has(entry.path) &&
        !isFreshSidebarTagContentEntry(
          sidebarTagContentCache.get(entry.path),
          noteContentsCacheRevision,
          currentNotesRootPath,
        ),
    ),
    [currentNotesRootPath, liveNoteContent?.path, noteContentsCache, noteContentsCacheRevision, scopeEntries, sidebarTagContentCache],
  );
  const isTagIndexReady = scopeEntries.length > 0 && !missingIndexedContentAfterDirectRead;

  useEffect(() => {
    if (scopeEntries.length > 0) {
      return;
    }

    tagIndexRef.current.paths.clear();
    tagIndexRef.current.tags.clear();
  }, [scopeEntries.length]);

  useEffect(() => {
    return () => {
      tagIndexRef.current.paths.clear();
      tagIndexRef.current.tags.clear();
    };
  }, []);

  useEffect(() => {
    const clearPendingScanTimer = () => {
      if (scanTimerRef.current !== null) {
        window.clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };

    if (
      !active ||
      scopeEntries.length === 0 ||
      scopeEntries.length > MAX_TAG_AUTO_SCAN_SCOPE_ENTRIES ||
      shouldUseDirectReads ||
      isTagIndexReady
    ) {
      setIsTagScanPending(false);
      clearPendingScanTimer();
      scanAbortControllerRef.current?.abort();
      scanAbortControllerRef.current = null;
      return;
    }

    if (scanPromiseRef.current) {
      scanInvalidatedWhileRunningRef.current = true;
      setIsTagScanPending(true);
      return;
    }

    const abortController = new AbortController();
    scanInvalidatedWhileRunningRef.current = false;
    scanAbortControllerRef.current?.abort();
    scanAbortControllerRef.current = abortController;
    setIsTagScanPending(true);

    scanTimerRef.current = window.setTimeout(() => {
      scanTimerRef.current = null;
      const promise = scanAllNotes({ signal: abortController.signal })
        .catch((_error: unknown) => {
          if (import.meta.env.DEV) {
          }
        })
        .finally(() => {
          if (scanPromiseRef.current === promise) {
            scanPromiseRef.current = null;
          }
          if (scanAbortControllerRef.current === abortController) {
            scanAbortControllerRef.current = null;
          }
          const shouldRecheckScan = scanInvalidatedWhileRunningRef.current;
          scanInvalidatedWhileRunningRef.current = false;
          if (isMountedRef.current) {
            setIsTagScanPending(false);
            if (shouldRecheckScan) {
              setScanCompletionRevision((revision) => revision + 1);
            }
          }
        });

      scanPromiseRef.current = promise;
    }, TAG_SCAN_IDLE_DELAY_MS);

    return () => {
      clearPendingScanTimer();
    };
  }, [active, isTagIndexReady, scanAllNotes, scanCompletionRevision, scopeEntries, shouldUseDirectReads]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (scanTimerRef.current !== null) {
        window.clearTimeout(scanTimerRef.current);
      }
      scanAbortControllerRef.current?.abort();
    };
  }, []);

  return {
    isTagScanPending,
    tags,
  };
}
