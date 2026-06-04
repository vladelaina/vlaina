import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearImageCache,
  getCachedBlobUrl,
  invalidateImageCache,
  loadImageAsBase64,
  loadImageAsBlob,
  loadImageThumbnailAsBlob,
} from './reader';

const hoisted = vi.hoisted(() => ({
  readBinaryFile: vi.fn<(path: string) => Promise<Uint8Array>>(async () => new Uint8Array([1, 2, 3])),
  writeBinaryFile: vi.fn<(path: string, bytes: Uint8Array, options?: { recursive?: boolean }) => Promise<void>>(async () => undefined),
  exists: vi.fn<(path: string) => Promise<boolean>>(async () => false),
  getBasePath: vi.fn(async () => '/app-data'),
  stat: vi.fn(async (): Promise<{ modifiedAt?: number; size?: number } | null> => null),
  platform: 'web' as 'electron' | 'web',
}));

function encodeTextBytes(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new TextEncoder().encode(value));
}

vi.mock('@/lib/storage/adapter', () => ({
  joinPath: async (...segments: string[]) => segments.join('/'),
  getStorageAdapter: () => ({
    platform: hoisted.platform,
    readBinaryFile: hoisted.readBinaryFile,
    writeBinaryFile: hoisted.writeBinaryFile,
    exists: hoisted.exists,
    getBasePath: hoisted.getBasePath,
    stat: hoisted.stat,
  }),
}));

