import { ensureMarkdownFileName } from '@/lib/notes/displayName';
import { sanitizeFileName } from '@/stores/notes/noteUtils';
import type { CloudRepoNodeKind } from './types';

export const CLOUD_FOLDER_KEEP_FILE = '.nekotick.keep';
export const CLOUD_DEFAULT_NOTE_NAME = 'Untitled';
export const CLOUD_DEFAULT_FOLDER_NAME = 'New Folder';

export function normalizeCloudRelativePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/').replace(/\/+$/, '');
}

export function joinCloudRelativePath(parentPath: string, name: string): string {
  const normalizedParent = normalizeCloudRelativePath(parentPath);
  const normalizedName = name.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!normalizedParent) return normalizedName;
  if (!normalizedName) return normalizedParent;
  return `${normalizedParent}/${normalizedName}`;
}

export function getCloudParentPath(path: string): string {
  const normalizedPath = normalizeCloudRelativePath(path);
  const lastSlash = normalizedPath.lastIndexOf('/');
  return lastSlash === -1 ? '' : normalizedPath.slice(0, lastSlash);
}

export function getCloudBaseName(path: string): string {
  const normalizedPath = normalizeCloudRelativePath(path);
  return normalizedPath.split('/').pop() || normalizedPath;
}

export function createFolderKeepFilePath(folderPath: string): string {
  return joinCloudRelativePath(folderPath, CLOUD_FOLDER_KEEP_FILE);
}

export function createUniqueNotePath(
  existingPaths: Set<string>,
  parentPath: string,
  requestedName?: string
): string {
  const baseName = ensureMarkdownFileName(sanitizeFileName(requestedName?.trim() || CLOUD_DEFAULT_NOTE_NAME));
  const normalizedParent = normalizeCloudRelativePath(parentPath);
  const baseTitle = baseName.replace(/\.md$/i, '');

  let candidate = joinCloudRelativePath(normalizedParent, baseName);
  if (!existingPaths.has(candidate)) return candidate;

  let index = 2;
  while (true) {
    candidate = joinCloudRelativePath(normalizedParent, `${baseTitle} ${index}.md`);
    if (!existingPaths.has(candidate)) return candidate;
    index += 1;
  }
}

export function createUniqueFolderPath(
  existingPaths: Set<string>,
  parentPath: string,
  requestedName?: string
): string {
  const baseName = sanitizeFileName(requestedName?.trim() || CLOUD_DEFAULT_FOLDER_NAME);
  const normalizedParent = normalizeCloudRelativePath(parentPath);

  let candidate = joinCloudRelativePath(normalizedParent, baseName);
  if (!existingPaths.has(candidate)) return candidate;

  let index = 2;
  while (true) {
    candidate = joinCloudRelativePath(normalizedParent, `${baseName} ${index}`);
    if (!existingPaths.has(candidate)) return candidate;
    index += 1;
  }
}

export function createRenamedPath(
  path: string,
  kind: CloudRepoNodeKind,
  requestedName: string
): string {
  const sanitizedName = sanitizeFileName(requestedName.trim());
  const parentPath = getCloudParentPath(path);
  const nextName = kind === 'file' ? ensureMarkdownFileName(sanitizedName) : sanitizedName;
  return joinCloudRelativePath(parentPath, nextName);
}

export function remapCloudPathPrefix(path: string, fromPrefix: string, toPrefix: string): string {
  const normalizedPath = normalizeCloudRelativePath(path);
  const normalizedFrom = normalizeCloudRelativePath(fromPrefix);
  const normalizedTo = normalizeCloudRelativePath(toPrefix);

  if (normalizedPath === normalizedFrom) return normalizedTo;
  return `${normalizedTo}${normalizedPath.slice(normalizedFrom.length)}`;
}
