import { useEffect, useMemo, useRef, useState } from 'react';
import { getStorageAdapter, isAbsolutePath } from '@/lib/storage/adapter';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { normalizeSerializedMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';
import { assertEditorSafeMarkdownContent } from '@/stores/notes/document/noteDocumentPersistence';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import {
  isSafeVaultPathSegment,
  normalizeVaultRelativePath,
  resolveVaultRelativeFullPath,
} from '@/stores/notes/utils/fs/vaultPathContainment';
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
export const MAX_TAG_DIRECT_READ_MISSING_PATHS = 200;
const MAX_TAG_CONTENT_READ_BYTES = 512 * 1024;

type SidebarTagContentCacheEntry = {
  content: string;
  revision: number;
  vaultPath: string | null;
};
type SidebarTagContentCache = Map<string, SidebarTagContentCacheEntry>;

function isFreshSidebarTagContentEntry(
  entry: SidebarTagContentCacheEntry | undefined,
  revision: number,
  vaultPath: string | null,
) {
  return entry?.revision === revision && entry.vaultPath === vaultPath;
}

function hasUnsafeSidebarTagPathSegment(path: string): boolean {
  return path
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .some((segment) => !isSafeVaultPathSegment(segment));
}

function isAllowedSidebarTagContentPath(path: string, currentVaultPath: string | null): boolean {
  if (!isSupportedMarkdownPath(path)) {
    return false;
  }

  if (
    hasInternalNotePathSegment(path) ||
    hasUnsafeSidebarTagPathSegment(path) ||
    (currentVaultPath && (
      hasInternalNotePathSegment(currentVaultPath) ||
      hasUnsafeSidebarTagPathSegment(currentVaultPath)
    ))
  ) {
    return false;
  }

  return isAbsolutePath(path) || normalizeVaultRelativePath(path) !== null;
}

async function readSidebarTagContent(path: string, currentVaultPath: string | null): Promise<string> {
  if (!isAllowedSidebarTagContentPath(path, currentVaultPath)) {
    return '';
  }

  const storage = getStorageAdapter();
  const fullPath = isAbsolutePath(path)
    ? path
    : currentVaultPath
      ? await resolveVaultRelativeFullPath(currentVaultPath, path)
          .then((result) => result.fullPath)
          .catch(() => null)
      : null;
  if (!fullPath) {
    return '';
  }

  try {
    const fileInfo = await storage.stat(fullPath).catch(() => null);
    if (
      fileInfo?.isDirectory === true ||
      fileInfo?.isFile === false ||
      typeof fileInfo?.size !== 'number' ||
      fileInfo.size > MAX_TAG_CONTENT_READ_BYTES
    ) {
      return '';
    }
    const content = await storage.readFile(fullPath);
    assertEditorSafeMarkdownContent(content);
    return normalizeSerializedMarkdownDocument(content);
  } catch {
    return '';
  }
}

export function useNotesSidebarTags({
  rootFolder,
  noteContentsCache,
  noteContentsCacheRevision = 0,
  liveNoteContent,
  scanAllNotes,
  starredEntries = [],
  currentVaultPath = null,
  active = true,
}: {
  rootFolder: FolderNode | null;
  noteContentsCache: Map<string, { content: string }>;
  noteContentsCacheRevision?: number;
  liveNoteContent?: { path: string; content: string } | null;
  scanAllNotes: (options?: { signal?: AbortSignal }) => Promise<unknown>;
  starredEntries?: StarredEntry[];
  currentVaultPath?: string | null;
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
  const [sidebarTagContentCache, setSidebarTagContentCache] = useState<SidebarTagContentCache>(
    () => new Map(),
  );
  const isInternalTagVaultPath = currentVaultPath
    ? hasInternalNotePathSegment(currentVaultPath)
    : false;
  const scopeEntries = useMemo(
    () => {
      if (isInternalTagVaultPath) {
        return [];
      }

      return buildNotesSidebarTagScopeEntries({
        rootFolder,
        starredEntries,
        currentVaultPath,
      });
    },
    [currentVaultPath, isInternalTagVaultPath, rootFolder, starredEntries],
  );
  const tags = useMemo(
    () => {
      const index = reconcileNotesSidebarTagIndex(
        tagIndexRef.current,
        scopeEntries,
        (path) =>
          liveNoteContent?.path === path
            ? liveNoteContent.content
            : noteContentsCache.get(path)?.content ??
              (
                isFreshSidebarTagContentEntry(
                  sidebarTagContentCache.get(path),
                  noteContentsCacheRevision,
                  currentVaultPath,
                )
                  ? sidebarTagContentCache.get(path)?.content
                  : undefined
              ),
      );

      return buildNotesSidebarTagsFromTagIndex(index);
    },
    [
      liveNoteContent?.content,
      liveNoteContent?.path,
      noteContentsCache,
      noteContentsCacheRevision,
      currentVaultPath,
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
        !isFreshSidebarTagContentEntry(
          sidebarTagContentCache.get(entry.path),
          noteContentsCacheRevision,
          currentVaultPath,
        ),
    ),
    [currentVaultPath, liveNoteContent?.path, noteContentsCache, noteContentsCacheRevision, scopeEntries, sidebarTagContentCache],
  );

  const isTagIndexReady = scopeEntries.length > 0 && !missingIndexedContent;

  useEffect(() => {
    const scopedPaths = new Set(scopeEntries.map((entry) => entry.path));
    setSidebarTagContentCache((current) => {
      let changed = false;
      const next: SidebarTagContentCache = new Map();
      for (const [path, entry] of current) {
        if (
          scopedPaths.has(path) &&
          isFreshSidebarTagContentEntry(entry, noteContentsCacheRevision, currentVaultPath)
        ) {
          next.set(path, entry);
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [currentVaultPath, noteContentsCacheRevision, scopeEntries]);

  useEffect(() => {
    if (noteContentsCache.size === 0 || scopeEntries.length === 0) {
      return;
    }

    setSidebarTagContentCache((current) => {
      let changed = false;
      const next = new Map(current);

      for (const entry of scopeEntries) {
        const cachedContent = noteContentsCache.get(entry.path)?.content;
        if (cachedContent === undefined) {
          continue;
        }

        const currentEntry = next.get(entry.path);
        if (
          currentEntry?.content === cachedContent &&
          currentEntry.revision === noteContentsCacheRevision &&
          currentEntry.vaultPath === currentVaultPath
        ) {
          continue;
        }

        next.set(entry.path, {
          content: cachedContent,
          revision: noteContentsCacheRevision,
          vaultPath: currentVaultPath,
        });
        changed = true;
      }

      return changed ? next : current;
    });
  }, [currentVaultPath, noteContentsCache, noteContentsCacheRevision, scopeEntries]);

  useEffect(() => {
    if (!active || scopeEntries.length === 0 || !missingIndexedContent) {
      return;
    }

    const missingPaths = scopeEntries
      .map((entry) => entry.path)
      .filter((path) =>
        liveNoteContent?.path !== path &&
        !noteContentsCache.has(path) &&
        !isFreshSidebarTagContentEntry(
          sidebarTagContentCache.get(path),
          noteContentsCacheRevision,
          currentVaultPath,
        )
      );
    if (missingPaths.length === 0 || missingPaths.length > MAX_TAG_DIRECT_READ_MISSING_PATHS) {
      return;
    }

    let cancelled = false;
    const loadMissingContent = async () => {
      const loaded: SidebarTagContentCache = new Map();
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
          loaded.set(result.path, {
            content: result.content,
            revision: noteContentsCacheRevision,
            vaultPath: currentVaultPath,
          });
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
    noteContentsCacheRevision,
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
  }, [active, isTagIndexReady, scanAllNotes, scanCompletionRevision, scopeEntries]);

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
