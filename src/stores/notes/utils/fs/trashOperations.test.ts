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
});
