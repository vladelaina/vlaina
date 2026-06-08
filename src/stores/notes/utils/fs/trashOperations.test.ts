import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteNoteItemToRecoverableLocation,
  restoreNoteItemFromRecoverableLocation,
} from './trashOperations';

const hoisted = vi.hoisted(() => ({
  mkdir: vi.fn(),
  rename: vi.fn(),
  exists: vi.fn(),
  copyFile: vi.fn(),
  deleteFile: vi.fn(),
  deleteDir: vi.fn(),
  listDir: vi.fn(),
  markExpectedExternalChange: vi.fn(),
}));

vi.mock('@/lib/storage/adapter', () => ({
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/').replace(/\/+/g, '/')),
  getStorageAdapter: () => ({
    mkdir: hoisted.mkdir,
    rename: hoisted.rename,
    exists: hoisted.exists,
    copyFile: hoisted.copyFile,
    deleteFile: hoisted.deleteFile,
    deleteDir: hoisted.deleteDir,
    listDir: hoisted.listDir,
    getBasePath: vi.fn(async () => '/app'),
  }),
}));

vi.mock('../../document/externalChangeRegistry', () => ({
  markExpectedExternalChange: hoisted.markExpectedExternalChange,
}));

describe('deleteNoteItemToRecoverableLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    hoisted.mkdir.mockResolvedValue(undefined);
    hoisted.rename.mockResolvedValue(undefined);
    hoisted.exists.mockResolvedValue(false);
    hoisted.copyFile.mockResolvedValue(undefined);
    hoisted.deleteFile.mockResolvedValue(undefined);
    hoisted.deleteDir.mockResolvedValue(undefined);
    hoisted.listDir.mockResolvedValue([]);
    hoisted.markExpectedExternalChange.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('moves note files into the system recoverable trash area', async () => {
    const result = await deleteNoteItemToRecoverableLocation('/vault', 'docs/note.md', 'file');

    expect(result).toEqual({
      id: '1000-i',
      kind: 'file',
      originalPath: 'docs/note.md',
      originalFullPath: '/vault/docs/note.md',
      trashPath: '/app/.vlaina/store/notes/vaults/vault-1y3s8he/trash/1000-i/note.md',
      deletedAt: 1000,
    });
    expect(hoisted.mkdir).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-1y3s8he/trash/1000-i',
      true
    );
    expect(hoisted.rename).toHaveBeenCalledWith(
      '/vault/docs/note.md',
      '/app/.vlaina/store/notes/vaults/vault-1y3s8he/trash/1000-i/note.md',
    );
  });

  it('rejects recoverable deletes inside internal folders', async () => {
    await expect(deleteNoteItemToRecoverableLocation('/vault', '.vlaina/workspace.md', 'file'))
      .rejects.toThrow('Path must not be inside an internal notes folder.');
    await expect(deleteNoteItemToRecoverableLocation('/vault', 'docs/.GIT/config.md', 'file'))
      .rejects.toThrow('Path must not be inside an internal notes folder.');

    expect(hoisted.mkdir).not.toHaveBeenCalled();
    expect(hoisted.rename).not.toHaveBeenCalled();
  });

  it('restores deleted files to a non-conflicting path', async () => {
    hoisted.exists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const result = await restoreNoteItemFromRecoverableLocation('/vault', {
      id: 'delete-1',
      kind: 'file',
      originalPath: 'docs/note.md',
      originalFullPath: '/vault/docs/note.md',
      trashPath: '/app/.vlaina/store/notes/vaults/vault-1y3s8he/trash/delete-1/note.md',
      deletedAt: 1000,
    });

    expect(result).toEqual({
      restoredPath: 'docs/note 1.md',
      restoredFullPath: '/vault/docs/note 1.md',
    });
    expect(hoisted.mkdir).toHaveBeenCalledWith('/vault/docs', true);
    expect(hoisted.rename).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-1y3s8he/trash/delete-1/note.md',
      '/vault/docs/note 1.md',
    );
    expect(hoisted.markExpectedExternalChange).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-1y3s8he/trash/delete-1/note.md'
    );
    expect(hoisted.markExpectedExternalChange).toHaveBeenCalledWith('/vault/docs/note 1.md');
  });

  it('restores deleted folders to a non-conflicting path', async () => {
    hoisted.exists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const result = await restoreNoteItemFromRecoverableLocation('/vault', {
      id: 'delete-1',
      kind: 'folder',
      originalPath: 'docs',
      originalFullPath: '/vault/docs',
      trashPath: '/app/.vlaina/store/notes/vaults/vault-1y3s8he/trash/delete-1/docs',
      deletedAt: 1000,
    });

    expect(result).toEqual({
      restoredPath: 'docs 1',
      restoredFullPath: '/vault/docs 1',
    });
    expect(hoisted.rename).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-1y3s8he/trash/delete-1/docs',
      '/vault/docs 1',
    );
  });

  it('rejects restores into internal folders', async () => {
    await expect(restoreNoteItemFromRecoverableLocation('/vault', {
      id: 'delete-1',
      kind: 'file',
      originalPath: 'docs/.git/config.md',
      originalFullPath: '/vault/docs/.git/config.md',
      trashPath: '/app/.vlaina/store/notes/vaults/vault-1y3s8he/trash/delete-1/config.md',
      deletedAt: 1000,
    })).rejects.toThrow('Restore target must not be inside an internal notes folder.');
    await expect(restoreNoteItemFromRecoverableLocation('/vault', {
      id: 'delete-2',
      kind: 'file',
      originalPath: '.VLAINA/workspace.md',
      originalFullPath: '/vault/.VLAINA/workspace.md',
      trashPath: '/app/.vlaina/store/notes/vaults/vault-1y3s8he/trash/delete-2/workspace.md',
      deletedAt: 1000,
    })).rejects.toThrow('Restore target must not be inside an internal notes folder.');

    expect(hoisted.rename).not.toHaveBeenCalled();
  });

  it('skips unsafe entry names when copying folders to recoverable trash', async () => {
    hoisted.rename.mockRejectedValue(new Error('cross-device rename failed'));
    hoisted.listDir.mockImplementation(async (path: string) => {
      if (path === '/vault/docs') {
        return [
          { name: 'safe.md', isDirectory: false, isFile: true },
          { name: '.git', isDirectory: true, isFile: false },
          { name: '.vlaina', isDirectory: true, isFile: false },
          { name: '.GIT', isDirectory: true, isFile: false },
          { name: '.VLAINA', isDirectory: true, isFile: false },
          { name: '../secret.md', isDirectory: false, isFile: true },
          { name: 'nested/evil.md', isDirectory: false, isFile: true },
          { name: 'bad\\evil.md', isDirectory: false, isFile: true },
          { name: '..', isDirectory: true, isFile: false },
        ];
      }

      return [];
    });

    await deleteNoteItemToRecoverableLocation('/vault', 'docs', 'folder');

    expect(hoisted.copyFile).toHaveBeenCalledWith(
      '/vault/docs/safe.md',
      '/app/.vlaina/store/notes/vaults/vault-1y3s8he/trash/1000-i/docs/safe.md',
    );
    expect(hoisted.listDir).toHaveBeenCalledWith('/vault/docs', { includeHidden: true });
    expect(hoisted.copyFile).not.toHaveBeenCalledWith('/vault/docs/../secret.md', expect.any(String));
    expect(hoisted.copyFile).not.toHaveBeenCalledWith('/vault/docs/nested/evil.md', expect.any(String));
    expect(hoisted.listDir).not.toHaveBeenCalledWith('/vault/docs/.git');
    expect(hoisted.listDir).not.toHaveBeenCalledWith('/vault/docs/.vlaina');
    expect(hoisted.listDir).not.toHaveBeenCalledWith('/vault/docs/.GIT');
    expect(hoisted.listDir).not.toHaveBeenCalledWith('/vault/docs/.VLAINA');
    expect(hoisted.listDir).not.toHaveBeenCalledWith('/vault/docs/..');
    expect(hoisted.deleteDir).toHaveBeenCalledWith('/vault/docs', true);
  });

  it('cleans partial trash file copies when a file copy fallback fails', async () => {
    hoisted.rename.mockRejectedValue(new Error('cross-device rename failed'));
    hoisted.copyFile.mockRejectedValue(new Error('Copy failed'));

    await expect(deleteNoteItemToRecoverableLocation('/vault', 'docs/note.md', 'file')).rejects.toThrow(
      'Copy failed'
    );

    expect(hoisted.deleteFile).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-1y3s8he/trash/1000-i/note.md'
    );
    expect(hoisted.deleteFile).not.toHaveBeenCalledWith('/vault/docs/note.md');
  });

  it('cleans partial trash folder copies when a folder copy fallback fails', async () => {
    hoisted.rename.mockRejectedValue(new Error('cross-device rename failed'));
    hoisted.listDir.mockImplementation(async (path: string) => {
      if (path === '/vault/docs') {
        return [
          { name: 'first.md', isDirectory: false, isFile: true },
          { name: 'second.md', isDirectory: false, isFile: true },
        ];
      }

      return [];
    });
    hoisted.copyFile.mockImplementation(async (sourcePath: string) => {
      if (sourcePath.endsWith('/second.md')) {
        throw new Error('Copy failed');
      }
    });

    await expect(deleteNoteItemToRecoverableLocation('/vault', 'docs', 'folder')).rejects.toThrow(
      'Copy failed'
    );

    expect(hoisted.deleteDir).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-1y3s8he/trash/1000-i/docs',
      true
    );
    expect(hoisted.deleteDir).not.toHaveBeenCalledWith('/vault/docs', true);
  });
});
