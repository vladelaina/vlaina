import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetService } from './AssetService';

const mocks = vi.hoisted(() => ({
  storage: {
    exists: vi.fn(),
    mkdir: vi.fn(),
    listDir: vi.fn(),
  },
  computeFileHash: vi.fn(),
  writeAssetAtomic: vi.fn(),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => mocks.storage,
  getParentPath: (path: string) => {
    const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
    const index = normalized.lastIndexOf('/');
    return index <= 0 ? '/vault' : normalized.slice(0, index);
  },
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/').replace(/\/+/g, '/')),
}));

vi.mock('./core/hashing', () => ({
  computeFileHash: mocks.computeFileHash,
}));

vi.mock('./io/writer', () => ({
  writeAssetAtomic: mocks.writeAssetAtomic,
}));

describe('AssetService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storage.exists.mockResolvedValue(false);
    mocks.storage.mkdir.mockResolvedValue(undefined);
    mocks.storage.listDir.mockResolvedValue([]);
    mocks.computeFileHash.mockResolvedValue('hash-1');
    mocks.writeAssetAtomic.mockResolvedValue(undefined);
  });

  function createImageFile(name: string): File {
    return {
      name,
      type: 'image/png',
      size: 5,
      lastModified: 1,
      arrayBuffer: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
    } as unknown as File;
  }

  it('keeps vault subfolder uploads inside the vault when the configured folder traverses upward', async () => {
    const file = createImageFile('alpha.png');

    const result = await AssetService.upload(
      file,
      { vaultPath: '/vault', currentNotePath: 'docs/current.md' },
      {
        storageMode: 'vaultSubfolder',
        imageVaultSubfolderName: '../outside',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(true);
    expect(mocks.storage.mkdir).toHaveBeenCalledWith('/vault/assets', true);
    expect(mocks.writeAssetAtomic).toHaveBeenCalledWith('/vault/assets/alpha.png', expect.any(Uint8Array));
    expect(result.path).toBe('assets/alpha.png');
  });

  it('keeps note subfolder uploads below the current note directory', async () => {
    const file = createImageFile('alpha.png');

    const result = await AssetService.upload(
      file,
      { vaultPath: '/vault', currentNotePath: 'docs/current.md' },
      {
        storageMode: 'subfolder',
        subfolderName: '../outside',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(true);
    expect(mocks.storage.mkdir).toHaveBeenCalledWith('/vault/docs/assets', true);
    expect(mocks.writeAssetAtomic).toHaveBeenCalledWith('/vault/docs/assets/alpha.png', expect.any(Uint8Array));
    expect(result.path).toBe('./assets/alpha.png');
  });
});
