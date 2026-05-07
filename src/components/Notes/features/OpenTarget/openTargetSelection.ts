import { getBaseName, getParentPath } from '@/lib/storage/adapter';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';

export interface ResolvedOpenNoteTarget {
  vaultPath: string;
  notePath: string;
}

export function getSingleOpenSelection(selection: string | string[] | null): string | null {
  if (!selection) return null;
  return Array.isArray(selection) ? selection[0] ?? null : selection;
}

export function isSupportedMarkdownSelection(path: string): boolean {
  return isSupportedMarkdownPath(path);
}

export function resolveOpenNoteTarget(absoluteFilePath: string): ResolvedOpenNoteTarget {
  const parentPath = getParentPath(absoluteFilePath);

  if (!parentPath) {
    throw new Error('Cannot determine the parent folder for the selected file');
  }

  return {
    vaultPath: parentPath,
    notePath: getBaseName(absoluteFilePath),
  };
}
