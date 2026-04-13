import { getBaseName, getParentPath, getExtension } from '@/lib/storage/adapter';

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdown', 'mkd']);

export interface ResolvedOpenNoteTarget {
  vaultPath: string;
  notePath: string;
}

export function getSingleOpenSelection(selection: string | string[] | null): string | null {
  if (!selection) return null;
  return Array.isArray(selection) ? selection[0] ?? null : selection;
}

export function isSupportedMarkdownSelection(path: string): boolean {
  const extension = getExtension(path).toLowerCase();
  return MARKDOWN_EXTENSIONS.has(extension);
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
