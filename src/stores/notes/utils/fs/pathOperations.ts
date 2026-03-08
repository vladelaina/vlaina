import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { ensureMarkdownFileName, stripMarkdownExtension } from '@/lib/notes/displayName';
import { sanitizeFileName } from '../../noteUtils';

export async function resolveUniquePath(
  basePath: string,
  folderPath: string | undefined,
  name: string,
  isDirectory: boolean
): Promise<{ relativePath: string; fullPath: string; fileName: string }> {
  const storage = getStorageAdapter();
  
  let fileName = isDirectory ? name : ensureMarkdownFileName(name);
  
  if (name) {
      const sanitized = sanitizeFileName(name);
      fileName = isDirectory ? sanitized : ensureMarkdownFileName(sanitized);
  } else {
      fileName = isDirectory ? 'Untitled' : 'Untitled.md';
  }

  let relativePath = folderPath ? `${folderPath}/${fileName}` : fileName;
  let fullPath = await joinPath(basePath, relativePath);

  let counter = 1;
  const originalName = isDirectory ? fileName : stripMarkdownExtension(fileName);
  const ext = isDirectory ? '' : '.md';

  while (await storage.exists(fullPath)) {
    const newName = `${originalName} ${counter}${ext}`;
    relativePath = folderPath ? `${folderPath}/${newName}` : newName;
    fullPath = await joinPath(basePath, relativePath);
    fileName = newName;
    counter++;
  }

  return { relativePath, fullPath, fileName };
}

export function getParentPath(path: string): string {
    return path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
}
