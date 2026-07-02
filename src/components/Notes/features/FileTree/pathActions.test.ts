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

  it('resolves notes-root-relative paths before copying or revealing', async () => {
    await copyTreeItemPath('/notesRoot', 'docs/readme.md');
    await openTreeItemLocation('/notesRoot', 'docs/readme.md');

    expect(mocks.writeTextToClipboard).toHaveBeenCalledWith('/notesRoot/docs/readme.md');
    expect(mocks.revealItemInFolder).toHaveBeenCalledWith('/notesRoot/docs/readme.md');
  });

  it('allows the notesRoot root path through an empty item path', async () => {
    await copyTreeItemPath('/notesRoot', '');
    await openTreeItemLocation('/notesRoot', '', 'folder');

    expect(mocks.writeTextToClipboard).toHaveBeenCalledWith('/notesRoot');
    expect(mocks.openPathInFileManager).toHaveBeenCalledWith('/notesRoot');
    expect(mocks.revealItemInFolder).not.toHaveBeenCalled();
  });

  it('opens folder locations directly instead of revealing them in their parent folder', async () => {
    await openTreeItemLocation('/notesRoot', 'docs', 'folder');

    expect(mocks.openPathInFileManager).toHaveBeenCalledWith('/notesRoot/docs');
    expect(mocks.revealItemInFolder).not.toHaveBeenCalled();
  });

  it('opens files and folders in a new notes window', async () => {
    await openTreeItemInNewWindow('/notesRoot', 'docs/readme.md', 'file');
    await openTreeItemInNewWindow('/notesRoot', 'docs', 'folder');

    expect(mocks.createWindow).toHaveBeenNthCalledWith(1, {
      notesRootPath: '/notesRoot',
      notePath: 'docs/readme.md',
      folderPath: null,
      viewMode: 'notes',
    });
    expect(mocks.createWindow).toHaveBeenNthCalledWith(2, {
      notesRootPath: '/notesRoot',
      notePath: null,
      folderPath: 'docs',
      viewMode: 'notes',
    });
  });

  it('rejects absolute and traversing item paths', async () => {
    await expect(copyTreeItemPath('/notesRoot', '/etc/passwd')).rejects.toThrow('Path must stay inside the opened folder.');
    await expect(openTreeItemLocation('/notesRoot', '../secret.md')).rejects.toThrow('Path must stay inside the opened folder.');
    await expect(openTreeItemInNewWindow('/notesRoot', '../secret.md', 'file')).rejects.toThrow('Path must stay inside the opened folder.');

    expect(mocks.writeTextToClipboard).not.toHaveBeenCalled();
    expect(mocks.openPathInFileManager).not.toHaveBeenCalled();
    expect(mocks.revealItemInFolder).not.toHaveBeenCalled();
    expect(mocks.createWindow).not.toHaveBeenCalled();
  });
});
