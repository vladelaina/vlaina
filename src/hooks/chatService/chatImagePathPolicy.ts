import { normalizeContainedAssetPath } from '@/lib/assets/core/pathContainment';
import {
  isAbsolutePath as isStorageAbsolutePath,
  normalizeAbsolutePath,
} from '@/lib/storage/adapter';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { normalizeNotesRootRelativePath } from '@/stores/notes/utils/fs/notesRootPathContainment';
import {
  hasUnsafeMentionPathSegment,
  isInsideInternalFolderMarkdownPath,
} from './noteMentionPaths';

function isCurrentNotesRootImageAttachmentPath(path: string): boolean {
  const notesPath = useNotesStore.getState().notesPath?.trim();
  if (!notesPath) {
    return false;
  }

  const containedPath = normalizeContainedAssetPath(path, notesPath);
  return Boolean(containedPath && !isInsideInternalFolderMarkdownPath(containedPath));
}

function joinAbsolutePathSync(basePath: string, relativePath: string): string | null {
  const normalizedBasePath = normalizeAbsolutePath(basePath.trim()).replace(/\\/g, '/');
  const normalizedBase = normalizedBasePath === '/' || /^[A-Za-z]:\/$/i.test(normalizedBasePath)
    ? normalizedBasePath
    : normalizedBasePath.replace(/\/+$/g, '');
  const normalizedRelative = normalizeNotesRootRelativePath(relativePath);
  if (
    !normalizedBase ||
    !isStorageAbsolutePath(normalizedBase) ||
    hasUnsafeMentionPathSegment(normalizedBase) ||
    isInsideInternalFolderMarkdownPath(normalizedBase) ||
    !normalizedRelative ||
    isInsideInternalFolderMarkdownPath(normalizedRelative)
  ) {
    return null;
  }

  return normalizedBase.endsWith('/')
    ? `${normalizedBase}${normalizedRelative}`
    : `${normalizedBase}/${normalizedRelative}`;
}

function isStarredFolderImageAttachmentPath(path: string): boolean {
  const normalizedPath = normalizeAbsolutePath(path.trim());
  if (
    !normalizedPath ||
    !isStorageAbsolutePath(normalizedPath) ||
    hasUnsafeMentionPathSegment(normalizedPath) ||
    isInsideInternalFolderMarkdownPath(normalizedPath)
  ) {
    return false;
  }

  const starredEntries = useNotesStore.getState().starredEntries ?? [];
  return starredEntries.some((entry) => {
    if (
      entry.kind !== 'folder' ||
      isInsideInternalFolderMarkdownPath(entry.notesRootPath) ||
      isInsideInternalFolderMarkdownPath(entry.relativePath)
    ) {
      return false;
    }
    const folderPath = joinAbsolutePathSync(entry.notesRootPath, entry.relativePath);
    if (!folderPath) {
      return false;
    }
    const containedPath = normalizeContainedAssetPath(normalizedPath, folderPath);
    return Boolean(containedPath && !isInsideInternalFolderMarkdownPath(containedPath));
  });
}

export function isAllowedChatImageAttachmentPath(path: string): boolean {
  return isCurrentNotesRootImageAttachmentPath(path) || isStarredFolderImageAttachmentPath(path);
}
