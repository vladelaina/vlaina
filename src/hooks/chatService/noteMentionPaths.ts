import { isAuthorizedExternalNoteMentionPath } from '@/lib/ai/authorizedExternalNoteMentions';
import {
  isAbsolutePath as isStorageAbsolutePath,
  joinPath,
  normalizeAbsolutePath,
} from '@/lib/storage/adapter';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import {
  hasUnsafeNotesRootPathSegment,
  normalizeNotesRootRelativePath,
  resolveNotesRootRelativeFullPath,
} from '@/stores/notes/utils/fs/notesRootPathContainment';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';

export function normalizeAbsoluteMentionPathForCompare(path: string): string {
  const normalized = normalizeAbsolutePath(path.trim()).replace(/\\/g, '/');
  const withoutTrailingSlash = normalized === '/' || /^[A-Za-z]:\/$/i.test(normalized)
    ? normalized
    : normalized.replace(/\/+$/g, '');
  return /^[A-Za-z]:\//.test(withoutTrailingSlash) || withoutTrailingSlash.startsWith('//')
    ? withoutTrailingSlash.toLowerCase()
    : withoutTrailingSlash;
}

export function hasUnsafeMentionPathSegment(path: string): boolean {
  return hasUnsafeNotesRootPathSegment(path);
}

export function isInsideInternalFolderMarkdownPath(path: string): boolean {
  return hasInternalNotePathSegment(path);
}

async function getStarredAbsoluteMentionPath(entry: {
  kind: 'note' | 'folder';
  notesRootPath: string;
  relativePath: string;
}): Promise<string | null> {
  const notesRootPath = normalizeAbsolutePath(entry.notesRootPath.trim());
  const relativePath = normalizeNotesRootRelativePath(entry.relativePath);
  if (
    !notesRootPath ||
    !isStorageAbsolutePath(notesRootPath) ||
    isInsideInternalFolderMarkdownPath(notesRootPath) ||
    hasUnsafeMentionPathSegment(notesRootPath) ||
    !relativePath ||
    isInsideInternalFolderMarkdownPath(relativePath) ||
    (entry.kind === 'note' && !isSupportedMarkdownPath(relativePath))
  ) {
    return null;
  }
  return joinPath(notesRootPath, relativePath);
}

async function resolveStarredAbsoluteMentionPath(
  mentionPath: string,
  kind: 'note' | 'folder',
): Promise<string | null> {
  const targetPath = normalizeAbsoluteMentionPathForCompare(mentionPath);
  const entries = useNotesStore.getState().starredEntries ?? [];
  for (const entry of entries) {
    if (entry.kind !== kind) {
      continue;
    }
    const absolutePath = await getStarredAbsoluteMentionPath(entry);
    if (absolutePath && normalizeAbsoluteMentionPathForCompare(absolutePath) === targetPath) {
      return absolutePath;
    }
  }
  return null;
}

export async function resolveMentionedPath(
  mentionPath: string,
  kind: 'note' | 'folder',
): Promise<{ cachePath: string; fullPath: string } | null> {
  if (
    isInsideInternalFolderMarkdownPath(mentionPath) ||
    hasUnsafeMentionPathSegment(mentionPath) ||
    (kind === 'note' && !isSupportedMarkdownPath(mentionPath))
  ) {
    return null;
  }

  if (isStorageAbsolutePath(mentionPath)) {
    const fullPath = await resolveStarredAbsoluteMentionPath(mentionPath, kind);
    if (fullPath) {
      return { cachePath: fullPath, fullPath };
    }
    if (kind === 'note' && isAuthorizedExternalNoteMentionPath(mentionPath)) {
      const normalizedPath = normalizeAbsolutePath(mentionPath.trim());
      return { cachePath: normalizedPath, fullPath: normalizedPath };
    }
    return null;
  }

  const notesPath = useNotesStore.getState().notesPath;
  if (!notesPath) {
    return null;
  }

  try {
    const { relativePath, fullPath } = await resolveNotesRootRelativeFullPath(notesPath, mentionPath);
    return { cachePath: relativePath, fullPath };
  } catch {
    return null;
  }
}

export async function resolveMentionedFolderPath(folderPath: string): Promise<string | null> {
  return (await resolveMentionedPath(folderPath, 'folder'))?.fullPath ?? null;
}
