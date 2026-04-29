import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { resolveUniqueName } from '@/lib/naming/uniqueName';
import { markExpectedExternalChange } from '../../document/externalChangeRegistry';

const RECOVERABLE_TRASH_ROOT = '.vlaina/trash';

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

export async function deleteNoteItemToRecoverableLocation(
  notesPath: string,
  relativePath: string,
  kind: 'file' | 'folder'
): Promise<RecoverableDeletedItem> {
  const storage = getStorageAdapter();
  const id = createDeleteId();
  const originalFullPath = await joinPath(notesPath, relativePath);
  const trashDir = await joinPath(notesPath, RECOVERABLE_TRASH_ROOT, id);
  const trashPath = await joinPath(trashDir, getBaseName(relativePath));

  await storage.mkdir(trashDir, true);
  await storage.rename(originalFullPath, trashPath);

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
  await storage.rename(item.trashPath, restoredFullPath);

  return {
    restoredPath,
    restoredFullPath,
  };
}
