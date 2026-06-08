import { getStorageAdapter, isAbsolutePath, normalizeAbsolutePath } from '@/lib/storage/adapter';
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
  stripUpdatedFrontmatter,
  updateNoteMetadataInMarkdown,
} from '../frontmatter';
import { resolveVaultRelativeFullPath } from '../utils/fs/vaultPathContainment';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import {
  normalizeSerializedMarkdownDocument,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import { mergeNonConflictingNoteChanges } from './noteThreeWayMerge';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';

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
  size: number | null;
  nextCache: NoteContentCache;
}

export interface SavedNoteDocument {
  content: string;
  modifiedAt: number | null;
  size: number | null;
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
    return normalizeAbsolutePath(path);
  }

  return (await resolveVaultRelativeFullPath(notesPath, path)).fullPath;
}

function normalizeStoredNotePath(path: string): string {
  return isAbsolutePath(path) ? normalizeAbsolutePath(path) : path;
}

function assertStoredNotePathAllowed(path: string): void {
  if (!isSupportedMarkdownPath(path)) {
    throw new Error('Only Markdown files can be opened as notes.');
  }

  if (hasInternalNotePathSegment(path)) {
    throw new Error('Path must not be inside an internal notes folder.');
  }
}

function assertReadableNoteSize(size: number | null | undefined): void {
  if (typeof size !== 'number' || size > MAX_NOTE_DOCUMENT_BYTES) {
    throw new Error('Note file is too large to open.');
  }
}

function assertReadableNoteFileInfo(fileInfo: { isFile?: boolean; isDirectory?: boolean; size?: number | null } | null | undefined): void {
  if (fileInfo?.isDirectory === true || fileInfo?.isFile === false) {
    throw new Error('Note file is too large to open.');
  }
  assertReadableNoteSize(fileInfo?.size);
}

function getKnownFileSize(fileInfo: { size?: number | null } | null | undefined): number | null {
  return typeof fileInfo?.size === 'number' ? fileInfo.size : null;
}

function hasKnownFileSizeChanged(cachedSize: number | null | undefined, diskSize: number | null): boolean {
  return typeof cachedSize === 'number' && diskSize !== null && cachedSize !== diskSize;
}

