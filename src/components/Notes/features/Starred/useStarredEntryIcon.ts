import { useEffect, useMemo, useState } from 'react';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { readNoteMetadataFromMarkdown } from '@/stores/notes/frontmatter';
import {
  isValidStarredNotesRootPath,
  normalizeStarredRelativePath,
  normalizeStarredNotesRootPath,
} from '@/stores/notes/starred';
import type { StarredEntry } from '@/stores/notes/types';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';

const MAX_STARRED_ICON_CACHE_ENTRIES = 300;
const MAX_STARRED_ICON_METADATA_BYTES = 512 * 1024;
const MAX_CONCURRENT_STARRED_ICON_READS = 4;
const starredIconUtf8Encoder = new TextEncoder();

interface StarredIconCacheEntry {
  modifiedAt: number | null;
  size: number | null;
  icon: string | null;
}

const starredIconCache = new Map<string, StarredIconCacheEntry>();
const pendingStarredIconTasks: ScheduledStarredIconTask[] = [];
let activeStarredIconTaskCount = 0;

interface ScheduledStarredIconTask {
  run: () => Promise<void>;
}

function createAbortError() {
  const error = new Error('Starred icon metadata read aborted');
  error.name = 'AbortError';
  return error;
}

function runQueuedStarredIconTask() {
  while (
    activeStarredIconTaskCount < MAX_CONCURRENT_STARRED_ICON_READS &&
    pendingStarredIconTasks.length > 0
  ) {
    const scheduled = pendingStarredIconTasks.shift();
    if (!scheduled) {
      return;
    }

    activeStarredIconTaskCount += 1;
    void scheduled.run().finally(() => {
      activeStarredIconTaskCount -= 1;
      runQueuedStarredIconTask();
    });
  }
}

function scheduleStarredIconTask<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise<T>((resolve, reject) => {
    let scheduled: ScheduledStarredIconTask | null = null;
    const abortPendingTask = () => {
      if (!scheduled) {
        return;
      }

      const pendingIndex = pendingStarredIconTasks.indexOf(scheduled);
      if (pendingIndex === -1) {
        return;
      }

      pendingStarredIconTasks.splice(pendingIndex, 1);
      reject(createAbortError());
    };

    scheduled = {
      run: async () => {
        signal?.removeEventListener('abort', abortPendingTask);
        if (signal?.aborted) {
          reject(createAbortError());
          return;
        }

        try {
          resolve(await task());
        } catch (error) {
          reject(error);
        }
      },
    };

    signal?.addEventListener('abort', abortPendingTask, { once: true });
    pendingStarredIconTasks.push(scheduled);
    runQueuedStarredIconTask();
  });
}

function getStarredIconPathContext(entry: StarredEntry) {
  const relativePath = normalizeStarredRelativePath(entry.relativePath);
  if (!relativePath) {
    return null;
  }
  if (!isSupportedMarkdownPath(relativePath)) {
    return null;
  }

  const notesRootPath = normalizeStarredNotesRootPath(entry.notesRootPath);
  if (!isValidStarredNotesRootPath(notesRootPath)) {
    return null;
  }

  return {
    notesRootPath,
    relativePath,
    cacheKey: `${notesRootPath}/${relativePath}`,
  };
}

function touchStarredIconCacheEntry(cacheKey: string, entry: StarredIconCacheEntry) {
  starredIconCache.delete(cacheKey);
  starredIconCache.set(cacheKey, entry);
}

function setStarredIconCacheEntry(cacheKey: string, entry: StarredIconCacheEntry) {
  touchStarredIconCacheEntry(cacheKey, entry);

  while (starredIconCache.size > MAX_STARRED_ICON_CACHE_ENTRIES) {
    const oldestKey = starredIconCache.keys().next().value;
    if (oldestKey === undefined) {
      return;
    }
    starredIconCache.delete(oldestKey);
  }
}

function getFreshStarredIconCacheEntry(
  cacheKey: string,
  modifiedAt: number | null,
  size: number | null,
) {
  const cached = starredIconCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  const canValidateCache = modifiedAt !== null;
  if (!canValidateCache || cached.modifiedAt !== modifiedAt || cached.size !== size) {
    return null;
  }

  touchStarredIconCacheEntry(cacheKey, cached);
  return cached;
}

