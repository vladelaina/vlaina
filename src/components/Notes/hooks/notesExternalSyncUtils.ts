import type { DesktopWatchEvent } from '@/lib/desktop/watch';
import { normalizeContainedAssetPath } from '@/lib/assets/core/pathContainment';
import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import {
  isSafeVaultPathSegment,
  normalizeVaultRelativePath,
} from '@/stores/notes/utils/fs/vaultPathContainment';

export function normalizeFsPath(path: string): string {
  return normalizeNotePathKey(path) ?? path;
}

export function getFsPathComparisonKey(path: string): string {
  return /^[a-z]:\//i.test(path) || path.startsWith('//') ? path.toLowerCase() : path;
}

export function hasUnsafeFsPathSegment(path: string): boolean {
  return path
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .some((segment) => !isSafeVaultPathSegment(segment));
}

export function isInsideVault(vaultPath: string, absolutePath: string): boolean {
  const normalizedVaultPath = normalizeFsPath(vaultPath);
  const normalizedAbsolutePath = normalizeFsPath(absolutePath);
  return normalizeContainedAssetPath(normalizedAbsolutePath, normalizedVaultPath) !== null;
}

export function toVaultRelativePath(vaultPath: string, absolutePath: string): string | null {
  const normalizedVaultPath = normalizeFsPath(vaultPath);
  const normalizedAbsolutePath = normalizeFsPath(absolutePath);
  const containedAbsolutePath = normalizeContainedAssetPath(normalizedAbsolutePath, normalizedVaultPath);
  if (!containedAbsolutePath) {
    return null;
  }

  const vaultPathKey = getFsPathComparisonKey(normalizedVaultPath);
  const absolutePathKey = getFsPathComparisonKey(containedAbsolutePath);

  if (absolutePathKey === vaultPathKey) {
    return '';
  }

  const relativePath = normalizedVaultPath === '/'
    ? containedAbsolutePath.replace(/^\/+/, '')
    : containedAbsolutePath.slice(normalizedVaultPath.length + 1);

  if (normalizedVaultPath === '/') {
    return normalizeVaultRelativePath(relativePath, { allowEmpty: true });
  }

  return normalizeVaultRelativePath(relativePath, { allowEmpty: true });
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

function toRelevantRelativePath(vaultPath: string, absolutePath: string): string | null {
  const relativePath = toVaultRelativePath(vaultPath, absolutePath);
  if (relativePath == null || isIgnoredWatchPath(relativePath)) {
    return null;
  }

  return relativePath;
}

export function getRelevantRelativeWatchPaths(vaultPath: string, absolutePaths: string[]): string[] {
  return absolutePaths
    .map((absolutePath) => toRelevantRelativePath(vaultPath, absolutePath))
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
  vaultPath: string,
  event: Pick<DesktopWatchEvent, 'type' | 'paths'>
): { oldPath: string | null; newPath: string | null } | null {
  const absolutePaths = getAbsoluteRenameWatchPaths(event);
  if (!absolutePaths) {
    return null;
  }

  const oldPath = absolutePaths.oldPath
    ? toRelevantRelativePath(vaultPath, absolutePaths.oldPath)
    : null;
  const newPath = absolutePaths.newPath
    ? toRelevantRelativePath(vaultPath, absolutePaths.newPath)
    : null;

  if (!oldPath && !newPath) {
    return null;
  }

  if (oldPath != null && newPath != null && oldPath === newPath) {
    return null;
  }

  return { oldPath, newPath };
}
