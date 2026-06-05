import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetService } from './AssetService';

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
    return index <= 0 ? '/vault' : normalized.slice(0, index);
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
  getVaultSystemStorePath: (vaultPath: string, fileName: string) => Promise.resolve(`${vaultPath}/.system/${fileName}`),
}));

describe('AssetService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storage.exists.mockResolvedValue(false);
    mocks.storage.mkdir.mockResolvedValue(undefined);
    mocks.storage.listDir.mockResolvedValue([]);
    mocks.storage.stat.mockResolvedValue(null);
    mocks.storage.readFile.mockResolvedValue('');
    mocks.storage.readBinaryFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mocks.storage.writeFile.mockResolvedValue(undefined);
    mocks.computeBufferHash.mockResolvedValue('hash-existing');
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

  function createTypedImageFile(name: string, type: string): File {
    return {
      name,
      type,
      size: 5,
      lastModified: 1,
      arrayBuffer: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
    } as unknown as File;
  }

  function createSvgImageFile(name: string, svg: string): File {
    return {
      name,
      type: 'image/svg+xml',
      size: svg.length,
      lastModified: 1,
      arrayBuffer: vi.fn(async () => new TextEncoder().encode(svg).buffer),
    } as unknown as File;
  }

  function createClipboardImageFile(type = 'image/png'): File {
    return {
      name: '',
      type,
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
    expect(mocks.computeFileHash).not.toHaveBeenCalled();
  });

  it('adds an image extension when a pasted clipboard image has no filename', async () => {
    const file = createClipboardImageFile('image/png');

    const result = await AssetService.upload(
      file,
      { vaultPath: '/vault', currentNotePath: 'docs/current.md' },
      {
        storageMode: 'subfolder',
        subfolderName: 'assets',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(true);
    expect(mocks.writeAssetAtomic).toHaveBeenCalledWith('/vault/docs/assets/image.png', expect.any(Uint8Array));
    expect(result.path).toBe('./assets/image.png');
    expect(result.entry?.mimeType).toBe('image/png');
  });

  it('uses the clipboard image MIME type when naming an unnamed pasted image', async () => {
    const file = createClipboardImageFile('image/jpeg');

    const result = await AssetService.upload(
      file,
      { vaultPath: '/vault', currentNotePath: 'docs/current.md' },
      {
        storageMode: 'subfolder',
        subfolderName: 'assets',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(true);
    expect(mocks.writeAssetAtomic).toHaveBeenCalledWith('/vault/docs/assets/image.jpg', expect.any(Uint8Array));
    expect(result.path).toBe('./assets/image.jpg');
    expect(result.entry?.mimeType).toBe('image/jpeg');
  });

  it('normalizes uploaded image filenames to match the MIME type', async () => {
    const file = createTypedImageFile('spoofed.svg', 'image/png');

    const result = await AssetService.upload(
      file,
      { vaultPath: '/vault', currentNotePath: 'docs/current.md' },
      {
        storageMode: 'subfolder',
        subfolderName: 'assets',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(true);
    expect(mocks.writeAssetAtomic).toHaveBeenCalledWith('/vault/docs/assets/spoofed.png', expect.any(Uint8Array));
    expect(result.path).toBe('./assets/spoofed.png');
    expect(result.entry?.mimeType).toBe('image/png');
  });

  it('sanitizes uploaded SVG images before writing them as note assets', async () => {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">',
      '<script>alert(1)</script>',
      '<foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject>',
      '<image href="https://example.test/a.png" xlink:href="https://example.test/b.png"></image>',
      '<rect filter="url(https://example.test/filter.svg#drop)" fill="url(#local-fill)"></rect>',
      '<circle cx="1" cy="1" r="1"></circle>',
      '</svg>',
    ].join('');
    const file = createSvgImageFile('diagram.svg', svg);

    const result = await AssetService.upload(
      file,
      { vaultPath: '/vault', currentNotePath: 'docs/current.md' },
      {
        storageMode: 'subfolder',
        subfolderName: 'assets',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(true);
    expect(mocks.writeAssetAtomic.mock.calls[0]?.[0]).toBe('/vault/docs/assets/diagram.svg');
    const bytes = mocks.writeAssetAtomic.mock.calls[0]?.[1] as Uint8Array;
    const output = new TextDecoder().decode(bytes);
    expect(output).toContain('<svg');
    expect(output).toContain('<circle');
    expect(output).toContain('url(#local-fill)');
    expect(output).not.toContain('<script');
    expect(output).not.toContain('foreignObject');
    expect(output).not.toContain('javascript:');
    expect(output).not.toContain('example.test');
    expect(output).not.toContain('onload');
    expect(result.entry?.size).toBe(bytes.byteLength);
  });

  it('rejects unsupported image MIME types before writing bytes', async () => {
    const file = createTypedImageFile('scan.tiff', 'image/tiff');

    const result = await AssetService.upload(
      file,
      { vaultPath: '/vault', currentNotePath: 'docs/current.md' },
      {
        storageMode: 'subfolder',
        subfolderName: 'assets',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid file type: image/tiff. Only images are allowed.');
    expect(mocks.writeAssetAtomic).not.toHaveBeenCalled();
  });

  it('stores note-subfolder uploads beside an absolute external note even when a vault is open', async () => {
    const file = createImageFile('external.png');

    const result = await AssetService.upload(
      file,
      { vaultPath: '/vault', currentNotePath: '/outside/current.md' },
      {
        storageMode: 'subfolder',
        subfolderName: 'assets',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(true);
    expect(mocks.storage.mkdir).toHaveBeenCalledWith('/outside/assets', true);
    expect(mocks.writeAssetAtomic).toHaveBeenCalledWith('/outside/assets/external.png', expect.any(Uint8Array));
    expect(result.path).toBe('./assets/external.png');
  });

  it('stores current-folder uploads beside an absolute external note even when a vault is open', async () => {
    const file = createImageFile('external.png');

    const result = await AssetService.upload(
      file,
      { vaultPath: '/vault', currentNotePath: '/outside/current.md' },
      {
        storageMode: 'currentFolder',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(true);
    expect(mocks.storage.mkdir).toHaveBeenCalledWith('/outside', true);
    expect(mocks.writeAssetAtomic).toHaveBeenCalledWith('/outside/external.png', expect.any(Uint8Array));
    expect(result.path).toBe('./external.png');
  });

  it('reuses an existing same-hash image from the target folder without rewriting it', async () => {
    const file = createImageFile('alpha.png');
    mocks.computeFileHash.mockResolvedValue('same-hash');
    mocks.computeBufferHash.mockResolvedValue('same-hash');
    mocks.storage.exists.mockImplementation(async (path: string) => path === '/vault/docs/assets');
    mocks.storage.listDir.mockResolvedValue([
      {
        name: 'alpha.png',
        path: '/vault/docs/assets/alpha.png',
        isFile: true,
        isDirectory: false,
        size: 5,
        modifiedAt: 123,
      },
    ]);

    const result = await AssetService.upload(
      file,
      { vaultPath: '/vault', currentNotePath: 'docs/current.md' },
      {
        storageMode: 'subfolder',
        subfolderName: 'assets',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(true);
    expect(result.isDuplicate).toBe(true);
    expect(result.path).toBe('./assets/alpha.png');
    expect(mocks.storage.readBinaryFile).toHaveBeenCalledWith('/vault/docs/assets/alpha.png');
    expect(mocks.writeAssetAtomic).not.toHaveBeenCalled();
  });

  it('stats existing images before duplicate checks when directory entries do not include size', async () => {
    const file = createImageFile('alpha.png');
    mocks.computeFileHash.mockResolvedValue('same-hash');
    mocks.computeBufferHash.mockResolvedValue('same-hash');
    mocks.storage.exists.mockImplementation(async (path: string) => path === '/vault/docs/assets');
    mocks.storage.stat.mockImplementation(async (path: string) => (
      path === '/vault/docs/assets/alpha.png'
        ? { name: 'alpha.png', path, isFile: true, isDirectory: false, size: 5, modifiedAt: 123 }
        : null
    ));
    mocks.storage.listDir.mockResolvedValue([
      {
        name: 'alpha.png',
        path: '/vault/docs/assets/alpha.png',
        isFile: true,
        isDirectory: false,
      },
    ]);

    const result = await AssetService.upload(
      file,
      { vaultPath: '/vault', currentNotePath: 'docs/current.md' },
      {
        storageMode: 'subfolder',
        subfolderName: 'assets',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(true);
    expect(result.isDuplicate).toBe(true);
    expect(result.path).toBe('./assets/alpha.png');
    expect(mocks.storage.stat).toHaveBeenCalledWith('/vault/docs/assets/alpha.png');
    expect(mocks.storage.readBinaryFile).toHaveBeenCalledWith('/vault/docs/assets/alpha.png');
    expect(mocks.writeAssetAtomic).not.toHaveBeenCalled();
  });

  it('does not read existing image candidates when size metadata remains unavailable', async () => {
    const file = createImageFile('alpha.png');
    mocks.computeFileHash.mockResolvedValue('same-hash');
    mocks.computeBufferHash.mockResolvedValue('same-hash');
    mocks.storage.exists.mockImplementation(async (path: string) => path === '/vault/docs/assets');
    mocks.storage.listDir.mockResolvedValue([
      {
        name: 'alpha.png',
        path: '/vault/docs/assets/alpha.png',
        isFile: true,
        isDirectory: false,
      },
    ]);

    const result = await AssetService.upload(
      file,
      { vaultPath: '/vault', currentNotePath: 'docs/current.md' },
      {
        storageMode: 'subfolder',
        subfolderName: 'assets',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(true);
    expect(result.isDuplicate).toBe(false);
    expect(result.path).toBe('./assets/alpha_1.png');
    expect(mocks.computeFileHash).not.toHaveBeenCalled();
    expect(mocks.storage.readBinaryFile).not.toHaveBeenCalled();
    expect(mocks.writeAssetAtomic).toHaveBeenCalledWith('/vault/docs/assets/alpha_1.png', expect.any(Uint8Array));
  });

  it('skips unreadable duplicate candidates instead of failing the upload', async () => {
    const file = createImageFile('alpha.png');
    mocks.computeFileHash.mockResolvedValue('new-hash');
    mocks.storage.exists.mockImplementation(async (path: string) => path === '/vault/docs/assets');
    mocks.storage.readBinaryFile.mockRejectedValue(new Error('Permission denied'));
    mocks.storage.listDir.mockResolvedValue([
      {
        name: 'alpha.png',
        path: '/vault/docs/assets/alpha.png',
        isFile: true,
        isDirectory: false,
        size: 5,
        modifiedAt: 123,
      },
    ]);

    const result = await AssetService.upload(
      file,
      { vaultPath: '/vault', currentNotePath: 'docs/current.md' },
      {
        storageMode: 'subfolder',
        subfolderName: 'assets',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(true);
    expect(result.isDuplicate).toBe(false);
    expect(result.path).toBe('./assets/alpha_1.png');
    expect(mocks.storage.readBinaryFile).toHaveBeenCalledWith('/vault/docs/assets/alpha.png');
    expect(mocks.writeAssetAtomic).toHaveBeenCalledWith('/vault/docs/assets/alpha_1.png', expect.any(Uint8Array));
  });

  it('continues uploading when the duplicate hash index cannot be saved', async () => {
    const file = createImageFile('alpha.png');
    mocks.computeFileHash.mockResolvedValue('new-hash');
    mocks.computeBufferHash.mockResolvedValue('existing-hash');
    mocks.storage.exists.mockImplementation(async (path: string) => path === '/vault/docs/assets');
    mocks.storage.writeFile.mockRejectedValue(new Error('Index unavailable'));
    mocks.storage.listDir.mockResolvedValue([
      {
        name: 'alpha.png',
        path: '/vault/docs/assets/alpha.png',
        isFile: true,
        isDirectory: false,
        size: 5,
        modifiedAt: 123,
      },
    ]);

    const result = await AssetService.upload(
      file,
      { vaultPath: '/vault', currentNotePath: 'docs/current.md' },
      {
        storageMode: 'subfolder',
        subfolderName: 'assets',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(true);
    expect(result.isDuplicate).toBe(false);
    expect(result.path).toBe('./assets/alpha_1.png');
    expect(mocks.storage.writeFile).toHaveBeenCalled();
    expect(mocks.writeAssetAtomic).toHaveBeenCalledWith('/vault/docs/assets/alpha_1.png', expect.any(Uint8Array));
  });

  it('returns duplicate uploads even when saving the duplicate hash index fails', async () => {
    const file = createImageFile('alpha.png');
    mocks.computeFileHash.mockResolvedValue('same-hash');
    mocks.computeBufferHash.mockResolvedValue('same-hash');
    mocks.storage.exists.mockImplementation(async (path: string) => path === '/vault/docs/assets');
    mocks.storage.writeFile.mockRejectedValue(new Error('Index unavailable'));
    mocks.storage.listDir.mockResolvedValue([
      {
        name: 'alpha.png',
        path: '/vault/docs/assets/alpha.png',
        isFile: true,
        isDirectory: false,
        size: 5,
        modifiedAt: 123,
      },
    ]);

    const result = await AssetService.upload(
      file,
      { vaultPath: '/vault', currentNotePath: 'docs/current.md' },
      {
        storageMode: 'subfolder',
        subfolderName: 'assets',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(true);
    expect(result.isDuplicate).toBe(true);
    expect(result.path).toBe('./assets/alpha.png');
    expect(mocks.storage.writeFile).toHaveBeenCalled();
    expect(mocks.writeAssetAtomic).not.toHaveBeenCalled();
  });

  it('uses a fresh hash index entry without reading an existing same-size file', async () => {
    const file = createImageFile('alpha.png');
    mocks.computeFileHash.mockResolvedValue('same-hash');
    mocks.storage.exists.mockImplementation(async (path: string) => path === '/vault/docs/assets');
    mocks.storage.stat.mockImplementation(async (path: string) => (
      path === '/vault/.system/asset-hash-index.json'
        ? { name: 'asset-hash-index.json', path, isFile: true, isDirectory: false, size: 220 }
        : null
    ));
    mocks.storage.readFile.mockResolvedValue(JSON.stringify({
      version: 1,
      entries: {
        './assets/alpha.png': {
          filename: './assets/alpha.png',
          hash: 'same-hash',
          size: 5,
          modifiedAt: 123,
          mimeType: 'image/png',
          updatedAt: '2026-05-08T03:36:00.000Z',
        },
      },
    }));
    mocks.storage.listDir.mockResolvedValue([
      {
        name: 'alpha.png',
        path: '/vault/docs/assets/alpha.png',
        isFile: true,
        isDirectory: false,
        size: 5,
        modifiedAt: 123,
      },
    ]);

    const result = await AssetService.upload(
      file,
      { vaultPath: '/vault', currentNotePath: 'docs/current.md' },
      {
        storageMode: 'subfolder',
        subfolderName: 'assets',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(true);
    expect(result.isDuplicate).toBe(true);
    expect(result.path).toBe('./assets/alpha.png');
    expect(mocks.storage.readBinaryFile).not.toHaveBeenCalled();
    expect(mocks.writeAssetAtomic).not.toHaveBeenCalled();
  });

  it('does not hash existing images with different names during duplicate checks', async () => {
    const file = createImageFile('alpha.png');
    mocks.storage.exists.mockImplementation(async (path: string) => path === '/vault/docs/assets');
    mocks.storage.listDir.mockResolvedValue([
      {
        name: 'same-content-different-name.png',
        path: '/vault/docs/assets/same-content-different-name.png',
        isFile: true,
        isDirectory: false,
        size: 5,
        modifiedAt: 123,
      },
    ]);

    const result = await AssetService.upload(
      file,
      { vaultPath: '/vault', currentNotePath: 'docs/current.md' },
      {
        storageMode: 'subfolder',
        subfolderName: 'assets',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(true);
    expect(result.isDuplicate).toBe(false);
    expect(mocks.computeFileHash).not.toHaveBeenCalled();
    expect(mocks.storage.readBinaryFile).not.toHaveBeenCalled();
    expect(mocks.writeAssetAtomic).toHaveBeenCalledWith('/vault/docs/assets/alpha.png', expect.any(Uint8Array));
  });

  it('does not hash existing files with different sizes during duplicate checks', async () => {
    const file = createImageFile('alpha.png');
    mocks.storage.exists.mockImplementation(async (path: string) => path === '/vault/docs/assets');
    mocks.storage.listDir.mockResolvedValue([
      {
        name: 'alpha.png',
        path: '/vault/docs/assets/alpha.png',
        isFile: true,
        isDirectory: false,
        size: 500,
        modifiedAt: 123,
      },
    ]);

    const result = await AssetService.upload(
      file,
      { vaultPath: '/vault', currentNotePath: 'docs/current.md' },
      {
        storageMode: 'subfolder',
        subfolderName: 'assets',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(true);
    expect(result.isDuplicate).toBe(false);
    expect(mocks.computeFileHash).not.toHaveBeenCalled();
    expect(mocks.storage.readBinaryFile).not.toHaveBeenCalled();
    expect(mocks.writeAssetAtomic).toHaveBeenCalledWith('/vault/docs/assets/alpha_1.png', expect.any(Uint8Array));
  });

  it('ignores unsafe directory entries during duplicate checks', async () => {
    const file = createImageFile('alpha.png');
    mocks.storage.exists.mockImplementation(async (path: string) => path === '/vault/docs/assets');
    mocks.storage.listDir.mockResolvedValue([
      {
        name: 'alpha.png',
        path: '/vault/outside/alpha.png',
        isFile: true,
        isDirectory: false,
        size: 5,
        modifiedAt: 123,
      },
      {
        name: '../alpha.png',
        path: '/vault/docs/assets/../alpha.png',
        isFile: true,
        isDirectory: false,
        size: 5,
        modifiedAt: 123,
      },
    ]);

    const result = await AssetService.upload(
      file,
      { vaultPath: '/vault', currentNotePath: 'docs/current.md' },
      {
        storageMode: 'subfolder',
        subfolderName: 'assets',
        filenameFormat: 'original',
      },
      [],
    );

    expect(result.success).toBe(true);
    expect(result.isDuplicate).toBe(false);
    expect(result.path).toBe('./assets/alpha.png');
    expect(mocks.computeFileHash).not.toHaveBeenCalled();
    expect(mocks.storage.readBinaryFile).not.toHaveBeenCalled();
    expect(mocks.writeAssetAtomic).toHaveBeenCalledWith('/vault/docs/assets/alpha.png', expect.any(Uint8Array));
  });

  it('lists images from the configured note subfolder with stored cover paths', async () => {
    mocks.storage.exists.mockResolvedValue(true);
    mocks.storage.listDir.mockResolvedValue([
      {
        name: 'cover.jpg',
        path: '/vault/docs/assets/cover.jpg',
        isFile: true,
        isDirectory: false,
        size: 123,
        modifiedAt: Date.UTC(2026, 4, 8, 1, 47, 54),
      },
      {
        name: 'notes.txt',
        path: '/vault/docs/assets/notes.txt',
        isFile: true,
        isDirectory: false,
        size: 10,
      },
    ]);

    const assets = await AssetService.list(
      { vaultPath: '/vault', currentNotePath: 'docs/current.md' },
      {
        storageMode: 'subfolder',
        subfolderName: 'assets',
        filenameFormat: 'original',
      },
    );

    expect(mocks.storage.listDir).toHaveBeenCalledWith('/vault/docs/assets');
    expect(assets).toEqual([
      {
        filename: './assets/cover.jpg',
        hash: '',
        size: 123,
        mimeType: 'image/jpeg',
        uploadedAt: '2026-05-08T01:47:54.000Z',
      },
    ]);
  });

  it('ignores unsafe directory entries while listing assets', async () => {
    mocks.storage.exists.mockResolvedValue(true);
    mocks.storage.listDir.mockResolvedValue([
      {
        name: 'cover.jpg',
        path: '/vault/docs/assets/cover.jpg',
        isFile: true,
        isDirectory: false,
        size: 123,
        modifiedAt: Date.UTC(2026, 4, 8, 1, 47, 54),
      },
      {
        name: '../secret.jpg',
        path: '/vault/docs/secret.jpg',
        isFile: true,
        isDirectory: false,
        size: 10,
      },
      {
        name: 'escape.jpg',
        path: '/vault/docs/assets/../escape.jpg',
        isFile: true,
        isDirectory: false,
        size: 10,
      },
    ]);

    const assets = await AssetService.list(
      { vaultPath: '/vault', currentNotePath: 'docs/current.md' },
      {
        storageMode: 'subfolder',
        subfolderName: 'assets',
        filenameFormat: 'original',
      },
    );

    expect(assets).toEqual([
      {
        filename: './assets/cover.jpg',
        hash: '',
        size: 123,
        mimeType: 'image/jpeg',
        uploadedAt: '2026-05-08T01:47:54.000Z',
      },
    ]);
  });
});
