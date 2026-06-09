import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAssetHashIndex, saveAssetHashIndex } from './AssetHashIndex';

const mocks = vi.hoisted(() => ({
  storage: {
    exists: vi.fn<(path: string) => Promise<boolean>>(),
    mkdir: vi.fn<(path: string, recursive?: boolean) => Promise<void>>(),
    readFile: vi.fn<(path: string) => Promise<string>>(),
    stat: vi.fn<(path: string) => Promise<{ size?: number } | null>>(),
    writeFile: vi.fn<(path: string, content: string) => Promise<void>>(),
  },
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => mocks.storage,
  getParentPath: (path: string) => {
    const index = path.lastIndexOf('/');
    return index > 0 ? path.slice(0, index) : '';
  },
}));

vi.mock('@/stores/notes/systemStoragePaths', () => ({
  ensureSystemDirectory: vi.fn(async (path: string) => {
    if (!(await mocks.storage.exists(path))) {
      await mocks.storage.mkdir(path, true);
    }
  }),
  getVaultSystemStorePath: (vaultPath: string, fileName: string) => (
    Promise.resolve(`${vaultPath}/.system/${fileName}`)
  ),
}));

describe('AssetHashIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storage.exists.mockResolvedValue(false);
    mocks.storage.mkdir.mockResolvedValue(undefined);
    mocks.storage.readFile.mockResolvedValue('');
    mocks.storage.stat.mockResolvedValue(null);
    mocks.storage.writeFile.mockResolvedValue(undefined);
  });

  it('does not read hash index files when stat has no size', async () => {
    mocks.storage.stat.mockResolvedValue({});

    const index = await loadAssetHashIndex('/vault');

    expect(index.entries).toEqual({});
    expect(mocks.storage.readFile).not.toHaveBeenCalled();
  });

  it('does not parse hash index content that exceeds the limit after read', async () => {
    mocks.storage.stat.mockResolvedValue({ size: 256 });
    mocks.storage.readFile.mockResolvedValue('x'.repeat(2 * 1024 * 1024 + 1));

    const index = await loadAssetHashIndex('/vault');

    expect(index.entries).toEqual({});
    expect(mocks.storage.readFile).toHaveBeenCalledWith('/vault/.system/asset-hash-index.json');
  });

  it('loads bounded hash index files', async () => {
    mocks.storage.stat.mockResolvedValue({ size: 256 });
    mocks.storage.readFile.mockResolvedValue(JSON.stringify({
      version: 1,
      entries: {
        'image.png': {
          filename: 'image.png',
          hash: 'abc',
          size: 10,
          modifiedAt: 1,
          mimeType: 'image/png',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    }));

    const index = await loadAssetHashIndex('/vault');

    expect(index.entries['image.png']?.hash).toBe('abc');
  });

  it('drops hash index entries with oversized fields', async () => {
    mocks.storage.stat.mockResolvedValue({ size: 256 });
    mocks.storage.readFile.mockResolvedValue(JSON.stringify({
      version: 1,
      entries: {
        'image.png': {
          filename: 'image.png',
          hash: 'abc',
          size: 10,
          modifiedAt: 1,
          mimeType: 'image/png',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        'large.png': {
          filename: 'large.png',
          hash: 'x'.repeat(257),
          size: 10,
          modifiedAt: 1,
          mimeType: 'image/png',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    }));

    const index = await loadAssetHashIndex('/vault');

    expect(Object.keys(index.entries)).toEqual(['image.png']);
  });

  it('limits hash index entries loaded from storage', async () => {
    mocks.storage.stat.mockResolvedValue({ size: 1024 });
    const entries = Object.fromEntries(Array.from({ length: 5001 }, (_, index) => {
      const filename = `image-${index}.png`;
      return [filename, {
        filename,
        hash: `hash-${index}`,
        size: 10,
        modifiedAt: 1,
        mimeType: 'image/png',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }];
    }));
    mocks.storage.readFile.mockResolvedValue(JSON.stringify({ version: 1, entries }));

    const index = await loadAssetHashIndex('/vault');

    expect(Object.keys(index.entries)).toHaveLength(5000);
    expect(index.entries['image-4999.png']).toBeDefined();
    expect(index.entries['image-5000.png']).toBeUndefined();
  });

  it('creates the parent directory before saving', async () => {
    await saveAssetHashIndex('/vault', {
      version: 1,
      entries: {},
    });

    expect(mocks.storage.mkdir).toHaveBeenCalledWith('/vault/.system', true);
    expect(mocks.storage.writeFile).toHaveBeenCalledWith(
      '/vault/.system/asset-hash-index.json',
      expect.any(String),
    );
  });
});
