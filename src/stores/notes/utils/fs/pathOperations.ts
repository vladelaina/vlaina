import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { resolveUniqueName } from '@/lib/naming/uniqueName';
import { ensureMarkdownFileName } from '@/lib/notes/displayName';
import { sanitizeFileName } from '../../noteUtils';
import { normalizeVaultRelativePath } from './vaultPathContainment';

function normalizeDesiredFileName(name: string, isDirectory: boolean) {
  if (name) {
    const sanitized = sanitizeFileName(name);
    return isDirectory ? sanitized : ensureMarkdownFileName(sanitized);
  } else {
    return isDirectory ? 'Untitled' : 'Untitled.md';
  }
}

async function resolveUniqueTargetPath(
  basePath: string,
  folderPath: string | undefined,
  fileName: string,
  isDirectory: boolean,
  ignoredRelativePath?: string
) {
  const storage = getStorageAdapter();
  const safeFolderPath = folderPath
    ? normalizeVaultRelativePath(folderPath, { allowEmpty: true })
    : '';
  if (safeFolderPath == null) {
    throw new Error('Target folder must stay inside the current vault.');
  }

  const resolvedFileName = await resolveUniqueName(
    fileName,
    async (candidateName) => {
      const candidateRelativePath = safeFolderPath ? `${safeFolderPath}/${candidateName}` : candidateName;
      if (candidateRelativePath === ignoredRelativePath) {
        return false;
      }
      const candidateFullPath = await joinPath(basePath, candidateRelativePath);
      return storage.exists(candidateFullPath);
    },
    { splitExtension: !isDirectory }
  );
  const relativePath = safeFolderPath ? `${safeFolderPath}/${resolvedFileName}` : resolvedFileName;
  const fullPath = await joinPath(basePath, relativePath);
  return { relativePath, fullPath, fileName: resolvedFileName };
}

export async function resolveUniquePath(
  basePath: string,
  folderPath: string | undefined,
  name: string,
  isDirectory: boolean
): Promise<{ relativePath: string; fullPath: string; fileName: string }> {
  const fileName = normalizeDesiredFileName(name, isDirectory);
  return resolveUniqueTargetPath(basePath, folderPath, fileName, isDirectory);
}

export async function resolveUniqueRenamedPath(
  basePath: string,
  currentPath: string,
  nextName: string,
  isDirectory: boolean
) {
  const normalizedCurrentPath = normalizeVaultRelativePath(currentPath);
  if (!normalizedCurrentPath) {
    throw new Error('Path must stay inside the current vault.');
  }

  const folderPath = getParentPath(normalizedCurrentPath) || undefined;
  const fileName = normalizeDesiredFileName(nextName, isDirectory);
  return resolveUniqueTargetPath(basePath, folderPath, fileName, isDirectory, normalizedCurrentPath);
}

export async function resolveUniqueMovedPath(
  basePath: string,
  sourcePath: string,
  targetFolderPath: string | undefined,
  isDirectory: boolean
) {
  const normalizedSourcePath = normalizeVaultRelativePath(sourcePath);
  const normalizedTargetFolderPath = targetFolderPath
    ? normalizeVaultRelativePath(targetFolderPath, { allowEmpty: true })
    : '';
  if (!normalizedSourcePath || normalizedTargetFolderPath == null) {
    throw new Error('Path must stay inside the current vault.');
  }

  const sourceName = normalizedSourcePath.split('/').pop() || (isDirectory ? 'Untitled' : 'Untitled.md');
  return resolveUniqueTargetPath(
    basePath,
    normalizedTargetFolderPath || undefined,
    sourceName,
    isDirectory,
    normalizedSourcePath,
  );
}

export function getParentPath(path: string): string {
    return path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
}
