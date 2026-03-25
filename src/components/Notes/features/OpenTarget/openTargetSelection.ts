import { getBaseName, getParentPath, getStorageAdapter, getExtension, joinPath, relativePath } from '@/lib/storage/adapter';

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

export async function resolveOpenNoteTarget(absoluteFilePath: string): Promise<ResolvedOpenNoteTarget> {
  const storage = getStorageAdapter();
  const parentPath = getParentPath(absoluteFilePath);

  if (!parentPath) {
    throw new Error('Cannot determine the parent folder for the selected file');
  }

  let cursor: string | null = parentPath;

  while (cursor) {
    const configPath = await joinPath(cursor, '.vlaina', 'store', 'config.json');
    if (await storage.exists(configPath)) {
      return {
        vaultPath: cursor,
        notePath: relativePath(cursor, absoluteFilePath),
      };
    }

    const nextCursor = getParentPath(cursor);
    if (!nextCursor || nextCursor === cursor) {
      break;
    }
    cursor = nextCursor;
  }

  return {
    vaultPath: parentPath,
    notePath: getBaseName(absoluteFilePath),
  };
}
