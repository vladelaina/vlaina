import { getStorageAdapter, isAbsolutePath } from '@/lib/storage/adapter';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { readNoteMetadataFromMarkdown } from '@/stores/notes/frontmatter';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import {
  hasUnsafeNotesRootPathSegment,
  normalizeNotesRootRelativePath,
  resolveNotesRootRelativeFullPath,
} from '@/stores/notes/utils/fs/notesRootPathContainment';

const MAX_TAG_NOTE_ICON_CACHE_ENTRIES = 300;
const MAX_TAG_NOTE_ICON_METADATA_BYTES = 512 * 1024;
export const MAX_CONCURRENT_TAG_NOTE_ICON_METADATA_READS = 4;
const tagNoteIconUtf8Encoder = new TextEncoder();

interface TagNoteIconCacheEntry {
  modifiedAt: number | null;
  size: number | null;
  icon: string | null;
}

const tagNoteIconCache = new Map<string, TagNoteIconCacheEntry>();
const pendingTagNoteIconMetadataReads: ScheduledTagNoteIconRead[] = [];
let activeTagNoteIconMetadataReads = 0;

interface ScheduledTagNoteIconRead {
  run: () => Promise<void>;
}

function createAbortError() {
  const error = new Error('Tag note icon metadata read aborted');
  error.name = 'AbortError';
  return error;
}

function drainTagNoteIconMetadataReadQueue() {
  while (
    activeTagNoteIconMetadataReads < MAX_CONCURRENT_TAG_NOTE_ICON_METADATA_READS &&
    pendingTagNoteIconMetadataReads.length > 0
  ) {
    const scheduled = pendingTagNoteIconMetadataReads.shift();
    if (!scheduled) {
      return;
    }

    activeTagNoteIconMetadataReads += 1;
    void scheduled.run().finally(() => {
      activeTagNoteIconMetadataReads -= 1;
      drainTagNoteIconMetadataReadQueue();
    });
  }
}

function scheduleTagNoteIconMetadataRead(
  task: () => Promise<TagNoteIconCacheEntry>,
  signal?: AbortSignal,
): Promise<TagNoteIconCacheEntry> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    let scheduled: ScheduledTagNoteIconRead | null = null;
    const abortPendingRead = () => {
      if (!scheduled) {
        return;
      }

      const pendingIndex = pendingTagNoteIconMetadataReads.indexOf(scheduled);
      if (pendingIndex === -1) {
        return;
      }

      pendingTagNoteIconMetadataReads.splice(pendingIndex, 1);
      reject(createAbortError());
    };

    scheduled = {
      run: async () => {
        signal?.removeEventListener('abort', abortPendingRead);
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

    signal?.addEventListener('abort', abortPendingRead, { once: true });
    pendingTagNoteIconMetadataReads.push(scheduled);
    drainTagNoteIconMetadataReadQueue();
  });
}

export function setTagNoteIconCacheEntry(cacheKey: string, entry: TagNoteIconCacheEntry) {
  tagNoteIconCache.delete(cacheKey);
  tagNoteIconCache.set(cacheKey, entry);

  while (tagNoteIconCache.size > MAX_TAG_NOTE_ICON_CACHE_ENTRIES) {
    const oldestKey = tagNoteIconCache.keys().next().value;
    if (oldestKey === undefined) {
      return;
    }
    tagNoteIconCache.delete(oldestKey);
  }
}

export function getCachedTagNoteIcon(cacheKey: string) {
  return tagNoteIconCache.get(cacheKey)?.icon ?? undefined;
}

function touchTagNoteIconCacheEntry(cacheKey: string, entry: TagNoteIconCacheEntry) {
  tagNoteIconCache.delete(cacheKey);
  tagNoteIconCache.set(cacheKey, entry);
}

