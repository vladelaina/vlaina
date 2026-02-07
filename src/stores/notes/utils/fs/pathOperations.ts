import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { sanitizeFileName } from '../../noteUtils';

export async function resolveUniquePath(
  basePath: string,
  folderPath: string | undefined,
  name: string,
  isDirectory: boolean
): Promise<{ relativePath: string; fullPath: string; fileName: string }> {
  const storage = getStorageAdapter();
  
  let fileName = isDirectory ? name : (name.endsWith('.md') ? name : `${name}.md`);
  
  // If name is provided, sanitize it. If not provided (Untitled), we handle it in loop
  if (name) {
      const sanitized = sanitizeFileName(name);
      fileName = isDirectory ? sanitized : (sanitized.endsWith('.md') ? sanitized : `${sanitized}.md`);
  } else {
      fileName = isDirectory ? 'Untitled' : 'Untitled.md';
  }

  let relativePath = folderPath ? `${folderPath}/${fileName}` : fileName;
  let fullPath = await joinPath(basePath, relativePath);

  let counter = 1;
  const originalName = isDirectory ? fileName : fileName.replace('.md', '');
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
