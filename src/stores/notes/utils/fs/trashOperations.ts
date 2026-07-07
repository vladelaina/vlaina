import { moveDesktopItemToTrash } from '@/lib/desktop/trash';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { resolveUniqueName } from '@/lib/naming/uniqueName';
import { ensureSystemDirectory, getNotesRootSystemStorePath } from '../../systemStoragePaths';
import { markExpectedExternalChange } from '../../document/externalChangeRegistry';
import { assertNonInternalNotePath } from './internalNotePaths';
import {
  isSafeNotesRootPathSegment,
  normalizeNotesRootRelativePath,
  resolveNotesRootRelativeFullPath,
} from './notesRootPathContainment';
import {
  PENDING_TRASH_ROOT,
  assertCurrentNotesRootPendingTrashStagingPath,
  deleteStagingContainer,
  getBaseName,
  moveItemWithCopyFallback,
  trashViaOriginalPath,
} from './trashStagingOperations';

export const NOTES_DELETE_UNDO_GRACE_PERIOD_MS = 30_000;
export const MAX_STALE_PENDING_TRASH_ROOT_ENTRIES = 1000;
export const MAX_STALE_PENDING_TRASH_STAGED_ENTRIES = 1000;

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

async function commitPendingDeletedItemToSystemTrash(
  item: PendingSystemTrashItem,
  onCommitted?: (item: PendingSystemTrashItem) => void | Promise<void>,
): Promise<void> {
  if (!beginPendingSystemTrashCommit(item.id)) {
    return;
  }

  try {
    if (!await trashViaOriginalPath(item)) {
      await moveDesktopItemToTrash(item.stagingPath);
      await deleteStagingContainer(item);
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
    await resolveNotesRootRelativeFullPath(notesPath, relativePath);
  assertNonInternalNotePath(safeRelativePath);

  const stagingDir = await getNotesRootSystemStorePath(notesPath, PENDING_TRASH_ROOT, id);
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
  const safeOriginalPath = normalizeNotesRootRelativePath(item.originalPath);
  if (!safeOriginalPath) {
    throw new Error('Restore target must stay inside the opened folder.');
  }
  assertNonInternalNotePath(safeOriginalPath, 'Restore target must not be inside an internal notes folder.');
  await assertCurrentNotesRootPendingTrashStagingPath(notesPath, item);

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

export async function flushStalePendingTrashForNotesRoot(notesPath: string): Promise<void> {
  if (!notesPath) {
    return;
  }

  const storage = getStorageAdapter();
  const pendingRoot = await getNotesRootSystemStorePath(notesPath, PENDING_TRASH_ROOT);
  if (!(await storage.exists(pendingRoot).catch(() => false))) {
    return;
  }

  const entries = await storage.listDir(pendingRoot, { includeHidden: true }).catch(() => []);
  for (const entry of entries.slice(0, MAX_STALE_PENDING_TRASH_ROOT_ENTRIES)) {
    if (!isSafeNotesRootPathSegment(entry.name)) {
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
    let allStagedEntriesMoved = stagedEntries.length <= MAX_STALE_PENDING_TRASH_STAGED_ENTRIES;
    for (const stagedEntry of stagedEntries.slice(0, MAX_STALE_PENDING_TRASH_STAGED_ENTRIES)) {
      if (
        !isSafeNotesRootPathSegment(stagedEntry.name) ||
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
      try {
        await onError?.(item, error);
      } catch {
      }
    }
  }, NOTES_DELETE_UNDO_GRACE_PERIOD_MS);

  if (typeof timer === 'object' && timer && 'unref' in timer && typeof timer.unref === 'function') {
    timer.unref();
  }
  pendingTrashTimers.set(item.id, timer);
}
