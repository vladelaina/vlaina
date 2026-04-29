import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteNoteItemToRecoverableLocation } from './trashOperations';

const hoisted = vi.hoisted(() => ({
  isElectron: vi.fn(),
  moveDesktopItemToTrash: vi.fn(),
  deleteFile: vi.fn(),
  deleteDir: vi.fn(),
}));

vi.mock('@/lib/desktop/trash', () => ({
  moveDesktopItemToTrash: hoisted.moveDesktopItemToTrash,
}));

vi.mock('@/lib/storage/adapter', () => ({
  isElectron: hoisted.isElectron,
  getStorageAdapter: () => ({
    deleteFile: hoisted.deleteFile,
    deleteDir: hoisted.deleteDir,
  }),
}));

describe('deleteNoteItemToRecoverableLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.isElectron.mockReturnValue(false);
    hoisted.moveDesktopItemToTrash.mockResolvedValue(undefined);
    hoisted.deleteFile.mockResolvedValue(undefined);
    hoisted.deleteDir.mockResolvedValue(undefined);
  });

  it('moves desktop note files to the system trash', async () => {
    hoisted.isElectron.mockReturnValue(true);

    await deleteNoteItemToRecoverableLocation('/vault/note.md', 'file');

    expect(hoisted.moveDesktopItemToTrash).toHaveBeenCalledWith('/vault/note.md');
    expect(hoisted.deleteFile).not.toHaveBeenCalled();
    expect(hoisted.deleteDir).not.toHaveBeenCalled();
  });

  it('moves desktop note folders to the system trash', async () => {
    hoisted.isElectron.mockReturnValue(true);

    await deleteNoteItemToRecoverableLocation('/vault/folder', 'folder');

    expect(hoisted.moveDesktopItemToTrash).toHaveBeenCalledWith('/vault/folder');
    expect(hoisted.deleteFile).not.toHaveBeenCalled();
    expect(hoisted.deleteDir).not.toHaveBeenCalled();
  });

  it('falls back to adapter deletion outside desktop', async () => {
    await deleteNoteItemToRecoverableLocation('/vault/note.md', 'file');
    await deleteNoteItemToRecoverableLocation('/vault/folder', 'folder');

    expect(hoisted.deleteFile).toHaveBeenCalledWith('/vault/note.md');
    expect(hoisted.deleteDir).toHaveBeenCalledWith('/vault/folder', true);
    expect(hoisted.moveDesktopItemToTrash).not.toHaveBeenCalled();
  });
});
