import { moveDesktopItemToTrash } from '@/lib/desktop/trash';
import { getStorageAdapter, joinPath, normalizeAbsolutePath } from '@/lib/storage/adapter';
import { markExpectedExternalChange } from '../../document/externalChangeRegistry';
import { ensureSystemDirectory, getNotesRootSystemStorePath } from '../../systemStoragePaths';
import { isSafeNotesRootPathSegment } from './notesRootPathContainment';
import type { PendingSystemTrashItem } from './trashOperations';

export const PENDING_TRASH_ROOT = 'trash';

const INVALID_PENDING_TRASH_STAGING_PATH_ERROR =
  'Pending trash staging path must stay inside the opened folder pending trash.';
const MAX_PENDING_TRASH_DIRECTORY_COPY_ENTRIES = 20_000;
const MAX_PENDING_TRASH_DIRECTORY_COPY_DEPTH = 200;

export function getParentPath(path: string): string {
  const separatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return separatorIndex > 0 ? path.slice(0, separatorIndex) : '';
}

export function getBaseName(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized.split('/').pop() || normalized;
}

function normalizeContainmentPath(path: string): string {
  return normalizeAbsolutePath(path).replace(/\\/g, '/').replace(/\/+$/, '');
}

export async function assertCurrentNotesRootPendingTrashStagingPath(
  notesPath: string,
  item: PendingSystemTrashItem,
): Promise<void> {
  if (!isSafeNotesRootPathSegment(item.id) || !isSafeNotesRootPathSegment(getBaseName(item.stagingPath))) {
    throw new Error(INVALID_PENDING_TRASH_STAGING_PATH_ERROR);
  }

  const expectedStagingParentPath = await getNotesRootSystemStorePath(notesPath, PENDING_TRASH_ROOT, item.id);
  const stagingParentPath = getParentPath(item.stagingPath);
  if (
    !stagingParentPath ||
    normalizeContainmentPath(stagingParentPath) !== normalizeContainmentPath(expectedStagingParentPath)
  ) {
    throw new Error(INVALID_PENDING_TRASH_STAGING_PATH_ERROR);
  }
}

async function copyDirectory(sourcePath: string, targetPath: string): Promise<void> {
  const storage = getStorageAdapter();
  await storage.mkdir(targetPath, true);
  let copiedEntries = 0;
  const stack = [{ depth: 0, sourcePath, targetPath }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    if (current.depth >= MAX_PENDING_TRASH_DIRECTORY_COPY_DEPTH) {
      throw new Error('Pending trash folder copy exceeded the maximum directory depth.');
    }

    const entries = await storage.listDir(current.sourcePath, { includeHidden: true });
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (copiedEntries >= MAX_PENDING_TRASH_DIRECTORY_COPY_ENTRIES) {
        throw new Error('Pending trash folder copy exceeded the maximum entry count.');
      }

      const entry = entries[index];
      if (!entry || !isSafeNotesRootPathSegment(entry.name)) {
        throw new Error('Pending trash folder copy encountered an unsafe directory entry.');
      }

      const nextSourcePath = await joinPath(current.sourcePath, entry.name);
      const nextTargetPath = await joinPath(current.targetPath, entry.name);
      if (entry.isDirectory) {
        copiedEntries += 1;
        await storage.mkdir(nextTargetPath, true);
        stack.push({ depth: current.depth + 1, sourcePath: nextSourcePath, targetPath: nextTargetPath });
        continue;
      }
      if (entry.isFile) {
        copiedEntries += 1;
        await storage.copyFile(nextSourcePath, nextTargetPath);
        continue;
      }
      throw new Error('Pending trash folder copy encountered an unsupported directory entry.');
    }
  }
}

export async function moveItemWithCopyFallback(
  sourcePath: string,
  targetPath: string,
  kind: 'file' | 'folder',
): Promise<void> {
  const storage = getStorageAdapter();
  try {
    await storage.rename(sourcePath, targetPath);
    return;
  } catch {
    if (kind === 'file') {
      try {
        await storage.copyFile(sourcePath, targetPath);
        try {
          await storage.deleteFile(sourcePath);
        } catch (error) {
          try {
            await storage.deleteFile(targetPath);
          } catch {
          }
          throw error;
        }
      } catch (error) {
        try {
          await storage.deleteFile(targetPath);
        } catch {
        }
        throw error;
      }
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
    try {
      await storage.deleteDir(sourcePath, true);
    } catch (error) {
      try {
        await storage.deleteDir(targetPath, true);
      } catch {
      }
      throw error;
    }
  }
}

export async function deleteStagingContainer(item: PendingSystemTrashItem): Promise<void> {
  const parentPath = getParentPath(item.stagingPath);
  if (!parentPath) {
    return;
  }

  try {
    await getStorageAdapter().deleteDir(parentPath, true);
  } catch {
  }
}

export async function pathExists(path: string): Promise<boolean> {
  return getStorageAdapter().exists(path).catch(() => false);
}

export function markExpectedItemChange(item: PendingSystemTrashItem, path: string): void {
  markExpectedExternalChange(path, item.kind === 'folder');
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function moveOriginalBackToStaging(item: PendingSystemTrashItem): Promise<void> {
  const stagingParentPath = getParentPath(item.stagingPath);
  if (stagingParentPath) {
    await ensureSystemDirectory(stagingParentPath);
  }
  markExpectedItemChange(item, item.originalFullPath);
  await moveItemWithCopyFallback(item.originalFullPath, item.stagingPath, item.kind);
}

export async function trashViaOriginalPath(item: PendingSystemTrashItem): Promise<boolean> {
  if (await pathExists(item.originalFullPath)) {
    return false;
  }

  try {
    markExpectedItemChange(item, item.originalFullPath);
    await moveItemWithCopyFallback(item.stagingPath, item.originalFullPath, item.kind);
  } catch (error) {
    const [stagingStillExists, originalExistsAfterFailure] = await Promise.all([
      pathExists(item.stagingPath),
      pathExists(item.originalFullPath),
    ]);
    if (stagingStillExists && !originalExistsAfterFailure) {
      return false;
    }
    throw error;
  }

  try {
    markExpectedItemChange(item, item.originalFullPath);
    await moveDesktopItemToTrash(item.originalFullPath);
    await deleteStagingContainer(item);
    return true;
  } catch (error) {
    try {
      await moveOriginalBackToStaging(item);
    } catch (rollbackError) {
      throw new Error(
        `Failed to move deleted item to system trash and restore pending state: ${getErrorMessage(error)
        }; rollback failed: ${getErrorMessage(rollbackError)}`
      );
    }
    throw error;
  }
}