describe('asset image reader cache', () => {
  beforeEach(() => {
    clearImageCache();
    hoisted.readBinaryFile.mockClear();
    hoisted.writeBinaryFile.mockClear();
    hoisted.exists.mockReset();
    hoisted.exists.mockResolvedValue(false);
    hoisted.getBasePath.mockReset();
    hoisted.getBasePath.mockResolvedValue('/app-data');
    hoisted.stat.mockReset();
    hoisted.stat.mockResolvedValue(null);
    hoisted.platform = 'web';
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:test-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    clearImageCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('revokes cached blob URLs when invalidating a single path', async () => {
    await loadImageAsBlob('/vault/assets/cover.png');

    expect(getCachedBlobUrl('/vault/assets/cover.png')).toBe('blob:test-url');

    invalidateImageCache('/vault/assets/cover.png');

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
    expect(getCachedBlobUrl('/vault/assets/cover.png')).toBeUndefined();
  });

  it('reuses cached full image blobs even when file metadata is unavailable', async () => {
    vi.mocked(URL.createObjectURL).mockReturnValueOnce('blob:unvalidated-url');

    await expect(loadImageAsBlob('/vault/assets/cover.png')).resolves.toBe('blob:unvalidated-url');
    await expect(loadImageAsBlob('/vault/assets/cover.png')).resolves.toBe('blob:unvalidated-url');

    expect(hoisted.readBinaryFile).toHaveBeenCalledTimes(1);
  });

  it('reloads and revokes a cached blob URL when file metadata changes', async () => {
    hoisted.stat
      .mockResolvedValueOnce({ modifiedAt: 1, size: 3 })
      .mockResolvedValueOnce({ modifiedAt: 1, size: 3 })
      .mockResolvedValueOnce({ modifiedAt: 2, size: 4 });
    vi.mocked(URL.createObjectURL)
      .mockReturnValueOnce('blob:first-url')
      .mockReturnValueOnce('blob:second-url');

    await expect(loadImageAsBlob('/vault/assets/cover.png')).resolves.toBe('blob:first-url');
    await expect(loadImageAsBlob('/vault/assets/cover.png')).resolves.toBe('blob:first-url');
    await expect(loadImageAsBlob('/vault/assets/cover.png')).resolves.toBe('blob:second-url');

    expect(hoisted.readBinaryFile).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first-url');
  });

  it('rejects non-image paths without reading them', async () => {
    await expect(loadImageAsBlob('/vault/assets/secret.md')).rejects.toThrow(
      'Only image files can be loaded as note assets.',
    );

    expect(hoisted.readBinaryFile).not.toHaveBeenCalled();
  });

  it('rejects oversized image files before reading them when stat has a size', async () => {
    hoisted.stat.mockResolvedValueOnce({ modifiedAt: 1, size: 51 * 1024 * 1024 });

    await expect(loadImageAsBlob('/vault/assets/huge.png')).rejects.toThrow(
      'Image asset is too large to preview.',
    );

    expect(hoisted.readBinaryFile).not.toHaveBeenCalled();
  });

  it('sanitizes SVG images before creating blob URLs', async () => {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">',
      '<script>alert(1)</script>',
      '<foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject>',
      '<a href="javascript:alert(1)"><text>bad</text></a>',
      '<image href="https://example.test/a.png" xlink:href="https://example.test/b.png"></image>',
      '<rect filter="url(https://example.test/filter.svg#drop)" fill="url(#local-fill)" />',
      '<text style="fill:url(#local-fill); stroke:url(https://example.test/stroke.svg#x); opacity:.8">safe</text>',
      '<circle cx="1" cy="1" r="1" />',
      '</svg>',
    ].join('');
    hoisted.readBinaryFile.mockResolvedValueOnce(encodeTextBytes(svg));
    let blobTextPromise: Promise<string> = Promise.resolve('');
    vi.mocked(URL.createObjectURL).mockImplementationOnce((blob) => {
      blobTextPromise = new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob as Blob);
      });
      return 'blob:sanitized-svg';
    });

    await expect(loadImageAsBlob('/vault/assets/icon.svg')).resolves.toBe('blob:sanitized-svg');
    const blobText = await blobTextPromise;

    expect(blobText).toContain('<svg');
    expect(blobText).toContain('<circle');
    expect(blobText).toContain('url(#local-fill)');
    expect(blobText).not.toContain('<script');
    expect(blobText).not.toContain('foreignObject');
    expect(blobText).not.toContain('iframe');
    expect(blobText).not.toContain('javascript:');
    expect(blobText).not.toContain('example.test');
    expect(blobText).not.toContain('onload');
  });

  it('sanitizes SVG images before returning base64 data URLs', async () => {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg">',
      '<script>alert(1)</script>',
      '<image href="https://example.test/a.png"></image>',
      '<text>ok</text>',
      '</svg>',
    ].join('');
    hoisted.readBinaryFile.mockResolvedValueOnce(encodeTextBytes(svg));

    const dataUrl = await loadImageAsBase64('/vault/assets/icon.svg');
    const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const decoded = atob(encoded);

    expect(dataUrl.startsWith('data:image/svg+xml;base64,')).toBe(true);
    expect(decoded).toContain('<svg');
    expect(decoded).toContain('<text>ok</text>');
    expect(decoded).not.toContain('<script');
    expect(decoded).not.toContain('example.test');
  });

  it('caches generated thumbnails by file metadata without rereading the image', async () => {
    hoisted.stat.mockResolvedValue({ modifiedAt: 1, size: 3 });
    vi.mocked(URL.createObjectURL)
      .mockReturnValueOnce('blob:source-url')
      .mockReturnValueOnce('blob:thumb-url');
    const originalImage = globalThis.Image;
    const originalCreateElement = document.createElement.bind(document);
    vi.stubGlobal('Image', class {
      naturalWidth = 640;
      naturalHeight = 320;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    });
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() }),
          toBlob: (callback: (blob: Blob | null) => void) => callback(new Blob(['thumb'], { type: 'image/webp' })),
        } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName, options);
    });

    await expect(loadImageThumbnailAsBlob('/vault/assets/cover.png')).resolves.toBe('blob:thumb-url');
    await expect(loadImageThumbnailAsBlob('/vault/assets/cover.png')).resolves.toBe('blob:thumb-url');

    expect(hoisted.readBinaryFile).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:source-url');
    vi.stubGlobal('Image', originalImage);
  });

  it('creates raster thumbnails in a worker when worker canvas APIs are available', async () => {
    hoisted.stat.mockResolvedValue({ modifiedAt: 1, size: 3 });
    vi.mocked(URL.createObjectURL).mockReturnValueOnce('blob:worker-thumb-url');
    const terminate = vi.fn();
    const postMessage = vi.fn(function (
      this: {
        onmessage: ((event: MessageEvent<{ ok: boolean; blob: Blob }>) => void) | null;
      },
    ) {
      queueMicrotask(() => {
        this.onmessage?.({
          data: {
            ok: true,
            blob: new Blob(['worker-thumb'], { type: 'image/webp' }),
          },
        } as MessageEvent<{ ok: boolean; blob: Blob }>);
      });
    });

    class ThumbnailWorker {
      onmessage: ((event: MessageEvent<{ ok: boolean; blob: Blob }>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      terminate = terminate;
      postMessage = postMessage;
    }

    vi.stubGlobal('Worker', ThumbnailWorker);

    await expect(loadImageThumbnailAsBlob('/vault/assets/cover.png')).resolves.toBe('blob:worker-thumb-url');

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it('reuses persisted electron thumbnails before reading the source image', async () => {
    hoisted.platform = 'electron';
    hoisted.stat.mockResolvedValue({ modifiedAt: 1, size: 3 });
    hoisted.exists.mockResolvedValue(true);
    hoisted.readBinaryFile.mockResolvedValueOnce(new Uint8Array([9, 8, 7]));
    vi.mocked(URL.createObjectURL).mockReturnValueOnce('blob:persistent-thumb-url');

    await expect(loadImageThumbnailAsBlob('/vault/assets/cover.png', {
      maxEdgePx: 1280,
      allowMainThreadFallback: false,
    })).resolves.toBe('blob:persistent-thumb-url');
    await expect(loadImageThumbnailAsBlob('/vault/assets/cover.png', {
      maxEdgePx: 1280,
      allowMainThreadFallback: false,
    })).resolves.toBe('blob:persistent-thumb-url');

    expect(hoisted.getBasePath).toHaveBeenCalledTimes(1);
    const existsPath = hoisted.exists.mock.calls[0]?.[0] as string;
    const readPath = hoisted.readBinaryFile.mock.calls[0]?.[0] as string;
    expect(existsPath).toContain('/app-data/.vlaina/cache/image-thumbnails/');
    expect(hoisted.readBinaryFile).toHaveBeenCalledTimes(1);
    expect(readPath).toContain('/app-data/.vlaina/cache/image-thumbnails/');
    expect(readPath).not.toBe('/vault/assets/cover.png');
  });

  it('persists generated electron worker thumbnails in the background', async () => {
    hoisted.platform = 'electron';
    hoisted.stat.mockResolvedValue({ modifiedAt: 1, size: 3 });
    hoisted.exists.mockResolvedValue(false);
    vi.mocked(URL.createObjectURL).mockReturnValueOnce('blob:worker-thumb-url');
    const terminate = vi.fn();
    const postMessage = vi.fn(function (
      this: {
        onmessage: ((event: MessageEvent<{ ok: boolean; blob: Blob }>) => void) | null;
      },
    ) {
      queueMicrotask(() => {
        this.onmessage?.({
          data: {
            ok: true,
            blob: Object.assign(new Blob(['worker-thumb'], { type: 'image/webp' }), {
              arrayBuffer: async () => new TextEncoder().encode('worker-thumb').buffer,
            }),
          },
        } as MessageEvent<{ ok: boolean; blob: Blob }>);
      });
    });

    class ThumbnailWorker {
      onmessage: ((event: MessageEvent<{ ok: boolean; blob: Blob }>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      terminate = terminate;
      postMessage = postMessage;
    }

    vi.stubGlobal('Worker', ThumbnailWorker);

    await expect(loadImageThumbnailAsBlob('/vault/assets/cover.png', {
      maxEdgePx: 1280,
      allowMainThreadFallback: false,
    })).resolves.toBe('blob:worker-thumb-url');

    await vi.waitFor(() => {
      expect(hoisted.writeBinaryFile).toHaveBeenCalledTimes(1);
    });
    const writePath = hoisted.writeBinaryFile.mock.calls[0]?.[0] as string;
    const writeOptions = hoisted.writeBinaryFile.mock.calls[0]?.[2] as { recursive?: boolean };
    expect(writePath).toContain('/app-data/.vlaina/cache/image-thumbnails/');
    expect(writeOptions).toEqual({ recursive: true });
  });

  it('can skip main-thread canvas thumbnail fallback when worker APIs are unavailable', async () => {
    hoisted.stat.mockResolvedValue({ modifiedAt: 1, size: 3 });
    vi.mocked(URL.createObjectURL).mockReturnValueOnce('blob:original-thumbnail-url');
    vi.stubGlobal('Worker', undefined);
    const createElementSpy = vi.spyOn(document, 'createElement');

    await expect(loadImageThumbnailAsBlob('/vault/assets/cover.png', {
      maxEdgePx: 1280,
      allowMainThreadFallback: false,
    })).resolves.toBe('blob:original-thumbnail-url');

    expect(createElementSpy).not.toHaveBeenCalledWith('canvas');
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:original-thumbnail-url');
  });

  it('does not reuse a no-fallback original blob when main-thread thumbnail fallback is allowed later', async () => {
    hoisted.stat.mockResolvedValue({ modifiedAt: 1, size: 3 });
    vi.mocked(URL.createObjectURL)
      .mockReturnValueOnce('blob:original-thumbnail-url')
      .mockReturnValueOnce('blob:source-url')
      .mockReturnValueOnce('blob:resized-thumbnail-url');
    vi.stubGlobal('Worker', undefined);
    const originalImage = globalThis.Image;
    const originalCreateElement = document.createElement.bind(document);
    vi.stubGlobal('Image', class {
      naturalWidth = 640;
      naturalHeight = 320;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    });
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() }),
          toBlob: (callback: (blob: Blob | null) => void) => callback(new Blob(['thumb'], { type: 'image/webp' })),
        } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName, options);
    });

    await expect(loadImageThumbnailAsBlob('/vault/assets/cover.png', {
      maxEdgePx: 1280,
      allowMainThreadFallback: false,
    })).resolves.toBe('blob:original-thumbnail-url');
    await expect(loadImageThumbnailAsBlob('/vault/assets/cover.png', {
      maxEdgePx: 1280,
      allowMainThreadFallback: true,
    })).resolves.toBe('blob:resized-thumbnail-url');

    expect(hoisted.readBinaryFile).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:source-url');
    vi.stubGlobal('Image', originalImage);
  });

  it('reuses cached thumbnails when file metadata is unavailable', async () => {
    hoisted.readBinaryFile.mockResolvedValueOnce(encodeTextBytes('<svg xmlns="http://www.w3.org/2000/svg" />'));
    vi.mocked(URL.createObjectURL).mockReturnValueOnce('blob:thumb-svg-url');

    await expect(loadImageThumbnailAsBlob('/vault/assets/icon.svg')).resolves.toBe('blob:thumb-svg-url');
    await expect(loadImageThumbnailAsBlob('/vault/assets/icon.svg')).resolves.toBe('blob:thumb-svg-url');

    expect(hoisted.readBinaryFile).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent thumbnail reads for the same file metadata', async () => {
    hoisted.stat.mockResolvedValue({ modifiedAt: 1, size: 48 });
    let resolveRead: ((bytes: Uint8Array<ArrayBuffer>) => void) | undefined;
    hoisted.readBinaryFile.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRead = resolve;
    }));
    vi.mocked(URL.createObjectURL).mockReturnValueOnce('blob:coalesced-svg-url');

    const firstLoad = loadImageThumbnailAsBlob('/vault/assets/icon.svg');
    const secondLoad = loadImageThumbnailAsBlob('/vault/assets/icon.svg');

    await vi.waitFor(() => {
      expect(resolveRead).toBeDefined();
    });
    const completeRead = resolveRead;
    if (!completeRead) {
      throw new Error('thumbnail read did not start');
    }
    completeRead(encodeTextBytes('<svg xmlns="http://www.w3.org/2000/svg" />'));

    await expect(Promise.all([firstLoad, secondLoad])).resolves.toEqual([
      'blob:coalesced-svg-url',
      'blob:coalesced-svg-url',
    ]);
    expect(hoisted.readBinaryFile).toHaveBeenCalledTimes(1);
  });
});
