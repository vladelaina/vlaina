import { getBaseName, getParentPath, isAbsolutePath, normalizeAbsolutePath } from '@/lib/storage/adapter';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import { isSafeVaultPathSegment } from '@/stores/notes/utils/fs/vaultPathContainment';

const EXPLICIT_URL_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const BACKSLASH_ESCAPED_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*\\+:/;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;

export interface ResolvedOpenNoteTarget {
  vaultPath: string;
  notePath: string;
}

export function getSingleOpenSelection(selection: string | string[] | null): string | null {
  if (!selection) return null;
  return Array.isArray(selection) ? selection[0] ?? null : selection;
}

function isInternalMarkdownSelectionPath(path: string): boolean {
  return hasInternalNotePathSegment(path);
}

function normalizeMarkdownSelectionPath(path: string): string {
  return isAbsolutePath(path) ? normalizeAbsolutePath(path) : path;
}

function hasExplicitNonPathScheme(path: string): boolean {
  const trimmed = path.trim();
  return (
    (EXPLICIT_URL_SCHEME_PATTERN.test(trimmed) && !WINDOWS_ABSOLUTE_PATH_PATTERN.test(trimmed)) ||
    BACKSLASH_ESCAPED_SCHEME_PATTERN.test(trimmed)
  );
}

function hasUnsafeMarkdownSelectionPathSegment(path: string): boolean {
  return path
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .some((segment) => !isSafeVaultPathSegment(segment));
}

export function isSupportedMarkdownSelection(path: string): boolean {
  if (hasExplicitNonPathScheme(path)) {
    return false;
  }

  const normalizedPath = normalizeMarkdownSelectionPath(path);
  return (
    isSupportedMarkdownPath(normalizedPath) &&
    !isInternalMarkdownSelectionPath(normalizedPath) &&
    !hasUnsafeMarkdownSelectionPathSegment(normalizedPath)
  );
}

export function resolveOpenNoteTarget(absoluteFilePath: string): ResolvedOpenNoteTarget {
  const normalizedFilePath = normalizeAbsolutePath(absoluteFilePath);
  if (!isAbsolutePath(normalizedFilePath)) {
    throw new Error('Selected file path must be absolute');
  }
  if (!isSupportedMarkdownPath(normalizedFilePath)) {
    throw new Error('Selected file path must be a supported Markdown file');
  }
  if (isInternalMarkdownSelectionPath(normalizedFilePath)) {
    throw new Error('Selected file path must not be inside an internal notes folder');
  }
  if (hasUnsafeMarkdownSelectionPathSegment(normalizedFilePath)) {
    throw new Error('Selected file path contains unsupported characters');
  }

  const parentPath = getParentPath(normalizedFilePath);

  if (!parentPath) {
    throw new Error('Cannot determine the parent folder for the selected file');
  }

  return {
    vaultPath: parentPath,
    notePath: getBaseName(normalizedFilePath),
  };
}