function getFreshTagNoteIconCacheEntry(
  cacheKey: string,
  modifiedAt: number | null,
  size: number | null,
): TagNoteIconCacheEntry | null {
  const cached = tagNoteIconCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  const canValidateCache = modifiedAt !== null;
  if (!canValidateCache || cached.modifiedAt !== modifiedAt || cached.size !== size) {
    return null;
  }

  touchTagNoteIconCacheEntry(cacheKey, cached);
  return cached;
}

function isTagNoteIconMetadataWithinReadLimit(content: string): boolean {
  return (
    content.length <= MAX_TAG_NOTE_ICON_METADATA_BYTES &&
    tagNoteIconUtf8Encoder.encode(content).length <= MAX_TAG_NOTE_ICON_METADATA_BYTES
  );
}

function getKnownTagNoteIconMetadataSize(fileInfo: { size?: number | null } | null | undefined): number | null {
  return typeof fileInfo?.size === 'number' && Number.isFinite(fileInfo.size) && fileInfo.size >= 0
    ? fileInfo.size
    : null;
}

function getKnownTagNoteIconModifiedAt(fileInfo: { modifiedAt?: number | null } | null | undefined): number | null {
  return typeof fileInfo?.modifiedAt === 'number' && Number.isFinite(fileInfo.modifiedAt)
    ? fileInfo.modifiedAt
    : null;
}

function isAllowedTagNoteIconMetadataPath(path: string, notesRootPath: string | null): boolean {
  if (!isSupportedMarkdownPath(path)) {
    return false;
  }

  if (
    hasInternalNotePathSegment(path) ||
    hasUnsafeNotesRootPathSegment(path) ||
    (notesRootPath && (
      hasInternalNotePathSegment(notesRootPath) ||
      hasUnsafeNotesRootPathSegment(notesRootPath)
    ))
  ) {
    return false;
  }

  return isAbsolutePath(path) || normalizeNotesRootRelativePath(path) !== null;
}

async function readTagNoteIconFromStorage(path: string, notesRootPath: string | null, cacheKey: string): Promise<TagNoteIconCacheEntry> {
  if (!isAllowedTagNoteIconMetadataPath(path, notesRootPath)) {
    return { modifiedAt: null, size: null, icon: null };
  }

  const fullPath = isAbsolutePath(path)
    ? path
    : notesRootPath
      ? await resolveNotesRootRelativeFullPath(notesRootPath, path)
          .then((result) => result.fullPath)
          .catch(() => null)
      : null;
  if (!fullPath) {
    return { modifiedAt: null, size: null, icon: null };
  }

  const storage = getStorageAdapter();
  const fileInfo = await storage.stat(fullPath).catch(() => null);
  const modifiedAt = getKnownTagNoteIconModifiedAt(fileInfo);
  const size = getKnownTagNoteIconMetadataSize(fileInfo);
  if (
    !fileInfo ||
    fileInfo?.isDirectory === true ||
    fileInfo?.isFile === false ||
    (
      typeof fileInfo.size === 'number' &&
      (!Number.isFinite(fileInfo.size) || fileInfo.size < 0 || fileInfo.size > MAX_TAG_NOTE_ICON_METADATA_BYTES)
    )
  ) {
    return { modifiedAt, size, icon: null };
  }

  const freshCached = getFreshTagNoteIconCacheEntry(cacheKey, modifiedAt, size);
  if (freshCached) {
    return freshCached;
  }

  const content = await storage.readFile(fullPath, MAX_TAG_NOTE_ICON_METADATA_BYTES);
  if (!isTagNoteIconMetadataWithinReadLimit(content)) {
    return { modifiedAt, size, icon: null };
  }

  return {
    modifiedAt,
    size,
    icon: readNoteMetadataFromMarkdown(content).icon ?? null,
  };
}

export async function readTagNoteIcon(
  path: string,
  notesRootPath: string | null,
  cacheKey: string,
  signal?: AbortSignal,
): Promise<TagNoteIconCacheEntry> {
  return scheduleTagNoteIconMetadataRead(
    () => readTagNoteIconFromStorage(path, notesRootPath, cacheKey),
    signal,
  );
}
