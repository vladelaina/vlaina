import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copyTreeItemPath, openTreeItemLocation } from './pathActions';

const mocks = vi.hoisted(() => ({
  revealItemInFolder: vi.fn(),
  writeTextToClipboard: vi.fn(),
}));

vi.mock('@/lib/desktop/shell', () => ({
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
    mocks.revealItemInFolder.mockReset();
    mocks.writeTextToClipboard.mockReset();
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
    await openTreeItemLocation('/vault', '');

    expect(mocks.writeTextToClipboard).toHaveBeenCalledWith('/vault');
    expect(mocks.revealItemInFolder).toHaveBeenCalledWith('/vault');
  });

  it('rejects absolute and traversing item paths', async () => {
    await expect(copyTreeItemPath('/vault', '/etc/passwd')).rejects.toThrow('Path must stay inside the current vault.');
    await expect(openTreeItemLocation('/vault', '../secret.md')).rejects.toThrow('Path must stay inside the current vault.');

    expect(mocks.writeTextToClipboard).not.toHaveBeenCalled();
    expect(mocks.revealItemInFolder).not.toHaveBeenCalled();
  });
});
