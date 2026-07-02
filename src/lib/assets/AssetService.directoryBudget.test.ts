import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { AssetService, MAX_ASSET_LIST_DIRECTORY_ENTRIES } from './AssetService';

function createImageFile(name: string): File {
  return {
    name,
    type: 'image/png',
    size: 5,
    lastModified: 1,
    arrayBuffer: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
  } as unknown as File;
}

function createRegularFileEntry(index: number) {
  return {
    name: `asset-${index}.txt`,
    path: `/notesRoot/assets/asset-${index}.txt`,
    isFile: true,
    isDirectory: false,
  };
}

describe('AssetService directory budgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storage.exists.mockResolvedValue(true);
    mocks.storage.mkdir.mockResolvedValue(undefined);
    mocks.storage.listDir.mockResolvedValue([]);
    mocks.storage.stat.mockResolvedValue(null);
    mocks.storage.readFile.mockResolvedValue('');
    mocks.storage.readBinaryFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mocks.storage.writeFile.mockResolvedValue(undefined);
    mocks.computeBufferHash.mockResolvedValue('existing-hash');
    mocks.computeFileHash.mockResolvedValue('new-hash');
    mocks.writeAssetAtomic.mockResolvedValue(undefined);
  });

  it('does not spend the asset list budget on regular files before image files', async () => {
    mocks.storage.listDir.mockResolvedValue([
      ...Array.from({ length: MAX_ASSET_LIST_DIRECTORY_ENTRIES }, (_value, index) =>
        createRegularFileEntry(index),
      ),
      {
        name: 'late.png',
        path: '/notesRoot/assets/late.png',
        isFile: true,
        isDirectory: false,
        size: 5,
        modifiedAt: 1,
      },
    ]);

    await expect(
      AssetService.list(
        { notesRootPath: '/notesRoot' },
        {
          storageMode: 'notesRootSubfolder',
          imageNotesRootSubfolderName: 'assets',
          filenameFormat: 'original',
        },
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        filename: 'assets/late.png',
        mimeType: 'image/png',
      }),
    ]);
  });

  it('uses late same-name image entries when avoiding upload filename collisions', async () => {
    mocks.storage.listDir.mockResolvedValue([
      ...Array.from({ length: MAX_ASSET_LIST_DIRECTORY_ENTRIES }, (_value, index) =>
        createRegularFileEntry(index),
      ),
      {
        name: 'alpha.png',
        path: '/notesRoot/assets/alpha.png',
        isFile: true,
        isDirectory: false,
        size: 6,
        modifiedAt: 1,
      },
    ]);
    mocks.storage.stat.mockImplementation(async (path: string) =>
      path === '/notesRoot/assets/alpha.png'
        ? { name: 'alpha.png', path, isFile: true, isDirectory: false, size: 6, modifiedAt: 1 }
        : null,
    );

    const result = await AssetService.upload(
      createImageFile('alpha.png'),
      { notesRootPath: '/notesRoot' },
      {
        storageMode: 'notesRootSubfolder',
        imageNotesRootSubfolderName: 'assets',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(true);
    expect(result.path).toBe('assets/alpha_1.png');
    expect(mocks.writeAssetAtomic).toHaveBeenCalledWith('/notesRoot/assets/alpha_1.png', expect.any(Uint8Array));
  });
});
