import { getStorageAdapter, isAbsolutePath, normalizeAbsolutePath } from '@/lib/storage/adapter';
import {
  mergeNoteMetadataWithFileInfo,
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
import {
  hasUnsafeVaultPathSegment,
  normalizeVaultRelativePath,
  resolveVaultRelativeFullPath,
} from '../utils/fs/vaultPathContainment';
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
}

export interface LoadedNoteDocument {
  content: string;
  modifiedAt: number | null;
  size: number | null;
  nextCache: NoteContentCache;
  metadata: NoteMetadataEntry;
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
const MAX_UTF8_BYTES_PER_UTF16_CODE_UNIT = 3;
const utf8Encoder = new TextEncoder();

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
  if (isAbsolutePath(path)) {
    return normalizeAbsolutePath(path);
  }

  return normalizeVaultRelativePath(path) ?? path;
}

function hasUnsafeStoredNotePathSegment(path: string): boolean {
  return hasUnsafeVaultPathSegment(path, {
    allowNavigationSegments: true,
  });
}

function assertStoredNotePathAllowed(path: string): void {
  if (!isSupportedMarkdownPath(path)) {
    throw new Error('Only Markdown files can be opened as notes.');
  }

  if (hasInternalNotePathSegment(path)) {
    throw new Error('Path must not be inside an internal notes folder.');
  }

  if (hasUnsafeStoredNotePathSegment(path)) {
    throw new Error('Selected file path contains unsupported characters');
  }

  if (!isAbsolutePath(path) && normalizeVaultRelativePath(path) == null) {
    throw new Error('Path must stay inside the current vault.');
  }
}

function assertReadableNoteSize(size: number | null | undefined): void {
  if (
    typeof size !== 'number' ||
    !Number.isFinite(size) ||
    size < 0 ||
    size > MAX_NOTE_DOCUMENT_BYTES
  ) {
    throw new Error('Note file is too large to open.');
  }
}

function assertReadableNoteFileInfo(fileInfo: { isFile?: boolean; isDirectory?: boolean; size?: number | null } | null | undefined): void {
  if (fileInfo?.isDirectory === true || fileInfo?.isFile === false) {
    throw new Error('Note file is too large to open.');
  }
  if (!fileInfo) {
    throw new Error('Note file is too large to open.');
  }
  if (typeof fileInfo.size === 'number') {
    assertReadableNoteSize(fileInfo.size);
  }
}

function assertWritableNoteFileInfo(fileInfo: { isFile?: boolean; isDirectory?: boolean; size?: number | null } | null | undefined): void {
  if (fileInfo?.isDirectory === true || fileInfo?.isFile === false) {
    throw new Error('Note file is too large to open.');
  }
  if (typeof fileInfo?.size === 'number') {
    assertReadableNoteSize(fileInfo.size);
  }
}

function getKnownFileSize(fileInfo: { size?: number | null } | null | undefined): number | null {
  return typeof fileInfo?.size === 'number' && Number.isFinite(fileInfo.size) && fileInfo.size >= 0
    ? fileInfo.size
    : null;
}

function getKnownModifiedAt(fileInfo: { modifiedAt?: number | null } | null | undefined): number | null {
  return typeof fileInfo?.modifiedAt === 'number' && Number.isFinite(fileInfo.modifiedAt)
    ? fileInfo.modifiedAt
    : null;
}

function hasKnownFileSizeChanged(cachedSize: number | null | undefined, diskSize: number | null): boolean {
  return typeof cachedSize === 'number' && diskSize !== null && cachedSize !== diskSize;
}

function shouldVerifyDiskContentWithoutModifiedAt(
  fileInfo: { isFile?: boolean; isDirectory?: boolean; modifiedAt?: number | null } | null | undefined,
): boolean {
  return Boolean(fileInfo && fileInfo.isDirectory !== true && fileInfo.isFile !== false && getKnownModifiedAt(fileInfo) === null);
}

