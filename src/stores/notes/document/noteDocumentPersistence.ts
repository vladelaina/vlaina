import { getStorageAdapter } from '@/lib/storage/adapter';
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
  MAX_NOTE_DOCUMENT_BYTES,
  assertEditorSafeMarkdownContent,
  assertReadableNoteFileInfo,
  assertStoredNotePathAllowed,
  assertWritableNoteFileInfo,
  getKnownFileSize,
  getKnownModifiedAt,
  hasKnownFileSizeChanged,
  normalizeStoredNotePath,
  resolveStoredPath,
  shouldVerifyDiskContentWithoutModifiedAt,
} from './noteDocumentGuards';
import { normalizeEditorStateMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';
import { mergeNonConflictingNoteChanges } from './noteThreeWayMerge';

export { assertEditorSafeMarkdownContent } from './noteDocumentGuards';

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

export class NoteWriteConflictError extends Error {
  constructor() {
    super('Current note changed on disk. Reload or resolve the conflict before saving.');
    this.name = 'NoteWriteConflictError';
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
        const normalizedDiskContent = normalizeEditorStateMarkdownDocument(diskContent);
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

    const normalizedCachedContent = normalizeEditorStateMarkdownDocument(cachedContent);
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
  const normalizedContent = normalizeEditorStateMarkdownDocument(content);
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
  const normalizedCurrentContent = normalizeEditorStateMarkdownDocument(currentNote.content);
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
    const normalizedDiskContent = normalizeEditorStateMarkdownDocument(diskContent);
    const normalizedCachedContent = normalizeEditorStateMarkdownDocument(
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
