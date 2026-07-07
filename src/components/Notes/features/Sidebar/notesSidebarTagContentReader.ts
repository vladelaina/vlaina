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

export const MAX_TAG_CONTENT_READ_BYTES = 512 * 1024;
const tagContentUtf8Encoder = new TextEncoder();

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

export async function readSidebarTagContent(path: string, currentNotesRootPath: string | null): Promise<string> {
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
