import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import type { MetadataFile, NoteCoverMetadata, NoteMetadataEntry } from './types';
import { normalizeNoteMetadataEntry, readNoteMetadataFromMarkdown } from './frontmatter';
import {
  collectMarkdownPaths,
  getKnownReadableCreatedAt,
  getKnownReadableFileSize,
  getKnownReadableModifiedAt,
  isReadableBoundedMarkdownFile,
  MAX_METADATA_READ_BYTES,
  utf8Encoder,
} from './storageMetadataScan';

export type { MetadataFile, NoteMetadataEntry };

const CURRENT_METADATA_VERSION = 2;
const MAX_METADATA_CACHE_NOTES_ROOTS = 8;

interface CachedMetadataEntry {
  createdAt: number | null;
  modifiedAt: number | null;
  size: number | null;
  metadata: NoteMetadataEntry;
}

const metadataCacheByNotesRoot = new Map<string, Map<string, CachedMetadataEntry>>();

function setMetadataNotesRootCache(notesRootPath: string, cache: Map<string, CachedMetadataEntry>) {
  metadataCacheByNotesRoot.delete(notesRootPath);
  metadataCacheByNotesRoot.set(notesRootPath, cache);

  while (metadataCacheByNotesRoot.size > MAX_METADATA_CACHE_NOTES_ROOTS) {
    const oldestNotesRootPath = metadataCacheByNotesRoot.keys().next().value;
    if (oldestNotesRootPath === undefined) {
      return;
    }
    metadataCacheByNotesRoot.delete(oldestNotesRootPath);
  }
}

function normalizeCover(cover: NoteCoverMetadata | null | undefined): NoteCoverMetadata | undefined {
  if (!cover?.assetPath) {
    return undefined;
  }

  const normalized: NoteCoverMetadata = {
    assetPath: cover.assetPath,
  };

  if (cover.positionX !== undefined) normalized.positionX = cover.positionX;
  if (cover.positionY !== undefined) normalized.positionY = cover.positionY;
  if (cover.height !== undefined) normalized.height = cover.height;
  if (cover.scale !== undefined) normalized.scale = cover.scale;

  return normalized;
}

function normalizeLoadedEntry(
  entry: Partial<NoteMetadataEntry> | null | undefined
): NoteMetadataEntry {
  return normalizeNoteMetadataEntry({
    ...entry,
    cover: normalizeCover(entry?.cover),
  });
}

export function createEmptyMetadataFile(): MetadataFile {
  return { version: CURRENT_METADATA_VERSION, notes: {} };
}

export function mergeNoteMetadataWithFileInfo(
  entry: Partial<NoteMetadataEntry> | null | undefined,
  fileInfo: { createdAt?: number | null; modifiedAt?: number | null } | null | undefined,
): NoteMetadataEntry {
  const createdAt = getKnownReadableCreatedAt(fileInfo);
  const updatedAt = getKnownReadableModifiedAt(fileInfo);

  return normalizeLoadedEntry({
    ...entry,
    ...(createdAt !== null ? { createdAt } : {}),
    ...(updatedAt !== null ? { updatedAt } : {}),
  });
}

export async function loadNoteMetadata(notesRootPath: string): Promise<MetadataFile> {
  try {
    const storage = getStorageAdapter();
    const notePaths = await collectMarkdownPaths(notesRootPath);
    const notes: MetadataFile['notes'] = {};
    const notesRootCache = metadataCacheByNotesRoot.get(notesRootPath) ?? new Map<string, CachedMetadataEntry>();
    setMetadataNotesRootCache(notesRootPath, notesRootCache);
    const nextCache = new Map<string, CachedMetadataEntry>();

    const BATCH_SIZE = 10;
    for (let index = 0; index < notePaths.length; index += BATCH_SIZE) {
      const batch = notePaths.slice(index, index + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (relativePath) => {
          const fullPath = await joinPath(notesRootPath, relativePath);
          const fileInfo = await storage.stat(fullPath).catch(() => null);
          const createdAt = getKnownReadableCreatedAt(fileInfo);
          const modifiedAt = getKnownReadableModifiedAt(fileInfo);
          const size = getKnownReadableFileSize(fileInfo);
          if (!isReadableBoundedMarkdownFile(fileInfo, MAX_METADATA_READ_BYTES)) {
            return {
              relativePath,
              metadata: mergeNoteMetadataWithFileInfo({}, fileInfo),
            };
          }

          const canUseCache = modifiedAt !== null;
          const cached = notesRootCache.get(relativePath);
          if (
            canUseCache &&
            cached &&
            cached.createdAt === createdAt &&
            cached.modifiedAt === modifiedAt &&
            cached.size === size
          ) {
            nextCache.set(relativePath, cached);
            return {
              relativePath,
              metadata: cached.metadata,
            };
          }

          const content = await storage.readFile(fullPath, MAX_METADATA_READ_BYTES);
          if (utf8Encoder.encode(content).length > MAX_METADATA_READ_BYTES) {
            return {
              relativePath,
              metadata: mergeNoteMetadataWithFileInfo({}, fileInfo),
            };
          }
          const metadata = mergeNoteMetadataWithFileInfo(readNoteMetadataFromMarkdown(content), fileInfo);
          if (canUseCache) {
            nextCache.set(relativePath, {
              createdAt,
              modifiedAt,
              size,
              metadata,
            });
          }
          return {
            relativePath,
            metadata,
          };
        })
      );

      for (const result of results) {
        if (result.status !== 'fulfilled') {
          continue;
        }

        const { relativePath, metadata } = result.value;
        if (Object.keys(metadata).length > 0) {
          notes[relativePath] = metadata;
        }
      }
    }

    setMetadataNotesRootCache(notesRootPath, nextCache);

    return {
      version: CURRENT_METADATA_VERSION,
      notes,
    };
  } catch (error) {
    return createEmptyMetadataFile();
  }
}

export function getNoteEntry(metadata: MetadataFile, path: string): NoteMetadataEntry {
  return metadata.notes[path] || {};
}

export function setNoteEntry(
  metadata: MetadataFile,
  path: string,
  updates: Partial<NoteMetadataEntry>
): MetadataFile {
  const existing = metadata.notes[path] || {};
  const updated = normalizeLoadedEntry({
    ...existing,
    ...updates,
    cover: 'cover' in updates ? updates.cover : existing.cover,
  });

  if (Object.keys(updated).length === 0) {
    const { [path]: _, ...rest } = metadata.notes;
    return { ...metadata, notes: rest };
  }

  return {
    ...metadata,
    notes: { ...metadata.notes, [path]: updated },
  };
}

export function remapMetadataEntries(
  metadata: MetadataFile | null,
  remapPath: (path: string) => string | null
): MetadataFile | null {
  if (!metadata) {
    return metadata;
  }

  let changed = false;
  const nextNotes: MetadataFile['notes'] = {};

  for (const [path, entry] of Object.entries(metadata.notes)) {
    const nextPath = remapPath(path);
    if (nextPath == null) {
      changed = true;
      continue;
    }
    if (nextPath !== path) {
      changed = true;
    }
    nextNotes[nextPath] = entry;
  }

  if (!changed) {
    return metadata;
  }

  return {
    ...metadata,
    notes: nextNotes,
  };
}
