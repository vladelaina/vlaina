import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { resolveUniqueName } from '@/lib/naming/uniqueName';
import { markExpectedExternalChange } from '../../document/externalChangeRegistry';
import { ensureSystemDirectory, getVaultSystemStorePath } from '../../systemStoragePaths';

const RECOVERABLE_TRASH_ROOT = 'trash';

export interface RecoverableDeletedItem {
  id: string;
  kind: 'file' | 'folder';
  originalPath: string;
  originalFullPath: string;
  trashPath: string;
  deletedAt: number;
}

export interface RestoreRecoverableDeleteResult {
  restoredPath: string;
  restoredFullPath: string;
}

function getParentPath(path: string): string {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
}

function getBaseName(path: string): string {
  return path.split('/').pop() || path;
}

function createDeleteId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function copyDirectory(sourcePath: string, targetPath: string): Promise<void> {
  const storage = getStorageAdapter();
  await storage.mkdir(targetPath, true);
  const entries = await storage.listDir(sourcePath);

  for (const entry of entries) {
    const nextSourcePath = await joinPath(sourcePath, entry.name);
    const nextTargetPath = await joinPath(targetPath, entry.name);
    if (entry.isDirectory) {
      await copyDirectory(nextSourcePath, nextTargetPath);
      continue;
    }
    if (entry.isFile) {
      await storage.copyFile(nextSourcePath, nextTargetPath);
    }
  }
}

async function moveRecoverableItem(
  sourcePath: string,
  targetPath: string,
  kind: 'file' | 'folder'
): Promise<void> {
  const storage = getStorageAdapter();
  try {
    await storage.rename(sourcePath, targetPath);
    return;
  } catch {
    if (kind === 'file') {
      await storage.copyFile(sourcePath, targetPath);
      await storage.deleteFile(sourcePath);
      return;
    }

    await copyDirectory(sourcePath, targetPath);
    await storage.deleteDir(sourcePath, true);
  }
}

export async function deleteNoteItemToRecoverableLocation(
  notesPath: string,
  relativePath: string,
  kind: 'file' | 'folder'
): Promise<RecoverableDeletedItem> {
  const id = createDeleteId();
  const originalFullPath = await joinPath(notesPath, relativePath);
  const trashDir = await getVaultSystemStorePath(notesPath, RECOVERABLE_TRASH_ROOT, id);
  const trashPath = await joinPath(trashDir, getBaseName(relativePath));

  await ensureSystemDirectory(trashDir);
  await moveRecoverableItem(originalFullPath, trashPath, kind);

  return {
    id,
    kind,
    originalPath: relativePath,
    originalFullPath,
    trashPath,
    deletedAt: Date.now(),
  };
}

export async function restoreNoteItemFromRecoverableLocation(
  notesPath: string,
  item: RecoverableDeletedItem,
): Promise<RestoreRecoverableDeleteResult> {
  const storage = getStorageAdapter();
  const parentPath = getParentPath(item.originalPath);
  const originalName = getBaseName(item.originalPath);
  const restoredName = await resolveUniqueName(
    originalName,
    async (candidateName) => {
      const candidateRelativePath = parentPath ? `${parentPath}/${candidateName}` : candidateName;
      const candidateFullPath = await joinPath(notesPath, candidateRelativePath);
      return storage.exists(candidateFullPath);
    },
    {
      splitExtension: item.kind === 'file',
    },
  );
  const restoredPath = parentPath ? `${parentPath}/${restoredName}` : restoredName;
  const restoredFullPath = await joinPath(notesPath, restoredPath);

  if (parentPath) {
    await storage.mkdir(await joinPath(notesPath, parentPath), true);
  }

  markExpectedExternalChange(item.trashPath);
  markExpectedExternalChange(restoredFullPath);
  await moveRecoverableItem(item.trashPath, restoredFullPath, item.kind);

  return {
    restoredPath,
    restoredFullPath,
  };
}
