import { isAbsolutePath, normalizeAbsolutePath } from '@/lib/storage/adapter';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import {
  hasUnsafeNotesRootPathSegment,
  normalizeNotesRootRelativePath,
  resolveNotesRootRelativeFullPath,
} from '../utils/fs/notesRootPathContainment';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';

const MAX_NOTE_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_NOTE_DOCUMENT_CHARS = 10 * 1024 * 1024;
const MAX_NOTE_DOCUMENT_LINES = 120_000;
const MAX_NOTE_DOCUMENT_LINE_CHARS = 512 * 1024;
const MAX_UTF8_BYTES_PER_UTF16_CODE_UNIT = 3;
const utf8Encoder = new TextEncoder();

export { MAX_NOTE_DOCUMENT_BYTES };

export async function resolveStoredPath(notesPath: string, path: string): Promise<string> {
  if (isAbsolutePath(path)) {
    return normalizeAbsolutePath(path);
  }

  return (await resolveNotesRootRelativeFullPath(notesPath, path)).fullPath;
}

export function normalizeStoredNotePath(path: string): string {
  if (isAbsolutePath(path)) {
    return normalizeAbsolutePath(path);
  }

  return normalizeNotesRootRelativePath(path) ?? path;
}

function hasUnsafeStoredNotePathSegment(path: string): boolean {
  return hasUnsafeNotesRootPathSegment(path, {
    allowNavigationSegments: true,
  });
}

export function assertStoredNotePathAllowed(path: string): void {
  if (!isSupportedMarkdownPath(path)) {
    throw new Error('Only Markdown files can be opened as notes.');
  }

  if (hasInternalNotePathSegment(path)) {
    throw new Error('Path must not be inside an internal notes folder.');
  }

  if (hasUnsafeStoredNotePathSegment(path)) {
    throw new Error('Selected file path contains unsupported characters');
  }

  if (!isAbsolutePath(path) && normalizeNotesRootRelativePath(path) == null) {
    throw new Error('Path must stay inside the opened folder.');
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

export function assertReadableNoteFileInfo(fileInfo: { isFile?: boolean; isDirectory?: boolean; size?: number | null } | null | undefined): void {
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

export function assertWritableNoteFileInfo(fileInfo: { isFile?: boolean; isDirectory?: boolean; size?: number | null } | null | undefined): void {
  if (fileInfo?.isDirectory === true || fileInfo?.isFile === false) {
    throw new Error('Note file is too large to open.');
  }
  if (typeof fileInfo?.size === 'number') {
    assertReadableNoteSize(fileInfo.size);
  }
}

export function getKnownFileSize(fileInfo: { size?: number | null } | null | undefined): number | null {
  return typeof fileInfo?.size === 'number' && Number.isFinite(fileInfo.size) && fileInfo.size >= 0
    ? fileInfo.size
    : null;
}

export function getKnownModifiedAt(fileInfo: { modifiedAt?: number | null } | null | undefined): number | null {
  return typeof fileInfo?.modifiedAt === 'number' && Number.isFinite(fileInfo.modifiedAt)
    ? fileInfo.modifiedAt
    : null;
}

export function hasKnownFileSizeChanged(cachedSize: number | null | undefined, diskSize: number | null): boolean {
  return typeof cachedSize === 'number' && diskSize !== null && cachedSize !== diskSize;
}

export function shouldVerifyDiskContentWithoutModifiedAt(
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
