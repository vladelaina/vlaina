import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { resolveUniqueName } from '@/lib/naming/uniqueName';
import { markExpectedExternalChange } from '../../document/externalChangeRegistry';
import { ensureSystemDirectory, getVaultSystemStorePath } from '../../systemStoragePaths';
import { assertNonInternalNotePath, hasInternalNotePathSegment } from './internalNotePaths';
import {
  isSafeVaultPathSegment,
  normalizeVaultRelativePath,
  resolveVaultRelativeFullPath,
} from './vaultPathContainment';

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
  const entries = await storage.listDir(sourcePath, { includeHidden: true });

  for (const entry of entries) {
    if (!isSafeVaultPathSegment(entry.name)) {
      continue;
    }
    if (hasInternalNotePathSegment(entry.name)) {
      continue;
    }

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
      try {
        await storage.copyFile(sourcePath, targetPath);
      } catch (error) {
        try {
          await storage.deleteFile(targetPath);
        } catch {
        }
        throw error;
      }
      await storage.deleteFile(sourcePath);
      return;
    }

    try {
      await copyDirectory(sourcePath, targetPath);
    } catch (error) {
      try {
        await storage.deleteDir(targetPath, true);
      } catch {
      }
      throw error;
    }
    await storage.deleteDir(sourcePath, true);
  }
}

export async function deleteNoteItemToRecoverableLocation(
  notesPath: string,
  relativePath: string,
  kind: 'file' | 'folder'
): Promise<RecoverableDeletedItem> {
  const id = createDeleteId();
  const { relativePath: safeRelativePath, fullPath: originalFullPath } =
    await resolveVaultRelativeFullPath(notesPath, relativePath);
  assertNonInternalNotePath(safeRelativePath);
  const trashDir = await getVaultSystemStorePath(notesPath, RECOVERABLE_TRASH_ROOT, id);
  const trashPath = await joinPath(trashDir, getBaseName(safeRelativePath));

  await ensureSystemDirectory(trashDir);
  await moveRecoverableItem(originalFullPath, trashPath, kind);

  return {
    id,
    kind,
    originalPath: safeRelativePath,
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
  const safeOriginalPath = normalizeVaultRelativePath(item.originalPath);
  if (!safeOriginalPath) {
    throw new Error('Restore target must stay inside the current vault.');
  }
  assertNonInternalNotePath(safeOriginalPath, 'Restore target must not be inside an internal notes folder.');

  const parentPath = getParentPath(safeOriginalPath);
  const originalName = getBaseName(safeOriginalPath);
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
