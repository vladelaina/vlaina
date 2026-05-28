import { getStorageAdapter, isAbsolutePath } from '@/lib/storage/adapter';
import {
  safeWriteTextFile,
} from '../storage';
import type { CurrentNoteState, NoteMetadataEntry } from '../types';
import {
  getCachedNoteContent,
  setCachedNoteContent,
  type NoteContentCache,
} from './noteContentCache';
import { markExpectedExternalChange } from './externalChangeRegistry';
import {
  readNoteMetadataFromMarkdown,
  stripVlainaUpdatedFrontmatter,
  updateNoteMetadataInMarkdown,
} from '../frontmatter';
import { resolveVaultRelativeFullPath } from '../utils/fs/vaultPathContainment';
import {
  normalizeSerializedMarkdownDocument,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import { mergeNonConflictingNoteChanges } from './noteThreeWayMerge';

interface LoadNoteDocumentOptions {
  notesPath: string;
  path: string;
  cache: NoteContentCache;
  allowStaleCachedContent?: boolean;
}

interface SaveNoteDocumentOptions {
  notesPath: string;
  currentNote: CurrentNoteState;
  cache: NoteContentCache;
  updatedAt?: number;
}

export interface LoadedNoteDocument {
  content: string;
  modifiedAt: number | null;
  nextCache: NoteContentCache;
}

export interface SavedNoteDocument {
  content: string;
  modifiedAt: number | null;
  nextCache: NoteContentCache;
  metadata: NoteMetadataEntry;
}

const MAX_NOTE_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_NOTE_DOCUMENT_CHARS = 10 * 1024 * 1024;
const MAX_NOTE_DOCUMENT_LINES = 120_000;
const MAX_NOTE_DOCUMENT_LINE_CHARS = 512 * 1024;

export class NoteWriteConflictError extends Error {
  constructor() {
    super('Current note changed on disk. Reload or resolve the conflict before saving.');
    this.name = 'NoteWriteConflictError';
  }
}

async function resolveStoredPath(notesPath: string, path: string): Promise<string> {
  if (isAbsolutePath(path)) {
    return path;
  }

  return (await resolveVaultRelativeFullPath(notesPath, path)).fullPath;
}

function assertReadableNoteSize(size: number | null | undefined): void {
  if (typeof size === 'number' && size > MAX_NOTE_DOCUMENT_BYTES) {
    throw new Error('Note file is too large to open.');
  }
}

function assertEditorSafeMarkdownContent(content: string): void {
  if (content.length > MAX_NOTE_DOCUMENT_CHARS) {
    throw new Error('Note file is too large to open.');
  }

  let lineCount = content.length === 0 ? 0 : 1;
  let lineLength = 0;
  for (let index = 0; index < content.length; index += 1) {
    const charCode = content.charCodeAt(index);
    if (charCode === 10) {
      lineCount += 1;
      lineLength = 0;
      if (lineCount > MAX_NOTE_DOCUMENT_LINES) {
        throw new Error('Note file is too complex to open safely.');
      }
      continue;
    }

    if (charCode === 13) {
      continue;
    }

    lineLength += 1;
    if (lineLength > MAX_NOTE_DOCUMENT_LINE_CHARS) {
      throw new Error('Note file is too complex to open safely.');
    }
  }
}

export async function loadNoteDocument({
  notesPath,
  path,
  cache,
  allowStaleCachedContent = false,
}: LoadNoteDocumentOptions): Promise<LoadedNoteDocument> {
  const cachedEntry = cache.get(path);
  const cachedContent = getCachedNoteContent(cache, path);
  if (cachedContent !== undefined) {
    const cachedModifiedAt = cachedEntry?.modifiedAt ?? null;
    assertEditorSafeMarkdownContent(cachedContent);
    const canTrustFreshCachedContent = typeof cachedEntry?.freshUntil === 'number' && Date.now() <= cachedEntry.freshUntil;
    if (!allowStaleCachedContent && !canTrustFreshCachedContent) {
      const storage = getStorageAdapter();
      const fullPath = await resolveStoredPath(notesPath, path);
      const fileInfo = await storage.stat(fullPath);
      assertReadableNoteSize(fileInfo?.size ?? null);
      const diskModifiedAt = fileInfo?.modifiedAt ?? null;
      if (diskModifiedAt != null && (cachedModifiedAt == null || diskModifiedAt > cachedModifiedAt)) {
        const diskContent = await storage.readFile(fullPath);
        assertEditorSafeMarkdownContent(diskContent);
        const normalizedDiskContent = normalizeSerializedMarkdownDocument(diskContent);
        return {
          content: normalizedDiskContent,
          modifiedAt: diskModifiedAt,
          nextCache: setCachedNoteContent(cache, path, normalizedDiskContent, diskModifiedAt, {
            updateBaseline: true,
          }),
        };
      }
    }

    const normalizedCachedContent = normalizeSerializedMarkdownDocument(cachedContent);
    return {
      content: normalizedCachedContent,
      modifiedAt: cachedModifiedAt,
      nextCache: normalizedCachedContent === cachedContent
        ? cache
        : setCachedNoteContent(cache, path, normalizedCachedContent, cachedModifiedAt, {
          updateBaseline: !allowStaleCachedContent,
        }),
    };
  }

  const storage = getStorageAdapter();
  const fullPath = await resolveStoredPath(notesPath, path);
  const fileInfo = await storage.stat(fullPath);
  assertReadableNoteSize(fileInfo?.size ?? null);
  const content = await storage.readFile(fullPath);
  assertEditorSafeMarkdownContent(content);
  const normalizedContent = normalizeSerializedMarkdownDocument(content);
  const modifiedAt = fileInfo?.modifiedAt ?? null;

  return {
    content: normalizedContent,
    modifiedAt,
    nextCache: setCachedNoteContent(cache, path, normalizedContent, modifiedAt, {
      updateBaseline: true,
    }),
  };
}

export async function saveNoteDocument({
  notesPath,
  currentNote,
  cache,
  updatedAt,
}: SaveNoteDocumentOptions): Promise<SavedNoteDocument> {
  const storage = getStorageAdapter();
  const fullPath = await resolveStoredPath(notesPath, currentNote.path);
  const fileInfoBeforeWrite = await storage.stat(fullPath);
  assertReadableNoteSize(fileInfoBeforeWrite?.size ?? null);
  assertEditorSafeMarkdownContent(currentNote.content);
  const diskModifiedAt = fileInfoBeforeWrite?.modifiedAt ?? null;
  const normalizedCurrentContent = normalizeSerializedMarkdownDocument(currentNote.content);
  const cachedEntry = cache.get(currentNote.path);
  const cachedModifiedAt = cachedEntry?.modifiedAt ?? null;
  const shouldCompareDiskContent =
    cachedEntry !== undefined &&
    diskModifiedAt != null &&
    (cachedEntry.savedContent !== undefined ||
      cachedModifiedAt == null ||
      diskModifiedAt !== cachedModifiedAt);
  if (shouldCompareDiskContent && cachedEntry !== undefined) {
    const diskContent = await storage.readFile(fullPath);
    const normalizedDiskContent = normalizeSerializedMarkdownDocument(diskContent);
    const normalizedCachedContent = normalizeSerializedMarkdownDocument(
      cachedEntry.savedContent ?? cachedEntry.content
    );
    const comparableDiskContent = stripVlainaUpdatedFrontmatter(normalizedDiskContent);
    const comparableCurrentContent = stripVlainaUpdatedFrontmatter(normalizedCurrentContent);
    const comparableCachedContent = stripVlainaUpdatedFrontmatter(normalizedCachedContent);
    if (normalizedDiskContent === normalizedCurrentContent) {
      const metadata = readNoteMetadataFromMarkdown(normalizedDiskContent);
      return {
        content: normalizedDiskContent,
        metadata,
        modifiedAt: diskModifiedAt,
        nextCache: setCachedNoteContent(cache, currentNote.path, normalizedDiskContent, diskModifiedAt, {
          updateBaseline: true,
        }),
      };
    }
    if (
      (normalizedDiskContent === normalizedCachedContent || comparableDiskContent === comparableCachedContent)
    ) {
    } else if (
      comparableDiskContent === comparableCurrentContent &&
      comparableCachedContent === comparableCurrentContent
    ) {
      const metadata = readNoteMetadataFromMarkdown(normalizedDiskContent);
      return {
        content: normalizedDiskContent,
        metadata,
        modifiedAt: diskModifiedAt,
        nextCache: setCachedNoteContent(cache, currentNote.path, normalizedDiskContent, diskModifiedAt, {
          updateBaseline: true,
        }),
      };
    } else {
      const mergedContent = mergeNonConflictingNoteChanges(
        normalizedCachedContent,
        normalizedCurrentContent,
        normalizedDiskContent,
      );
      if (mergedContent == null) {
        throw new NoteWriteConflictError();
      }
      const { content, metadata } = updateNoteMetadataInMarkdown(mergedContent, {
        updatedAt: updatedAt ?? Date.now(),
      });

      markExpectedExternalChange(fullPath);
      await safeWriteTextFile(fullPath, content);
      markExpectedExternalChange(fullPath);

      const fileInfo = await storage.stat(fullPath);
      const modifiedAt = fileInfo?.modifiedAt ?? null;

      return {
        content,
        metadata,
        modifiedAt,
        nextCache: setCachedNoteContent(cache, currentNote.path, content, modifiedAt, {
          updateBaseline: true,
        }),
      };
    }
  }

  const { content, metadata } = updateNoteMetadataInMarkdown(normalizedCurrentContent, {
    updatedAt: updatedAt ?? Date.now(),
  });

  markExpectedExternalChange(fullPath);
  await safeWriteTextFile(fullPath, content);
  markExpectedExternalChange(fullPath);

  const fileInfo = await storage.stat(fullPath);
  const modifiedAt = fileInfo?.modifiedAt ?? null;

  return {
    content,
    metadata,
    modifiedAt,
    nextCache: setCachedNoteContent(cache, currentNote.path, content, modifiedAt, {
      updateBaseline: true,
    }),
  };
}
