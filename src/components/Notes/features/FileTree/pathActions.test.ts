import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copyTreeItemPath, openTreeItemInNewWindow, openTreeItemLocation } from './pathActions';

const mocks = vi.hoisted(() => ({
  createWindow: vi.fn(),
  openPathInFileManager: vi.fn(),
  revealItemInFolder: vi.fn(),
  writeTextToClipboard: vi.fn(),
}));

vi.mock('@/lib/desktop/window', () => ({
  desktopWindow: {
    create: mocks.createWindow,
  },
}));

vi.mock('@/lib/desktop/shell', () => ({
  openPathInFileManager: mocks.openPathInFileManager,
  revealItemInFolder: mocks.revealItemInFolder,
}));

vi.mock('@/lib/clipboard', () => ({
  writeTextToClipboard: mocks.writeTextToClipboard,
}));

vi.mock('@/lib/storage/adapter', () => ({
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
  joinPath: (...segments: string[]) => Promise.resolve(segments.filter(Boolean).join('/')),
}));

describe('file tree path actions', () => {
  beforeEach(() => {
    mocks.createWindow.mockReset();
    mocks.openPathInFileManager.mockReset();
    mocks.revealItemInFolder.mockReset();
    mocks.writeTextToClipboard.mockReset();
    mocks.createWindow.mockResolvedValue(undefined);
    mocks.openPathInFileManager.mockResolvedValue(undefined);
    mocks.revealItemInFolder.mockResolvedValue(undefined);
    mocks.writeTextToClipboard.mockResolvedValue(true);
  });

  it('resolves vault-relative paths before copying or revealing', async () => {
    await copyTreeItemPath('/vault', 'docs/readme.md');
    await openTreeItemLocation('/vault', 'docs/readme.md');

    expect(mocks.writeTextToClipboard).toHaveBeenCalledWith('/vault/docs/readme.md');
    expect(mocks.revealItemInFolder).toHaveBeenCalledWith('/vault/docs/readme.md');
  });

  it('allows the vault root path through an empty item path', async () => {
    await copyTreeItemPath('/vault', '');
    await openTreeItemLocation('/vault', '', 'folder');

    expect(mocks.writeTextToClipboard).toHaveBeenCalledWith('/vault');
    expect(mocks.openPathInFileManager).toHaveBeenCalledWith('/vault');
    expect(mocks.revealItemInFolder).not.toHaveBeenCalled();
  });

  it('opens folder locations directly instead of revealing them in their parent folder', async () => {
    await openTreeItemLocation('/vault', 'docs', 'folder');

    expect(mocks.openPathInFileManager).toHaveBeenCalledWith('/vault/docs');
    expect(mocks.revealItemInFolder).not.toHaveBeenCalled();
  });

  it('opens files and folders in a new notes window', async () => {
    await openTreeItemInNewWindow('/vault', 'docs/readme.md', 'file');
    await openTreeItemInNewWindow('/vault', 'docs', 'folder');

    expect(mocks.createWindow).toHaveBeenNthCalledWith(1, {
      vaultPath: '/vault',
      notePath: 'docs/readme.md',
      folderPath: null,
      viewMode: 'notes',
    });
    expect(mocks.createWindow).toHaveBeenNthCalledWith(2, {
      vaultPath: '/vault',
      notePath: null,
      folderPath: 'docs',
      viewMode: 'notes',
    });
  });

  it('rejects absolute and traversing item paths', async () => {
    await expect(copyTreeItemPath('/vault', '/etc/passwd')).rejects.toThrow('Path must stay inside the current vault.');
    await expect(openTreeItemLocation('/vault', '../secret.md')).rejects.toThrow('Path must stay inside the current vault.');
    await expect(openTreeItemInNewWindow('/vault', '../secret.md', 'file')).rejects.toThrow('Path must stay inside the current vault.');

    expect(mocks.writeTextToClipboard).not.toHaveBeenCalled();
    expect(mocks.openPathInFileManager).not.toHaveBeenCalled();
    expect(mocks.revealItemInFolder).not.toHaveBeenCalled();
    expect(mocks.createWindow).not.toHaveBeenCalled();
  });
});
