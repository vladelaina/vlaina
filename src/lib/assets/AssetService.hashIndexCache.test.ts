import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetService } from './AssetService';

const MAX_ASSET_SIZE = 50 * 1024 * 1024;

const mocks = vi.hoisted(() => ({
  storage: {
    exists: vi.fn(),
    mkdir: vi.fn(),
    listDir: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
    readBinaryFile: vi.fn(),
    writeFile: vi.fn(),
  },
  computeBufferHash: vi.fn(),
  computeFileHash: vi.fn(),
  writeAssetAtomic: vi.fn(),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => mocks.storage,
  getParentPath: (path: string) => {
    const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
    const index = normalized.lastIndexOf('/');
    return index <= 0 ? '/notesRoot' : normalized.slice(0, index);
  },
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/').replace(/\/+/g, '/')),
}));

vi.mock('./core/hashing', () => ({
  computeBufferHash: mocks.computeBufferHash,
  computeFileHash: mocks.computeFileHash,
}));

vi.mock('./io/writer', () => ({
  writeAssetAtomic: mocks.writeAssetAtomic,
}));

vi.mock('@/stores/notes/systemStoragePaths', () => ({
  ensureSystemDirectory: vi.fn(),
  getNotesRootSystemStorePath: (_notesRootPath: string, fileName: string) => (
    Promise.resolve(`/app/.vlaina/notes/notes-roots/notes-root-test/${fileName}`)
  ),
}));

describe('AssetService hash index cache validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storage.exists.mockImplementation(async (path: string) => path === '/notesRoot/docs/assets');
    mocks.storage.mkdir.mockResolvedValue(undefined);
    mocks.storage.listDir.mockResolvedValue([
      {
        name: 'alpha.png',
        path: '/notesRoot/docs/assets/alpha.png',
        isFile: true,
        isDirectory: false,
        size: 5,
      },
    ]);
    mocks.storage.stat.mockImplementation(async (path: string) => {
      if (path === '/app/.vlaina/notes/notes-roots/notes-root-test/assets.json') {
        return { name: 'assets.json', path, isFile: true, isDirectory: false, size: 220 };
      }
      if (path === '/notesRoot/docs/assets/alpha.png') {
        return { name: 'alpha.png', path, isFile: true, isDirectory: false, size: 5 };
      }
      return { name: path.split('/').pop() ?? '', path, isFile: true, isDirectory: false, size: 5, modifiedAt: 456 };
    });
    mocks.storage.readFile.mockResolvedValue(JSON.stringify({
      version: 1,
      entries: {
        './assets/alpha.png': {
          filename: './assets/alpha.png',
          hash: 'same-hash',
          size: 5,
          modifiedAt: null,
          mimeType: 'image/png',
          updatedAt: '2026-05-08T03:36:00.000Z',
        },
      },
    }));
    mocks.storage.readBinaryFile.mockResolvedValue(new Uint8Array([9, 8, 7, 6, 5]));
    mocks.storage.writeFile.mockResolvedValue(undefined);
    mocks.computeFileHash.mockResolvedValue('same-hash');
    mocks.computeBufferHash.mockResolvedValue('different-hash');
    mocks.writeAssetAtomic.mockResolvedValue(undefined);
  });

  it('does not trust same-size hash index entries when mtime is unavailable', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => {
      if (path === '/app/.vlaina/notes/notes-roots/notes-root-test/assets.json') {
        return { name: 'assets.json', path, isFile: true, isDirectory: false, size: 220 };
      }
      if (path === '/notesRoot/docs/assets/alpha.png') {
        return { name: 'alpha.png', path, isFile: true, isDirectory: false, size: 5 };
      }
      return {
        name: path.split('/').pop() ?? '',
        path,
        isFile: true,
        isDirectory: false,
        size: 5,
        modifiedAt: Number.POSITIVE_INFINITY,
      };
    });
    const file = {
      name: 'alpha.png',
      type: 'image/png',
      size: 5,
      lastModified: 1,
      arrayBuffer: vi.fn(async () => new Uint8Array([1, 2, 3, 4, 5]).buffer),
    } as unknown as File;

    const result = await AssetService.upload(
      file,
      { notesRootPath: '/notesRoot', currentNotePath: 'docs/current.md' },
      {
        storageMode: 'subfolder',
        subfolderName: 'assets',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(true);
    expect(result.isDuplicate).toBe(false);
    expect(mocks.storage.readBinaryFile).toHaveBeenCalledWith('/notesRoot/docs/assets/alpha.png', MAX_ASSET_SIZE);
    expect(mocks.writeAssetAtomic).toHaveBeenCalled();
    const lastWriteCall = mocks.storage.writeFile.mock.calls[mocks.storage.writeFile.mock.calls.length - 1];
    const savedIndex = JSON.parse(String(lastWriteCall?.[1] ?? '{}'));
    const uploadedEntry = Object.values(savedIndex.entries).find((entry: any) => entry.hash === 'same-hash') as any;
    expect(uploadedEntry.modifiedAt).toBeNull();
  });
});
