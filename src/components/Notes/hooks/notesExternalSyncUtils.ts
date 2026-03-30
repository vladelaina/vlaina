import type { WatchEvent } from '@tauri-apps/plugin-fs';
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
  const uniquePaths = new Set<string>();

  for (const absolutePath of absolutePaths) {
    const relativePath = toRelevantRelativePath(vaultPath, normalizeFsPath(absolutePath));
    if (relativePath != null) {
      uniquePaths.add(relativePath);
    }
  }

  return Array.from(uniquePaths);
}

export function isRemoveWatchEvent(event: Pick<WatchEvent, 'type'>): boolean {
  return typeof event.type !== 'string' && 'remove' in event.type;
}

export function getRelativeRenameWatchPaths(
  vaultPath: string,
  event: Pick<WatchEvent, 'type' | 'paths'>
): { oldPath: string | null; newPath: string | null } | null {
  if (typeof event.type === 'string' || !('modify' in event.type) || event.type.modify.kind !== 'rename') {
    return null;
  }

  const normalizedPaths = event.paths.map((path) => normalizeFsPath(path));
  const firstPath = normalizedPaths[0]
    ? toRelevantRelativePath(vaultPath, normalizedPaths[0])
    : null;
  const secondPath = normalizedPaths[1]
    ? toRelevantRelativePath(vaultPath, normalizedPaths[1])
    : null;

  let oldPath: string | null = null;
  let newPath: string | null = null;

  switch (event.type.modify.mode) {
    case 'from':
      oldPath = firstPath;
      break;
    case 'to':
      newPath = firstPath;
      break;
    case 'both':
    case 'any':
    case 'other':
    default:
      oldPath = firstPath;
      newPath = secondPath;
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
