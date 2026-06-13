import { moveDesktopItemToTrash } from '@/lib/desktop/trash';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { resolveUniqueName } from '@/lib/naming/uniqueName';
import { ensureSystemDirectory, getVaultSystemStorePath } from '../../systemStoragePaths';
import { markExpectedExternalChange } from '../../document/externalChangeRegistry';
import { assertNonInternalNotePath } from './internalNotePaths';
import {
  isSafeVaultPathSegment,
  normalizeVaultRelativePath,
  resolveVaultRelativeFullPath,
} from './vaultPathContainment';

const PENDING_TRASH_ROOT = 'pending-trash';
export const NOTES_DELETE_UNDO_GRACE_PERIOD_MS = 30_000;
export const MAX_PENDING_TRASH_DIRECTORY_COPY_ENTRIES = 20_000;
export const MAX_PENDING_TRASH_DIRECTORY_COPY_DEPTH = 200;

export interface PendingSystemTrashItem {
  id: string;
  kind: 'file' | 'folder';
  originalPath: string;
  originalFullPath: string;
  stagingPath: string;
  deletedAt: number;
}

export interface RestorePendingTrashResult {
  restoredPath: string;
  restoredFullPath: string;
}

type PendingTrashTimer = ReturnType<typeof setTimeout>;

const pendingTrashTimers = new Map<string, PendingTrashTimer>();
const committingPendingTrashIds = new Set<string>();

function createDeleteId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getParentPath(path: string): string {
  const separatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return separatorIndex > 0 ? path.slice(0, separatorIndex) : '';
}