function canReadStarredIconMetadata(fileInfo: {
  isFile?: boolean;
  isDirectory?: boolean;
  size?: number | null;
} | null | undefined) {
  const size = fileInfo?.size;
  return (
    Boolean(fileInfo) &&
    fileInfo?.isDirectory !== true &&
    fileInfo?.isFile !== false &&
    (
      typeof size !== 'number' ||
      (Number.isFinite(size) && size >= 0 && size <= MAX_STARRED_ICON_METADATA_BYTES)
    )
  );
}

function getKnownStarredIconMetadataSize(fileInfo: { size?: number | null } | null | undefined): number | null {
  return typeof fileInfo?.size === 'number' && Number.isFinite(fileInfo.size) && fileInfo.size >= 0
    ? fileInfo.size
    : null;
}

function getKnownStarredIconModifiedAt(fileInfo: { modifiedAt?: number | null } | null | undefined): number | null {
  return typeof fileInfo?.modifiedAt === 'number' && Number.isFinite(fileInfo.modifiedAt)
    ? fileInfo.modifiedAt
    : null;
}

function isStarredIconMetadataWithinReadLimit(content: string): boolean {
  return (
    content.length <= MAX_STARRED_ICON_METADATA_BYTES &&
    starredIconUtf8Encoder.encode(content).length <= MAX_STARRED_ICON_METADATA_BYTES
  );
}

export function useStarredEntryIcon(entry: StarredEntry, enabled: boolean) {
  const pathContext = useMemo(
    () => getStarredIconPathContext(entry),
    [entry.relativePath, entry.notesRootPath],
  );
  const [icon, setIcon] = useState<string | undefined>(() => {
    const cached = pathContext ? starredIconCache.get(pathContext.cacheKey) : null;
    return cached?.modifiedAt !== null ? cached?.icon ?? undefined : undefined;
  });

  useEffect(() => {
    if (!enabled || entry.kind !== 'note') {
      setIcon(undefined);
      return;
    }
    if (!pathContext) {
      setIcon(undefined);
      return;
    }

    const cacheKey = pathContext.cacheKey;
    let cancelled = false;
    const abortController = new AbortController();
    void (async () => {
      try {
        await scheduleStarredIconTask(async () => {
          const fullPath = await joinPath(pathContext.notesRootPath, pathContext.relativePath);
          const storage = getStorageAdapter();
          const fileInfo = await storage.stat(fullPath).catch(() => null);
          const modifiedAt = getKnownStarredIconModifiedAt(fileInfo);
          const size = getKnownStarredIconMetadataSize(fileInfo);
          if (!canReadStarredIconMetadata(fileInfo)) {
            setStarredIconCacheEntry(cacheKey, {
              modifiedAt,
              size,
              icon: null,
            });
            if (!cancelled) {
              setIcon(undefined);
            }
            return;
          }

          const freshCached = getFreshStarredIconCacheEntry(cacheKey, modifiedAt, size);
          if (freshCached) {
            if (!cancelled) {
              setIcon(freshCached.icon ?? undefined);
            }
            return;
          }

          const content = await storage.readFile(fullPath, MAX_STARRED_ICON_METADATA_BYTES);
          const nextIcon = isStarredIconMetadataWithinReadLimit(content)
            ? readNoteMetadataFromMarkdown(content).icon ?? null
            : null;
          setStarredIconCacheEntry(cacheKey, {
            modifiedAt,
            size,
            icon: nextIcon,
          });
          if (!cancelled) {
            setIcon(nextIcon ?? undefined);
          }
        }, abortController.signal);
      } catch (error) {
        if (
          cancelled ||
          abortController.signal.aborted ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          return;
        }

        setStarredIconCacheEntry(cacheKey, {
          modifiedAt: null,
          size: null,
          icon: null,
        });
        if (!cancelled) {
          setIcon(undefined);
        }
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [enabled, entry.kind, pathContext]);

  return icon;
}
