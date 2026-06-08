import { getBaseName, getParentPath, isAbsolutePath, normalizeAbsolutePath } from '@/lib/storage/adapter';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { APP_CONFIG_FOLDER } from '@/stores/notes/constants';

export interface ResolvedOpenNoteTarget {
  vaultPath: string;
  notePath: string;
}

export function getSingleOpenSelection(selection: string | string[] | null): string | null {
  if (!selection) return null;
  return Array.isArray(selection) ? selection[0] ?? null : selection;
}

const INTERNAL_MARKDOWN_SELECTION_SEGMENTS = new Set([APP_CONFIG_FOLDER, '.git']);

function isInternalMarkdownSelectionPath(path: string): boolean {
  return path
    .replace(/\\/g, '/')
    .split('/')
    .some((segment) => INTERNAL_MARKDOWN_SELECTION_SEGMENTS.has(segment));
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
