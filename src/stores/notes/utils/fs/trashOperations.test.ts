import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moveDesktopItemToTrash } from '@/lib/desktop/trash';
import {
  cancelPendingSystemTrash,
  deleteNoteItemToPendingTrash,
  flushStalePendingTrashForVault,
  isPendingSystemTrashCommitting,
  MAX_STALE_PENDING_TRASH_ROOT_ENTRIES,
  MAX_STALE_PENDING_TRASH_STAGED_ENTRIES,
  movePendingDeletedItemToSystemTrash,
  restoreNoteItemFromPendingTrash,
  schedulePendingSystemTrash,
} from './trashOperations';

const hoisted = vi.hoisted(() => ({
  ensureSystemDirectory: vi.fn(),
  mkdir: vi.fn(),
  rename: vi.fn(),
  exists: vi.fn(),
  copyFile: vi.fn(),
  deleteFile: vi.fn(),
  deleteDir: vi.fn(),
  listDir: vi.fn(),
  moveDesktopItemToTrash: vi.fn(),
  markExpectedExternalChange: vi.fn(),
}));

vi.mock('@/lib/desktop/trash', () => ({
  moveDesktopItemToTrash: hoisted.moveDesktopItemToTrash,
}));

vi.mock('../../systemStoragePaths', () => ({
  ensureSystemDirectory: hoisted.ensureSystemDirectory,
  getVaultSystemStorePath: async (_vaultPath: string, ...segments: string[]) =>
    ['/app/.vlaina/store/notes/vaults/vault-test', ...segments].join('/'),
}));

vi.mock('../../document/externalChangeRegistry', () => ({
  markExpectedExternalChange: hoisted.markExpectedExternalChange,
}));

vi.mock('@/lib/storage/adapter', () => ({
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/').replace(/\/+/g, '/')),
  normalizeAbsolutePath: (path: string) => path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/+$/, ''),
  getStorageAdapter: () => ({
    mkdir: hoisted.mkdir,
    rename: hoisted.rename,
    exists: hoisted.exists,
    copyFile: hoisted.copyFile,
    deleteFile: hoisted.deleteFile,
    deleteDir: hoisted.deleteDir,
    listDir: hoisted.listDir,
  }),
}));

const mockedMoveDesktopItemToTrash = vi.mocked(moveDesktopItemToTrash);

