import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveGlobalAsset, scanGlobalIcons } from './assetStorage';

const adapter = {
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  mkdir: vi.fn<(path: string, recursive?: boolean) => Promise<void>>(),
  writeBinaryFile: vi.fn<(path: string, content: Uint8Array) => Promise<void>>(),
  listDir: vi.fn<() => Promise<Array<{
    name: string;
    path: string;
    isDirectory: boolean;
    isFile: boolean;
    size?: number;
    modifiedAt?: number;
  }>>>(),
};

vi.mock('./paths', () => ({
  getPaths: () => Promise.resolve({ metadata: '/app/.vlaina' }),
}));

vi.mock('./adapter', () => ({
  getStorageAdapter: () => adapter,
  joinPath: (...segments: string[]) => Promise.resolve(segments.filter(Boolean).join('/')),
}));

describe('assetStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapter.exists.mockResolvedValue(true);
    adapter.mkdir.mockResolvedValue();
    adapter.writeBinaryFile.mockResolvedValue();
  });

  it('rejects non-image custom icon uploads before writing bytes', async () => {
    const file = new File(['hello'], 'secret.md', { type: 'text/markdown' });

    await expect(saveGlobalAsset(file, 'icons')).rejects.toThrow(
      'Only image files can be saved as custom icons.'
    );

    expect(adapter.writeBinaryFile).not.toHaveBeenCalled();
  });

  it('rejects oversized custom icon uploads before writing bytes', async () => {
    const file = new File(['x'], 'huge.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024 });

    await expect(saveGlobalAsset(file, 'icons')).rejects.toThrow(
      'Custom icon image is too large.'
    );

    expect(adapter.writeBinaryFile).not.toHaveBeenCalled();
  });

  it('filters unsupported and oversized icon files while scanning', async () => {
    adapter.listDir.mockResolvedValue([
      { name: 'ok.png', path: '/app/.vlaina/assets/icons/ok.png', isDirectory: false, isFile: true, size: 100, modifiedAt: 1 },
      { name: 'huge.svg', path: '/app/.vlaina/assets/icons/huge.svg', isDirectory: false, isFile: true, size: 11 * 1024 * 1024, modifiedAt: 2 },
      { name: 'secret.md', path: '/app/.vlaina/assets/icons/secret.md', isDirectory: false, isFile: true, size: 100, modifiedAt: 3 },
    ]);

    await expect(scanGlobalIcons()).resolves.toEqual([
      {
        id: '/app/.vlaina/assets/icons/ok.png',
        url: 'img:/app/.vlaina/assets/icons/ok.png',
        name: 'ok.png',
        createdAt: 1,
      },
    ]);
  });
});
