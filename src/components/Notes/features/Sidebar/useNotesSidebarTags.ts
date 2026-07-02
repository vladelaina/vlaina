import { useEffect, useMemo, useRef, useState } from 'react';
import { getStorageAdapter, isAbsolutePath } from '@/lib/storage/adapter';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { normalizeSerializedMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';
import { assertEditorSafeMarkdownContent } from '@/stores/notes/document/noteDocumentPersistence';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import {
  hasUnsafeNotesRootPathSegment,
  normalizeNotesRootRelativePath,
  resolveNotesRootRelativeFullPath,
} from '@/stores/notes/utils/fs/notesRootPathContainment';
import type { StarredEntry } from '@/stores/notes/types';
import type { FolderNode } from '@/stores/useNotesStore';
import {
  buildNotesSidebarTagsFromTagIndex,
  buildNotesSidebarTagScopeEntries,
  createNotesSidebarTagIndex,
  reconcileNotesSidebarTagIndex,
  type NotesSidebarTagIndex,
  type NotesSidebarTagScopeEntry,
} from './notesSidebarTags';

const TAG_SCAN_IDLE_DELAY_MS = 250;
const TAG_CONTENT_READ_BATCH_SIZE = 8;
export const MAX_TAG_DIRECT_READ_MISSING_PATHS = 200;
export const MAX_TAG_AUTO_SCAN_SCOPE_ENTRIES = 500;
export const MAX_TAG_DIRECT_READ_CONTENT_CHARS = 8 * 1024 * 1024;
const MAX_TAG_CONTENT_READ_BYTES = 512 * 1024;
const tagContentUtf8Encoder = new TextEncoder();

type SidebarTagContentCacheEntry = {
  content: string;
  revision: number;
  notesRootPath: string | null;
};
type SidebarTagContentCache = Map<string, SidebarTagContentCacheEntry>;
type SidebarTagDirectReadBudget = {
  contentChars: number;
  revision: number;
  scopeKey: string;
  notesRootPath: string | null;
};

function isFreshSidebarTagContentEntry(
  entry: SidebarTagContentCacheEntry | undefined,
  revision: number,
  notesRootPath: string | null,
) {
  return entry?.revision === revision && entry.notesRootPath === notesRootPath;
}

function getSidebarTagScopeBudgetKey(entries: readonly NotesSidebarTagScopeEntry[]): string {
  const firstPath = entries[0]?.path ?? '';
  const lastPath = entries[entries.length - 1]?.path ?? '';
  return `${entries.length}\n${firstPath}\n${lastPath}`;
}

function hasUnsafeSidebarTagPathSegment(path: string): boolean {
  return hasUnsafeNotesRootPathSegment(path);
}

function isAllowedSidebarTagContentPath(path: string, currentNotesRootPath: string | null): boolean {
  if (!isSupportedMarkdownPath(path)) {
    return false;
  }

  if (
    hasInternalNotePathSegment(path) ||
    hasUnsafeSidebarTagPathSegment(path) ||
    (currentNotesRootPath && (
      hasInternalNotePathSegment(currentNotesRootPath) ||
      hasUnsafeSidebarTagPathSegment(currentNotesRootPath)
    ))
  ) {
    return false;
  }

  return isAbsolutePath(path) || normalizeNotesRootRelativePath(path) !== null;
}

function isSidebarTagContentWithinReadLimit(content: string): boolean {
  return (
    content.length <= MAX_TAG_CONTENT_READ_BYTES &&
    tagContentUtf8Encoder.encode(content).length <= MAX_TAG_CONTENT_READ_BYTES
  );
}

async function readSidebarTagContent(path: string, currentNotesRootPath: string | null): Promise<string> {
  if (!isAllowedSidebarTagContentPath(path, currentNotesRootPath)) {
    return '';
  }

  const storage = getStorageAdapter();
  const fullPath = isAbsolutePath(path)
    ? path
    : currentNotesRootPath
      ? await resolveNotesRootRelativeFullPath(currentNotesRootPath, path)
          .then((result) => result.fullPath)
          .catch(() => null)
      : null;
  if (!fullPath) {
    return '';
  }

  try {
    const fileInfo = await storage.stat(fullPath).catch(() => null);
    if (
      !fileInfo ||
      fileInfo?.isDirectory === true ||
      fileInfo?.isFile === false ||
      (
        typeof fileInfo.size === 'number' &&
        (!Number.isFinite(fileInfo.size) || fileInfo.size < 0 || fileInfo.size > MAX_TAG_CONTENT_READ_BYTES)
      )
    ) {
      return '';
    }
    const content = await storage.readFile(fullPath, MAX_TAG_CONTENT_READ_BYTES);
    if (!isSidebarTagContentWithinReadLimit(content)) {
      return '';
    }
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
  const directReadBudgetRef = useRef<SidebarTagDirectReadBudget | null>(null);
  const [isTagScanPending, setIsTagScanPending] = useState(false);
  const [scanCompletionRevision, setScanCompletionRevision] = useState(0);
  const [sidebarTagContentCache, setSidebarTagContentCache] = useState<SidebarTagContentCache>(
    () => new Map(),
  );
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
  const scopeBudgetKey = useMemo(
    () => getSidebarTagScopeBudgetKey(scopeEntries),
    [scopeEntries],
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
                  currentNotesRootPath,
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
      currentNotesRootPath,
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
          currentNotesRootPath,
        ),
    ),
    [currentNotesRootPath, liveNoteContent?.path, noteContentsCache, noteContentsCacheRevision, scopeEntries, sidebarTagContentCache],
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
          isFreshSidebarTagContentEntry(entry, noteContentsCacheRevision, currentNotesRootPath)
        ) {
          next.set(path, entry);
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [currentNotesRootPath, noteContentsCacheRevision, scopeEntries]);

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
          currentEntry.notesRootPath === currentNotesRootPath
        ) {
          continue;
        }

        next.set(entry.path, {
          content: cachedContent,
          revision: noteContentsCacheRevision,
          notesRootPath: currentNotesRootPath,
        });
        changed = true;
      }

      return changed ? next : current;
    });
  }, [currentNotesRootPath, noteContentsCache, noteContentsCacheRevision, scopeEntries]);

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
          currentNotesRootPath,
        )
      );
    if (missingPaths.length === 0 || missingPaths.length > MAX_TAG_DIRECT_READ_MISSING_PATHS) {
      return;
    }

    let directReadBudget = directReadBudgetRef.current;
    if (
      !directReadBudget ||
      directReadBudget.scopeKey !== scopeBudgetKey ||
      directReadBudget.revision !== noteContentsCacheRevision ||
      directReadBudget.notesRootPath !== currentNotesRootPath
    ) {
      directReadBudget = {
        contentChars: 0,
        revision: noteContentsCacheRevision,
        scopeKey: scopeBudgetKey,
        notesRootPath: currentNotesRootPath,
      };
      directReadBudgetRef.current = directReadBudget;
    }
    if (directReadBudget.contentChars >= MAX_TAG_DIRECT_READ_CONTENT_CHARS) {
      return;
    }

    const activeDirectReadBudget = directReadBudget;
    let cancelled = false;
    const loadMissingContent = async () => {
      const loaded: SidebarTagContentCache = new Map();
      for (let index = 0; index < missingPaths.length;) {
        if (activeDirectReadBudget.contentChars >= MAX_TAG_DIRECT_READ_CONTENT_CHARS) {
          break;
        }

        const remainingBatchCapacity = Math.floor(
          (MAX_TAG_DIRECT_READ_CONTENT_CHARS - activeDirectReadBudget.contentChars) / MAX_TAG_CONTENT_READ_BYTES,
        );
        if (remainingBatchCapacity <= 0) {
          break;
        }

        const batch = missingPaths.slice(
          index,
          index + Math.min(TAG_CONTENT_READ_BATCH_SIZE, remainingBatchCapacity),
        );
        index += batch.length;
        const reservedContentChars = batch.length * MAX_TAG_CONTENT_READ_BYTES;
        activeDirectReadBudget.contentChars += reservedContentChars;
        const results = await Promise.all(
          batch.map(async (path) => ({
            path,
            content: await readSidebarTagContent(path, currentNotesRootPath),
          })),
        );
        if (cancelled) {
          return;
        }
        if (directReadBudgetRef.current !== activeDirectReadBudget) {
          return;
        }
        activeDirectReadBudget.contentChars = Math.max(
          0,
          activeDirectReadBudget.contentChars - reservedContentChars,
        );
        for (const result of results) {
          if (activeDirectReadBudget.contentChars + result.content.length > MAX_TAG_DIRECT_READ_CONTENT_CHARS) {
            continue;
          }

          activeDirectReadBudget.contentChars += result.content.length;
          loaded.set(result.path, {
            content: result.content,
            revision: noteContentsCacheRevision,
            notesRootPath: currentNotesRootPath,
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

    void loadMissingContent().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [
    active,
    currentNotesRootPath,
    liveNoteContent?.path,
    missingIndexedContent,
    noteContentsCache,
    noteContentsCacheRevision,
    scopeBudgetKey,
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

    if (
      !active ||
      scopeEntries.length === 0 ||
      scopeEntries.length > MAX_TAG_AUTO_SCAN_SCOPE_ENTRIES ||
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