function getBaseName(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized.split('/').pop() || normalized;
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
      if (!entry || !isSafeVaultPathSegment(entry.name)) {
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

async function moveItemWithCopyFallback(
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

async function deleteStagingContainer(item: PendingSystemTrashItem): Promise<void> {
  const parentPath = getParentPath(item.stagingPath);
  if (!parentPath) {
    return;
  }

  try {
    await getStorageAdapter().deleteDir(parentPath, true);
  } catch {
  }
}

async function pathExists(path: string): Promise<boolean> {
  return getStorageAdapter().exists(path).catch(() => false);
}

function markExpectedItemChange(item: PendingSystemTrashItem, path: string): void {
  markExpectedExternalChange(path, item.kind === 'folder');
}

function clearPendingSystemTrashTimer(id: string): boolean {
  const timer = pendingTrashTimers.get(id);
  if (!timer) {
    return false;
  }

  clearTimeout(timer);
  pendingTrashTimers.delete(id);
  return true;
}

function beginPendingSystemTrashCommit(id: string): boolean {
  if (committingPendingTrashIds.has(id)) {
    return false;
  }

  clearPendingSystemTrashTimer(id);
  committingPendingTrashIds.add(id);
  return true;
}

async function trashStagingPath(item: PendingSystemTrashItem): Promise<void> {
  await moveDesktopItemToTrash(item.stagingPath);
  await deleteStagingContainer(item);
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

async function trashViaOriginalPath(item: PendingSystemTrashItem): Promise<boolean> {
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
        `Failed to move deleted item to system trash and restore pending state: ${
          getErrorMessage(error)
        }; rollback failed: ${getErrorMessage(rollbackError)}`
      );
    }
    throw error;
  }
}

async function commitPendingDeletedItemToSystemTrash(
  item: PendingSystemTrashItem,
  onCommitted?: (item: PendingSystemTrashItem) => void | Promise<void>,
): Promise<void> {
  if (!beginPendingSystemTrashCommit(item.id)) {
    return;
  }

  try {
    if (!await trashViaOriginalPath(item)) {
      await trashStagingPath(item);
    }
    await onCommitted?.(item);
  } finally {
    committingPendingTrashIds.delete(item.id);
  }
}

export async function deleteNoteItemToPendingTrash(
  notesPath: string,
  relativePath: string,
  kind: 'file' | 'folder',
): Promise<PendingSystemTrashItem> {
  const id = createDeleteId();
  const { relativePath: safeRelativePath, fullPath: originalFullPath } =
    await resolveVaultRelativeFullPath(notesPath, relativePath);
  assertNonInternalNotePath(safeRelativePath);

  const stagingDir = await getVaultSystemStorePath(notesPath, PENDING_TRASH_ROOT, id);
  const stagingPath = await joinPath(stagingDir, getBaseName(safeRelativePath));

  await ensureSystemDirectory(stagingDir);
  await moveItemWithCopyFallback(originalFullPath, stagingPath, kind);

  return {
    id,
    kind,
    originalPath: safeRelativePath,
    originalFullPath,
    stagingPath,
    deletedAt: Date.now(),
  };
}

export async function restoreNoteItemFromPendingTrash(
  notesPath: string,
  item: PendingSystemTrashItem,
): Promise<RestorePendingTrashResult> {
  if (committingPendingTrashIds.has(item.id)) {
    throw new Error('Deleted item is already moving to system trash.');
  }

  const storage = getStorageAdapter();
  const safeOriginalPath = normalizeVaultRelativePath(item.originalPath);
  if (!safeOriginalPath) {
    throw new Error('Restore target must stay inside the current vault.');
  }
  assertNonInternalNotePath(safeOriginalPath, 'Restore target must not be inside an internal notes folder.');

  const parentPath = safeOriginalPath.includes('/')
    ? safeOriginalPath.slice(0, safeOriginalPath.lastIndexOf('/'))
    : '';
  const originalName = getBaseName(safeOriginalPath);
  const restoredName = await resolveUniqueName(
    originalName,
    async (candidateName) => {
      const candidateRelativePath = parentPath ? `${parentPath}/${candidateName}` : candidateName;
      const candidateFullPath = await joinPath(notesPath, candidateRelativePath);
      return storage.exists(candidateFullPath);
    },
    { splitExtension: item.kind === 'file' },
  );
  const restoredPath = parentPath ? `${parentPath}/${restoredName}` : restoredName;
  const restoredFullPath = await joinPath(notesPath, restoredPath);

  if (parentPath) {
    await storage.mkdir(await joinPath(notesPath, parentPath), true);
  }

  markExpectedExternalChange(restoredFullPath);
  await moveItemWithCopyFallback(item.stagingPath, restoredFullPath, item.kind);
  await deleteStagingContainer(item);

  return {
    restoredPath,
    restoredFullPath,
  };
}

export async function movePendingDeletedItemToSystemTrash(item: PendingSystemTrashItem): Promise<void> {
  await commitPendingDeletedItemToSystemTrash(item);
}

export async function flushPendingDeletedItemsToSystemTrash(
  items: readonly PendingSystemTrashItem[],
): Promise<void> {
  await Promise.allSettled(items.map((item) => movePendingDeletedItemToSystemTrash(item)));
}

export async function flushStalePendingTrashForVault(notesPath: string): Promise<void> {
  if (!notesPath) {
    return;
  }

  const storage = getStorageAdapter();
  const pendingRoot = await getVaultSystemStorePath(notesPath, PENDING_TRASH_ROOT);
  if (!(await storage.exists(pendingRoot).catch(() => false))) {
    return;
  }

  const entries = await storage.listDir(pendingRoot, { includeHidden: true }).catch(() => []);
  for (const entry of entries) {
    if (!isSafeVaultPathSegment(entry.name)) {
      continue;
    }

    const entryPath = await joinPath(pendingRoot, entry.name);
    if (entry.isFile) {
      await moveDesktopItemToTrash(entryPath).catch(() => undefined);
      continue;
    }
    if (!entry.isDirectory) {
      continue;
    }

    let stagedEntries: Awaited<ReturnType<typeof storage.listDir>>;
    try {
      stagedEntries = await storage.listDir(entryPath, { includeHidden: true });
    } catch {
      continue;
    }
    let allStagedEntriesMoved = true;
    for (const stagedEntry of stagedEntries) {
      if (
        !isSafeVaultPathSegment(stagedEntry.name) ||
        (!stagedEntry.isFile && !stagedEntry.isDirectory)
      ) {
        allStagedEntriesMoved = false;
        continue;
      }
      try {
        await moveDesktopItemToTrash(await joinPath(entryPath, stagedEntry.name));
      } catch {
        allStagedEntriesMoved = false;
      }
    }
    if (allStagedEntriesMoved) {
      await storage.deleteDir(entryPath, true).catch(() => undefined);
    }
  }
}

export function cancelPendingSystemTrash(id: string): boolean {
  if (committingPendingTrashIds.has(id)) {
    return false;
  }

  return clearPendingSystemTrashTimer(id);
}

export function isPendingSystemTrashCommitting(id: string): boolean {
  return committingPendingTrashIds.has(id);
}

export function schedulePendingSystemTrash(
  item: PendingSystemTrashItem,
  onCommitted?: (item: PendingSystemTrashItem) => void | Promise<void>,
  onError?: (item: PendingSystemTrashItem, error: unknown) => void | Promise<void>,
): void {
  if (committingPendingTrashIds.has(item.id)) {
    return;
  }

  cancelPendingSystemTrash(item.id);
  const timer = setTimeout(async () => {
    pendingTrashTimers.delete(item.id);
    try {
      await commitPendingDeletedItemToSystemTrash(item, onCommitted);
    } catch (error) {
      await onError?.(item, error);
    }
  }, NOTES_DELETE_UNDO_GRACE_PERIOD_MS);

  if (typeof timer === 'object' && timer && 'unref' in timer && typeof timer.unref === 'function') {
    timer.unref();
  }
  pendingTrashTimers.set(item.id, timer);
}
