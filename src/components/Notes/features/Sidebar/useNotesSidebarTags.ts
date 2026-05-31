import { useEffect, useMemo, useRef, useState } from 'react';
import { getStorageAdapter, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import { normalizeSerializedMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';
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
const TAG_CONTENT_READ_BATCH_SIZE = 8;
const MAX_TAG_CONTENT_READ_BYTES = 10 * 1024 * 1024;

type SidebarTagContentCache = Map<string, { content: string }>;

async function readSidebarTagContent(path: string, currentVaultPath: string | null): Promise<string> {
  const storage = getStorageAdapter();
  const fullPath = isAbsolutePath(path)
    ? path
    : currentVaultPath
      ? await joinPath(currentVaultPath, path)
      : null;
  if (!fullPath) {
    return '';
  }

  try {
    const fileInfo = await storage.stat(fullPath).catch(() => null);
    if (typeof fileInfo?.size === 'number' && fileInfo.size > MAX_TAG_CONTENT_READ_BYTES) {
      return '';
    }
    return normalizeSerializedMarkdownDocument(await storage.readFile(fullPath));
  } catch {
    return '';
  }
}

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
  const [sidebarTagContentCache, setSidebarTagContentCache] = useState<SidebarTagContentCache>(
    () => new Map(),
  );
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
            : noteContentsCache.get(path)?.content ?? sidebarTagContentCache.get(path)?.content,
      );

      return buildNotesSidebarTagsFromTagIndex(index);
    },
    [
      liveNoteContent?.content,
      liveNoteContent?.path,
      noteContentsCache,
      scopeEntries,
      sidebarTagContentCache,
    ],
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
        !noteContentsCache.has(entry.path) &&
        !sidebarTagContentCache.has(entry.path),
    ),
    [liveNoteContent?.path, noteContentsCache, scopeEntries, sidebarTagContentCache],
  );

  const isTagIndexReady = scopeEntries.length > 0 && !missingIndexedContent;

  useEffect(() => {
    const scopedPaths = new Set(scopeEntries.map((entry) => entry.path));
    setSidebarTagContentCache((current) => {
      let changed = false;
      const next = new Map<string, { content: string }>();
      for (const [path, entry] of current) {
        if (scopedPaths.has(path)) {
          next.set(path, entry);
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [scopeEntries]);

  useEffect(() => {
    if (!active || scopeEntries.length === 0 || !missingIndexedContent) {
      return;
    }

    const missingPaths = scopeEntries
      .map((entry) => entry.path)
      .filter((path) =>
        liveNoteContent?.path !== path &&
        !noteContentsCache.has(path) &&
        !sidebarTagContentCache.has(path)
      );
    if (missingPaths.length === 0) {
      return;
    }

    let cancelled = false;
    const loadMissingContent = async () => {
      const loaded = new Map<string, { content: string }>();
      for (let index = 0; index < missingPaths.length; index += TAG_CONTENT_READ_BATCH_SIZE) {
        const batch = missingPaths.slice(index, index + TAG_CONTENT_READ_BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (path) => ({
            path,
            content: await readSidebarTagContent(path, currentVaultPath),
          })),
        );
        if (cancelled) {
          return;
        }
        for (const result of results) {
          loaded.set(result.path, { content: result.content });
        }
      }
      if (cancelled || loaded.size === 0) {
        return;
      }
      setSidebarTagContentCache((current) => {
        const next = new Map(current);
        for (const [path, entry] of loaded) {
          next.set(path, entry);
        }
        return next;
      });
    };

    void loadMissingContent();

    return () => {
      cancelled = true;
    };
  }, [
    active,
    currentVaultPath,
    liveNoteContent?.path,
    missingIndexedContent,
    noteContentsCache,
    scopeEntries,
    sidebarTagContentCache,
  ]);

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
