import type { DesktopWatchEvent } from '@/lib/desktop/watch';
import { normalizeContainedAssetPath } from '@/lib/assets/core/pathContainment';
import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { isImageFilename } from '@/lib/assets/core/naming';
import { isAbsolutePath, normalizeAbsolutePath } from '@/lib/storage/adapter';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import {
  hasUnsafeNotesRootPathSegment,
  normalizeNotesRootRelativePath,
} from '@/stores/notes/utils/fs/notesRootPathContainment';

export function normalizeFsPath(path: string): string {
  const normalizedPath = isAbsolutePath(path) ? normalizeAbsolutePath(path) : path;
  return normalizeNotePathKey(normalizedPath) ?? normalizedPath;
}

export function getFsPathComparisonKey(path: string): string {
  return /^[a-z]:\//i.test(path) || path.startsWith('//') ? path.toLowerCase() : path;
}

export function hasUnsafeFsPathSegment(path: string): boolean {
  return hasUnsafeNotesRootPathSegment(path);
}

export function isInsideNotesRoot(notesRootPath: string, absolutePath: string): boolean {
  const normalizedNotesRootPath = normalizeFsPath(notesRootPath);
  const normalizedAbsolutePath = normalizeFsPath(absolutePath);
  return normalizeContainedAssetPath(normalizedAbsolutePath, normalizedNotesRootPath) !== null;
}

export function toNotesRootRelativePath(notesRootPath: string, absolutePath: string): string | null {
  const normalizedNotesRootPath = normalizeFsPath(notesRootPath);
  const normalizedAbsolutePath = normalizeFsPath(absolutePath);
  const containedAbsolutePath = normalizeContainedAssetPath(normalizedAbsolutePath, normalizedNotesRootPath);
  if (!containedAbsolutePath) {
    return null;
  }

  const notesRootPathKey = getFsPathComparisonKey(normalizedNotesRootPath);
  const absolutePathKey = getFsPathComparisonKey(containedAbsolutePath);

  if (absolutePathKey === notesRootPathKey) {
    return '';
  }

  const relativePath = normalizedNotesRootPath === '/'
    ? containedAbsolutePath.replace(/^\/+/, '')
    : containedAbsolutePath.slice(normalizedNotesRootPath.length + 1);

  if (normalizedNotesRootPath === '/') {
    return normalizeNotesRootRelativePath(relativePath, { allowEmpty: true });
  }

  return normalizeNotesRootRelativePath(relativePath, { allowEmpty: true });
}

export function isIgnoredWatchPath(relativePath: string): boolean {
  if (!relativePath) {
    return false;
  }

  if (hasInternalNotePathSegment(relativePath)) {
    return true;
  }

  return relativePath.endsWith('.tmp');
}

export function isMarkdownPath(relativePath: string): boolean {
  return isSupportedMarkdownPath(relativePath);
}

export function isImagePath(relativePath: string): boolean {
  return isImageFilename(relativePath);
}

function toRelevantRelativePath(notesRootPath: string, absolutePath: string): string | null {
  const relativePath = toNotesRootRelativePath(notesRootPath, absolutePath);
  if (relativePath == null || isIgnoredWatchPath(relativePath)) {
    return null;
  }

  return relativePath;
}

export function getRelevantRelativeWatchPaths(notesRootPath: string, absolutePaths: string[]): string[] {
  return absolutePaths
    .map((absolutePath) => toRelevantRelativePath(notesRootPath, absolutePath))
    .filter((relativePath): relativePath is string => relativePath != null);
}

export function isRemoveWatchEvent(event: Pick<DesktopWatchEvent, 'type'>): boolean {
  return typeof event.type !== 'string' && 'remove' in event.type;
}

export function isCreateWatchEvent(event: Pick<DesktopWatchEvent, 'type'>): boolean {
  return typeof event.type !== 'string' && 'create' in event.type;
}

export function getAbsoluteRenameWatchPaths(
  event: Pick<DesktopWatchEvent, 'type' | 'paths'>
): { oldPath: string | null; newPath: string | null } | null {
  if (typeof event.type === 'string' || !('modify' in event.type) || event.type.modify.kind !== 'rename') {
    return null;
  }

  const normalizedPaths = event.paths.map((path) => normalizeFsPath(path));

  let oldPath: string | null = null;
  let newPath: string | null = null;

  switch (event.type.modify.mode) {
    case 'from':
      oldPath = normalizedPaths[0] ?? null;
      break;
    case 'to':
      newPath = normalizedPaths[0] ?? null;
      break;
    case 'both':
    default:
      oldPath = normalizedPaths[0] ?? null;
      newPath = normalizedPaths[1] ?? null;
      break;
  }

  if (!oldPath && !newPath) {
    return null;
  }

  if (oldPath != null && newPath != null && oldPath === newPath) {
    return null;
  }

  return { oldPath, newPath };
}

export function getRelativeRenameWatchPaths(
  notesRootPath: string,
  event: Pick<DesktopWatchEvent, 'type' | 'paths'>
): { oldPath: string | null; newPath: string | null } | null {
  const absolutePaths = getAbsoluteRenameWatchPaths(event);
  if (!absolutePaths) {
    return null;
  }

  const oldPath = absolutePaths.oldPath
    ? toRelevantRelativePath(notesRootPath, absolutePaths.oldPath)
    : null;
  const newPath = absolutePaths.newPath
    ? toRelevantRelativePath(notesRootPath, absolutePaths.newPath)
    : null;

  if (!oldPath && !newPath) {
    return null;
  }

  if (oldPath != null && newPath != null && oldPath === newPath) {
    return null;
  }

  return { oldPath, newPath };
}
