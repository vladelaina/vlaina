import { useEffect, useMemo, useRef, useState } from 'react';
import type { StarredEntry } from '@/stores/notes/types';
import type { FolderNode } from '@/stores/useNotesStore';
import {
  buildNotesSidebarTagsFromTagIndex,
  buildNotesSidebarTagScopeEntries,
  createNotesSidebarTagIndex,
  reconcileNotesSidebarTagIndex,
  type NotesSidebarTagIndex,
} from './notesSidebarTags';

const TAG_SCAN_IDLE_DELAY_MS = 250;

export function useNotesSidebarTags({
  rootFolder,
  noteContentsCache,
  liveNoteContent,
  scanAllNotes,
  starredEntries = [],
  currentVaultPath = null,
  active = true,
}: {
  rootFolder: FolderNode | null;
  noteContentsCache: Map<string, { content: string }>;
  liveNoteContent?: { path: string; content: string } | null;
  scanAllNotes: (options?: { signal?: AbortSignal }) => Promise<unknown>;
  starredEntries?: StarredEntry[];
  currentVaultPath?: string | null;
  active?: boolean;
}) {
  const scanPromiseRef = useRef<Promise<unknown> | null>(null);
  const scanAbortControllerRef = useRef<AbortController | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const tagIndexRef = useRef<NotesSidebarTagIndex>(createNotesSidebarTagIndex());
  const [isTagScanPending, setIsTagScanPending] = useState(false);
  const scopeEntries = useMemo(
    () => buildNotesSidebarTagScopeEntries({
      rootFolder,
      starredEntries,
      currentVaultPath,
    }),
    [currentVaultPath, rootFolder, starredEntries],
  );
  const tags = useMemo(
    () => {
      const index = reconcileNotesSidebarTagIndex(
        tagIndexRef.current,
        scopeEntries,
        (path) =>
          liveNoteContent?.path === path
            ? liveNoteContent.content
            : noteContentsCache.get(path)?.content,
      );

      return buildNotesSidebarTagsFromTagIndex(index);
    },
    [liveNoteContent?.content, liveNoteContent?.path, noteContentsCache, scopeEntries],
  );

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

  const missingIndexedContent = useMemo(
    () => scopeEntries.some(
      (entry) =>
        liveNoteContent?.path !== entry.path &&
        !noteContentsCache.has(entry.path),
    ),
    [liveNoteContent?.path, noteContentsCache, scopeEntries],
  );

  const isTagIndexReady = scopeEntries.length > 0 && !missingIndexedContent;

  useEffect(() => {
    const clearPendingScanTimer = () => {
      if (scanTimerRef.current !== null) {
        window.clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };

    if (!active || scopeEntries.length === 0 || isTagIndexReady) {
      setIsTagScanPending(false);
      clearPendingScanTimer();
      if (!active || scopeEntries.length === 0) {
        scanAbortControllerRef.current?.abort();
        scanAbortControllerRef.current = null;
      }
      return;
    }

    if (scanPromiseRef.current) {
      setIsTagScanPending(true);
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();
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
          if (!cancelled) {
            setIsTagScanPending(false);
          }
        });

      scanPromiseRef.current = promise;
    }, TAG_SCAN_IDLE_DELAY_MS);

    return () => {
      cancelled = true;
      clearPendingScanTimer();
    };
  }, [active, isTagIndexReady, scanAllNotes, scopeEntries.length]);

  useEffect(() => {
    return () => {
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
