import { getBaseName, getParentPath, isAbsolutePath, normalizeAbsolutePath } from '@/lib/storage/adapter';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';

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

export function isSupportedMarkdownSelection(path: string): boolean {
  return isSupportedMarkdownPath(path) && !isInternalMarkdownSelectionPath(path);
}

export function resolveOpenNoteTarget(absoluteFilePath: string): ResolvedOpenNoteTarget {
  const normalizedFilePath = normalizeAbsolutePath(absoluteFilePath);
  if (!isAbsolutePath(normalizedFilePath)) {
    throw new Error('Selected file path must be absolute');
  }
  if (isInternalMarkdownSelectionPath(normalizedFilePath)) {
    throw new Error('Selected file path must not be inside an internal notes folder');
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