export function assertEditorSafeMarkdownContent(content: string): void {
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
  const notePath = normalizeStoredNotePath(path);
  assertStoredNotePathAllowed(notePath);
  const cachedEntry = cache.get(notePath);
  const cachedContent = getCachedNoteContent(cache, notePath);
  if (cachedContent !== undefined) {
    const cachedModifiedAt = cachedEntry?.modifiedAt ?? null;
    assertEditorSafeMarkdownContent(cachedContent);
    const canTrustFreshCachedContent = typeof cachedEntry?.freshUntil === 'number' && Date.now() <= cachedEntry.freshUntil;
    if (!allowStaleCachedContent && !canTrustFreshCachedContent) {
      const storage = getStorageAdapter();
      const fullPath = await resolveStoredPath(notesPath, notePath);
      const fileInfo = await storage.stat(fullPath);
      if (fileInfo == null || fileInfo.isDirectory === true || fileInfo.isFile === false) {
        assertReadableNoteFileInfo(fileInfo);
      }
      const diskModifiedAt = fileInfo?.modifiedAt ?? null;
      const diskSize = getKnownFileSize(fileInfo);
      if (
        (diskModifiedAt != null && diskModifiedAt !== cachedModifiedAt) ||
        hasKnownFileSizeChanged(cachedEntry?.size, diskSize)
      ) {
        assertReadableNoteFileInfo(fileInfo);
        const diskContent = await storage.readFile(fullPath);
        assertEditorSafeMarkdownContent(diskContent);
        const normalizedDiskContent = normalizeSerializedMarkdownDocument(diskContent);
        return {
          content: normalizedDiskContent,
          modifiedAt: diskModifiedAt,
          size: diskSize,
          nextCache: setCachedNoteContent(cache, notePath, normalizedDiskContent, diskModifiedAt, {
            updateBaseline: true,
            size: diskSize,
          }),
        };
      }
    }

    const normalizedCachedContent = normalizeSerializedMarkdownDocument(cachedContent);
    return {
      content: normalizedCachedContent,
      modifiedAt: cachedModifiedAt,
      size: cachedEntry?.size ?? null,
      nextCache: normalizedCachedContent === cachedContent
        ? cache
        : setCachedNoteContent(cache, notePath, normalizedCachedContent, cachedModifiedAt, {
          updateBaseline: !allowStaleCachedContent,
        }),
    };
  }

  const storage = getStorageAdapter();
  const fullPath = await resolveStoredPath(notesPath, notePath);
  const fileInfo = await storage.stat(fullPath);
  assertReadableNoteFileInfo(fileInfo);
  const content = await storage.readFile(fullPath);
  assertEditorSafeMarkdownContent(content);
  const normalizedContent = normalizeSerializedMarkdownDocument(content);
  const modifiedAt = fileInfo?.modifiedAt ?? null;
  const size = getKnownFileSize(fileInfo);

  return {
    content: normalizedContent,
    modifiedAt,
    size,
    nextCache: setCachedNoteContent(cache, notePath, normalizedContent, modifiedAt, {
      updateBaseline: true,
      size,
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
  const notePath = normalizeStoredNotePath(currentNote.path);
  assertStoredNotePathAllowed(notePath);
  const fullPath = await resolveStoredPath(notesPath, notePath);
  const fileInfoBeforeWrite = await storage.stat(fullPath);
  if (typeof fileInfoBeforeWrite?.size === 'number') {
    assertReadableNoteSize(fileInfoBeforeWrite.size);
  }
  assertEditorSafeMarkdownContent(currentNote.content);
  const diskModifiedAt = fileInfoBeforeWrite?.modifiedAt ?? null;
  const diskSize = getKnownFileSize(fileInfoBeforeWrite);
  const normalizedCurrentContent = normalizeSerializedMarkdownDocument(currentNote.content);
  const cachedEntry = cache.get(notePath);
  const cachedModifiedAt = cachedEntry?.modifiedAt ?? null;
  const knownFileSizeChanged = hasKnownFileSizeChanged(cachedEntry?.size, diskSize);
  const shouldCompareDiskContent =
    cachedEntry !== undefined &&
    (diskModifiedAt != null || knownFileSizeChanged) &&
    (cachedEntry.savedContent !== undefined ||
      cachedModifiedAt == null ||
      diskModifiedAt !== cachedModifiedAt ||
      knownFileSizeChanged);
  if (shouldCompareDiskContent && cachedEntry !== undefined) {
    assertReadableNoteFileInfo(fileInfoBeforeWrite);
    const diskContent = await storage.readFile(fullPath);
    assertEditorSafeMarkdownContent(diskContent);
    const normalizedDiskContent = normalizeSerializedMarkdownDocument(diskContent);
    const normalizedCachedContent = normalizeSerializedMarkdownDocument(
      cachedEntry.savedContent ?? cachedEntry.content
    );
    const comparableDiskContent = stripUpdatedFrontmatter(normalizedDiskContent);
    const comparableCurrentContent = stripUpdatedFrontmatter(normalizedCurrentContent);
    const comparableCachedContent = stripUpdatedFrontmatter(normalizedCachedContent);
    if (normalizedDiskContent === normalizedCurrentContent) {
      const metadata = readNoteMetadataFromMarkdown(normalizedDiskContent);
      return {
        content: normalizedDiskContent,
        metadata,
        modifiedAt: diskModifiedAt,
        size: diskSize,
        nextCache: setCachedNoteContent(cache, notePath, normalizedDiskContent, diskModifiedAt, {
          updateBaseline: true,
          size: diskSize,
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
        size: diskSize,
        nextCache: setCachedNoteContent(cache, notePath, normalizedDiskContent, diskModifiedAt, {
          updateBaseline: true,
          size: diskSize,
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
      assertEditorSafeMarkdownContent(content);

      markExpectedExternalChange(fullPath);
      await safeWriteTextFile(fullPath, content);
      markExpectedExternalChange(fullPath);

      const fileInfo = await storage.stat(fullPath);
      const modifiedAt = fileInfo?.modifiedAt ?? null;
      const size = getKnownFileSize(fileInfo);

      return {
        content,
        metadata,
        modifiedAt,
        size,
        nextCache: setCachedNoteContent(cache, notePath, content, modifiedAt, {
          updateBaseline: true,
          size,
        }),
      };
    }
  }

  const { content, metadata } = updateNoteMetadataInMarkdown(normalizedCurrentContent, {
    updatedAt: updatedAt ?? Date.now(),
  });
  assertEditorSafeMarkdownContent(content);

  markExpectedExternalChange(fullPath);
  await safeWriteTextFile(fullPath, content);
  markExpectedExternalChange(fullPath);

  const fileInfo = await storage.stat(fullPath);
  const modifiedAt = fileInfo?.modifiedAt ?? null;
  const size = getKnownFileSize(fileInfo);

  return {
    content,
    metadata,
    modifiedAt,
    size,
    nextCache: setCachedNoteContent(cache, notePath, content, modifiedAt, {
      updateBaseline: true,
      size,
    }),
  };
}
