import type { DesktopWatchEvent } from '@/lib/desktop/watch';
import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { APP_CONFIG_FOLDER } from '@/stores/notes/constants';

export function normalizeFsPath(path: string): string {
  return normalizeNotePathKey(path) ?? path;
}

export function isInsideVault(vaultPath: string, absolutePath: string): boolean {
  const normalizedVaultPath = normalizeFsPath(vaultPath);
  const normalizedAbsolutePath = normalizeFsPath(absolutePath);
  return (
    normalizedAbsolutePath === normalizedVaultPath ||
    normalizedAbsolutePath.startsWith(`${normalizedVaultPath}/`)
  );
}

export function toVaultRelativePath(vaultPath: string, absolutePath: string): string | null {
  const normalizedVaultPath = normalizeFsPath(vaultPath);
  const normalizedAbsolutePath = normalizeFsPath(absolutePath);

  if (!isInsideVault(normalizedVaultPath, normalizedAbsolutePath)) {
    return null;
  }

  if (normalizedAbsolutePath === normalizedVaultPath) {
    return '';
  }

  return normalizedAbsolutePath.slice(normalizedVaultPath.length + 1);
}

export function isIgnoredWatchPath(relativePath: string): boolean {
  if (!relativePath) {
    return false;
  }

  if (relativePath === APP_CONFIG_FOLDER || relativePath.startsWith(`${APP_CONFIG_FOLDER}/`)) {
    return true;
  }

  return relativePath.endsWith('.tmp');
}

export function isMarkdownPath(relativePath: string): boolean {
  return relativePath.toLowerCase().endsWith('.md');
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