export function assertEditorSafeMarkdownContent(content: string): void {
  if (content.length > MAX_NOTE_DOCUMENT_CHARS) {
    throw new Error('Note file is too large to open.');
  }

  if (
    content.length > Math.floor(MAX_NOTE_DOCUMENT_BYTES / MAX_UTF8_BYTES_PER_UTF16_CODE_UNIT) &&
    utf8Encoder.encode(content).length > MAX_NOTE_DOCUMENT_BYTES
  ) {
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
      const diskModifiedAt = getKnownModifiedAt(fileInfo);
      const diskSize = getKnownFileSize(fileInfo);
      const shouldVerifyMissingModifiedAt = shouldVerifyDiskContentWithoutModifiedAt(fileInfo);
      if (
        shouldVerifyMissingModifiedAt ||
        (diskModifiedAt != null && diskModifiedAt !== cachedModifiedAt) ||
        hasKnownFileSizeChanged(cachedEntry?.size, diskSize)
      ) {
        assertReadableNoteFileInfo(fileInfo);
        const diskContent = await storage.readFile(fullPath, MAX_NOTE_DOCUMENT_BYTES);
        assertEditorSafeMarkdownContent(diskContent);
        const normalizedDiskContent = normalizeSerializedMarkdownDocument(diskContent);
        return {
          content: normalizedDiskContent,
          modifiedAt: diskModifiedAt,
          size: diskSize,
          metadata: mergeNoteMetadataWithFileInfo(readNoteMetadataFromMarkdown(normalizedDiskContent), fileInfo),
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
      metadata: readNoteMetadataFromMarkdown(normalizedCachedContent),
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
  const content = await storage.readFile(fullPath, MAX_NOTE_DOCUMENT_BYTES);
  assertEditorSafeMarkdownContent(content);
  const normalizedContent = normalizeSerializedMarkdownDocument(content);
  const modifiedAt = getKnownModifiedAt(fileInfo);
  const size = getKnownFileSize(fileInfo);

  return {
    content: normalizedContent,
    modifiedAt,
    size,
    metadata: mergeNoteMetadataWithFileInfo(readNoteMetadataFromMarkdown(normalizedContent), fileInfo),
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
}: SaveNoteDocumentOptions): Promise<SavedNoteDocument> {
  const storage = getStorageAdapter();
  const notePath = normalizeStoredNotePath(currentNote.path);
  assertStoredNotePathAllowed(notePath);
  const fullPath = await resolveStoredPath(notesPath, notePath);
  const fileInfoBeforeWrite = await storage.stat(fullPath);
  assertWritableNoteFileInfo(fileInfoBeforeWrite);
  assertEditorSafeMarkdownContent(currentNote.content);
  const diskModifiedAt = getKnownModifiedAt(fileInfoBeforeWrite);
  const diskSize = getKnownFileSize(fileInfoBeforeWrite);
  const normalizedCurrentContent = normalizeSerializedMarkdownDocument(currentNote.content);
  const cachedEntry = cache.get(notePath);
  const cachedModifiedAt = cachedEntry?.modifiedAt ?? null;
  const knownFileSizeChanged = hasKnownFileSizeChanged(cachedEntry?.size, diskSize);
  const shouldVerifyMissingModifiedAt = shouldVerifyDiskContentWithoutModifiedAt(fileInfoBeforeWrite);
  const shouldCompareDiskContent =
    cachedEntry !== undefined &&
    (diskModifiedAt != null || knownFileSizeChanged || shouldVerifyMissingModifiedAt) &&
    (cachedEntry.savedContent !== undefined ||
      cachedModifiedAt == null ||
      diskModifiedAt !== cachedModifiedAt ||
      knownFileSizeChanged ||
      shouldVerifyMissingModifiedAt);
  const writeNormalizedContent = async (sourceContent: string): Promise<SavedNoteDocument> => {
    const { content } = updateNoteMetadataInMarkdown(sourceContent, {});
    assertEditorSafeMarkdownContent(content);

    markExpectedExternalChange(fullPath);
    await safeWriteTextFile(fullPath, content);
    markExpectedExternalChange(fullPath);

    const fileInfo = await storage.stat(fullPath);
    const modifiedAt = getKnownModifiedAt(fileInfo);
    const size = getKnownFileSize(fileInfo);
    const metadata = mergeNoteMetadataWithFileInfo(readNoteMetadataFromMarkdown(content), fileInfo);

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
  };

  if (shouldCompareDiskContent && cachedEntry !== undefined) {
    assertReadableNoteFileInfo(fileInfoBeforeWrite);
    const diskContent = await storage.readFile(fullPath, MAX_NOTE_DOCUMENT_BYTES);
    assertEditorSafeMarkdownContent(diskContent);
    const normalizedDiskContent = normalizeSerializedMarkdownDocument(diskContent);
    const normalizedCachedContent = normalizeSerializedMarkdownDocument(
      cachedEntry.savedContent ?? cachedEntry.content
    );
    const comparableDiskContent = stripUpdatedFrontmatter(normalizedDiskContent);
    const comparableCurrentContent = stripUpdatedFrontmatter(normalizedCurrentContent);
    const comparableCachedContent = stripUpdatedFrontmatter(normalizedCachedContent);
    if (normalizedDiskContent === normalizedCurrentContent) {
      const cleanedDiskContent = updateNoteMetadataInMarkdown(normalizedDiskContent, {}).content;
      if (cleanedDiskContent !== normalizedDiskContent) {
        return writeNormalizedContent(normalizedDiskContent);
      }
      const metadata = mergeNoteMetadataWithFileInfo(readNoteMetadataFromMarkdown(normalizedDiskContent), fileInfoBeforeWrite);
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
      const cleanedDiskContent = updateNoteMetadataInMarkdown(normalizedDiskContent, {}).content;
      if (cleanedDiskContent !== normalizedDiskContent) {
        return writeNormalizedContent(normalizedDiskContent);
      }
      const metadata = mergeNoteMetadataWithFileInfo(readNoteMetadataFromMarkdown(normalizedDiskContent), fileInfoBeforeWrite);
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
      return writeNormalizedContent(mergedContent);
    }
  }

  return writeNormalizedContent(normalizedCurrentContent);
}