describe('pending note trash operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    hoisted.ensureSystemDirectory.mockResolvedValue(undefined);
    hoisted.mkdir.mockResolvedValue(undefined);
    hoisted.rename.mockResolvedValue(undefined);
    hoisted.exists.mockResolvedValue(false);
    hoisted.copyFile.mockResolvedValue(undefined);
    hoisted.deleteFile.mockResolvedValue(undefined);
    hoisted.deleteDir.mockResolvedValue(undefined);
    hoisted.listDir.mockResolvedValue([]);
    hoisted.moveDesktopItemToTrash.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('moves note files to a pending trash location first', async () => {
    const result = await deleteNoteItemToPendingTrash('/vault', 'docs/note.md', 'file');

    expect(result).toEqual({
      id: '1000-i',
      kind: 'file',
      originalPath: 'docs/note.md',
      originalFullPath: '/vault/docs/note.md',
      stagingPath: '/app/.vlaina/store/notes/vaults/vault-test/pending-trash/1000-i/note.md',
      deletedAt: 1000,
    });
    expect(hoisted.ensureSystemDirectory).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-test/pending-trash/1000-i',
    );
    expect(hoisted.rename).toHaveBeenCalledWith(
      '/vault/docs/note.md',
      '/app/.vlaina/store/notes/vaults/vault-test/pending-trash/1000-i/note.md',
    );
    expect(mockedMoveDesktopItemToTrash).not.toHaveBeenCalled();
  });

  it('restores pending files to a non-conflicting path', async () => {
    hoisted.exists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const result = await restoreNoteItemFromPendingTrash('/vault', {
      id: 'delete-1',
      kind: 'file',
      originalPath: 'docs/note.md',
      originalFullPath: '/vault/docs/note.md',
      stagingPath: '/app/.vlaina/store/notes/vaults/vault-test/pending-trash/delete-1/note.md',
      deletedAt: 1000,
    });

    expect(result).toEqual({
      restoredPath: 'docs/note 1.md',
      restoredFullPath: '/vault/docs/note 1.md',
    });
    expect(hoisted.mkdir).toHaveBeenCalledWith('/vault/docs', true);
    expect(hoisted.rename).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-test/pending-trash/delete-1/note.md',
      '/vault/docs/note 1.md',
    );
    expect(hoisted.markExpectedExternalChange).toHaveBeenCalledWith('/vault/docs/note 1.md');
    expect(hoisted.deleteDir).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-test/pending-trash/delete-1',
      true,
    );
  });

  it('rejects restores from staging paths outside the current vault pending trash', async () => {
    await expect(restoreNoteItemFromPendingTrash('/vault', {
      id: 'delete-1',
      kind: 'file',
      originalPath: 'docs/note.md',
      originalFullPath: '/vault/docs/note.md',
      stagingPath: '/tmp/note.md',
      deletedAt: 1000,
    })).rejects.toThrow('Pending trash staging path must stay inside the current vault pending trash.');

    await expect(restoreNoteItemFromPendingTrash('/vault', {
      id: '../delete-1',
      kind: 'file',
      originalPath: 'docs/note.md',
      originalFullPath: '/vault/docs/note.md',
      stagingPath: '/app/.vlaina/store/notes/vaults/vault-test/pending-trash/delete-1/note.md',
      deletedAt: 1000,
    })).rejects.toThrow('Pending trash staging path must stay inside the current vault pending trash.');

    expect(hoisted.rename).not.toHaveBeenCalled();
  });

  it('commits pending items to the system trash', async () => {
    const stagingPath = '/app/.vlaina/store/notes/vaults/vault-test/pending-trash/delete-1/docs';

    await movePendingDeletedItemToSystemTrash({
      id: 'delete-1',
      kind: 'folder',
      originalPath: 'docs',
      originalFullPath: '/vault/docs',
      stagingPath,
      deletedAt: 1000,
    });

    expect(hoisted.exists).toHaveBeenCalledWith('/vault/docs');
    expect(hoisted.rename).toHaveBeenCalledWith(stagingPath, '/vault/docs');
    expect(hoisted.markExpectedExternalChange).toHaveBeenCalledWith('/vault/docs', true);
    expect(mockedMoveDesktopItemToTrash).toHaveBeenCalledWith('/vault/docs');
    expect(mockedMoveDesktopItemToTrash).not.toHaveBeenCalledWith(stagingPath);
    expect(hoisted.deleteDir).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-test/pending-trash/delete-1',
      true,
    );
  });

  it('commits staged items directly when the original path has been reused', async () => {
    hoisted.exists.mockResolvedValueOnce(true);
    const stagingPath = '/app/.vlaina/store/notes/vaults/vault-test/pending-trash/delete-1/note.md';

    await movePendingDeletedItemToSystemTrash({
      id: 'delete-1',
      kind: 'file',
      originalPath: 'docs/note.md',
      originalFullPath: '/vault/docs/note.md',
      stagingPath,
      deletedAt: 1000,
    });

    expect(hoisted.rename).not.toHaveBeenCalled();
    expect(mockedMoveDesktopItemToTrash).toHaveBeenCalledWith(stagingPath);
    expect(hoisted.deleteDir).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-test/pending-trash/delete-1',
      true,
    );
  });

  it('rolls moved items back to pending trash if system trash fails at the original path', async () => {
    const stagingPath = '/app/.vlaina/store/notes/vaults/vault-test/pending-trash/delete-1/docs';
    mockedMoveDesktopItemToTrash.mockRejectedValue(new Error('trash failed'));

    await expect(movePendingDeletedItemToSystemTrash({
      id: 'delete-1',
      kind: 'folder',
      originalPath: 'docs',
      originalFullPath: '/vault/docs',
      stagingPath,
      deletedAt: 1000,
    })).rejects.toThrow('trash failed');

    expect(hoisted.rename).toHaveBeenNthCalledWith(1, stagingPath, '/vault/docs');
    expect(hoisted.rename).toHaveBeenNthCalledWith(2, '/vault/docs', stagingPath);
    expect(hoisted.deleteDir).not.toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-test/pending-trash/delete-1',
      true,
    );
  });

  it('keeps stale pending trash when moving it to system trash fails', async () => {
    const pendingRoot = '/app/.vlaina/store/notes/vaults/vault-test/pending-trash';
    const stagingDir = `${pendingRoot}/delete-1`;
    hoisted.exists.mockImplementation(async (path: string) => path === pendingRoot);
    hoisted.listDir.mockImplementation(async (path: string) => {
      if (path === pendingRoot) {
        return [{ name: 'delete-1', isDirectory: true, isFile: false }];
      }
      if (path === stagingDir) {
        return [{ name: 'docs', isDirectory: true, isFile: false }];
      }
      return [];
    });
    mockedMoveDesktopItemToTrash.mockRejectedValue(new Error('trash failed'));

    await flushStalePendingTrashForVault('/vault');

    expect(mockedMoveDesktopItemToTrash).toHaveBeenCalledWith(`${stagingDir}/docs`);
    expect(hoisted.deleteDir).not.toHaveBeenCalledWith(stagingDir, true);
  });

  it('deletes stale pending trash containers only after all staged entries move', async () => {
    const pendingRoot = '/app/.vlaina/store/notes/vaults/vault-test/pending-trash';
    const stagingDir = `${pendingRoot}/delete-1`;
    hoisted.exists.mockImplementation(async (path: string) => path === pendingRoot);
    hoisted.listDir.mockImplementation(async (path: string) => {
      if (path === pendingRoot) {
        return [{ name: 'delete-1', isDirectory: true, isFile: false }];
      }
      if (path === stagingDir) {
        return [{ name: 'docs', isDirectory: true, isFile: false }];
      }
      return [];
    });

    await flushStalePendingTrashForVault('/vault');

    expect(mockedMoveDesktopItemToTrash).toHaveBeenCalledWith(`${stagingDir}/docs`);
    expect(hoisted.deleteDir).toHaveBeenCalledWith(stagingDir, true);
  });

  it('bounds stale pending trash root cleanup work', async () => {
    const pendingRoot = '/app/.vlaina/store/notes/vaults/vault-test/pending-trash';
    hoisted.exists.mockImplementation(async (path: string) => path === pendingRoot);
    hoisted.listDir.mockImplementation(async (path: string) => {
      if (path === pendingRoot) {
        return Array.from(
          { length: MAX_STALE_PENDING_TRASH_ROOT_ENTRIES + 1 },
          (_, index) => ({ name: `delete-${index}`, isDirectory: false, isFile: true }),
        );
      }
      return [];
    });

    await flushStalePendingTrashForVault('/vault');

    expect(mockedMoveDesktopItemToTrash).toHaveBeenCalledTimes(MAX_STALE_PENDING_TRASH_ROOT_ENTRIES);
    expect(mockedMoveDesktopItemToTrash).not.toHaveBeenCalledWith(
      `${pendingRoot}/delete-${MAX_STALE_PENDING_TRASH_ROOT_ENTRIES}`,
    );
  });

  it('keeps oversized stale pending trash containers for later cleanup', async () => {
    const pendingRoot = '/app/.vlaina/store/notes/vaults/vault-test/pending-trash';
    const stagingDir = `${pendingRoot}/delete-1`;
    hoisted.exists.mockImplementation(async (path: string) => path === pendingRoot);
    hoisted.listDir.mockImplementation(async (path: string) => {
      if (path === pendingRoot) {
        return [{ name: 'delete-1', isDirectory: true, isFile: false }];
      }
      if (path === stagingDir) {
        return Array.from(
          { length: MAX_STALE_PENDING_TRASH_STAGED_ENTRIES + 1 },
          (_, index) => ({ name: `item-${index}.md`, isDirectory: false, isFile: true }),
        );
      }
      return [];
    });

    await flushStalePendingTrashForVault('/vault');

    expect(mockedMoveDesktopItemToTrash).toHaveBeenCalledTimes(MAX_STALE_PENDING_TRASH_STAGED_ENTRIES);
    expect(mockedMoveDesktopItemToTrash).not.toHaveBeenCalledWith(
      `${stagingDir}/item-${MAX_STALE_PENDING_TRASH_STAGED_ENTRIES}.md`,
    );
    expect(hoisted.deleteDir).not.toHaveBeenCalledWith(stagingDir, true);
  });

  it('rejects unsafe folder copy fallback entries without deleting the original folder', async () => {
    hoisted.rename.mockRejectedValue(new Error('cross-device rename failed'));
    hoisted.listDir.mockImplementation(async (path: string) => {
      if (path === '/vault/docs') {
        return [
          { name: 'bad/evil.md', isDirectory: false, isFile: true },
          { name: 'safe.md', isDirectory: false, isFile: true },
        ];
      }
      return [];
    });

    await expect(deleteNoteItemToPendingTrash('/vault', 'docs', 'folder'))
      .rejects.toThrow('Pending trash folder copy encountered an unsafe directory entry.');

    expect(hoisted.copyFile).toHaveBeenCalledWith(
      '/vault/docs/safe.md',
      '/app/.vlaina/store/notes/vaults/vault-test/pending-trash/1000-i/docs/safe.md',
    );
    expect(hoisted.deleteDir).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-test/pending-trash/1000-i/docs',
      true,
    );
    expect(hoisted.deleteDir).not.toHaveBeenCalledWith('/vault/docs', true);
  });

  it('exposes pending items as committing while system trash is in flight', async () => {
    let resolveExists: ((value: boolean) => void) | null = null;
    hoisted.exists.mockImplementation(() => new Promise<boolean>((resolve) => {
      resolveExists = resolve;
    }));

    const commit = movePendingDeletedItemToSystemTrash({
      id: 'delete-1',
      kind: 'file',
      originalPath: 'docs/note.md',
      originalFullPath: '/vault/docs/note.md',
      stagingPath: '/app/.vlaina/store/notes/vaults/vault-test/pending-trash/delete-1/note.md',
      deletedAt: 1000,
    });

    const completeExists = resolveExists as ((value: boolean) => void) | null;
    expect(completeExists).toBeTypeOf('function');
    expect(isPendingSystemTrashCommitting('delete-1')).toBe(true);
    expect(cancelPendingSystemTrash('delete-1')).toBe(false);

    if (!completeExists) {
      throw new Error('exists mock was not called');
    }
    completeExists(true);
    await commit;

    expect(isPendingSystemTrashCommitting('delete-1')).toBe(false);
  });

  it('does not leak rejected pending trash error callbacks from the timer', async () => {
    vi.useFakeTimers();
    mockedMoveDesktopItemToTrash.mockRejectedValue(new Error('trash failed'));
    const onError = vi.fn(async () => {
      throw new Error('state update failed');
    });

    schedulePendingSystemTrash({
      id: 'delete-1',
      kind: 'file',
      originalPath: 'docs/note.md',
      originalFullPath: '/vault/docs/note.md',
      stagingPath: '/app/.vlaina/store/notes/vaults/vault-test/pending-trash/delete-1/note.md',
      deletedAt: 1000,
    }, undefined, onError);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'delete-1' }),
      expect.any(Error),
    );
    expect(isPendingSystemTrashCommitting('delete-1')).toBe(false);
  });

  it('rejects deletes inside internal folders before staging', async () => {
    await expect(deleteNoteItemToPendingTrash('/vault', '.vlaina/workspace.md', 'file'))
      .rejects.toThrow('Path must not be inside an internal notes folder.');
    await expect(deleteNoteItemToPendingTrash('/vault', 'docs/.GIT/config.md', 'file'))
      .rejects.toThrow('Path must not be inside an internal notes folder.');

    expect(hoisted.ensureSystemDirectory).not.toHaveBeenCalled();
    expect(hoisted.rename).not.toHaveBeenCalled();
  });
});
