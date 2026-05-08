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
  readBinaryFile: vi.fn(async () => new Uint8Array([1, 2, 3])),
  stat: vi.fn(async (): Promise<{ modifiedAt?: number; size?: number } | null> => null),
}));

function encodeTextBytes(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new TextEncoder().encode(value));
}

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => ({
    readBinaryFile: hoisted.readBinaryFile,
    stat: hoisted.stat,
  }),
}));

describe('asset image reader cache', () => {
  beforeEach(() => {
    clearImageCache();
    hoisted.readBinaryFile.mockClear();
    hoisted.stat.mockReset();
    hoisted.stat.mockResolvedValue(null);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:test-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    clearImageCache();
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
    expect(blobText).not.toContain('<script');
    expect(blobText).not.toContain('foreignObject');
    expect(blobText).not.toContain('iframe');
    expect(blobText).not.toContain('javascript:');
    expect(blobText).not.toContain('onload');
  });

  it('sanitizes SVG images before returning base64 data URLs', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><text>ok</text></svg>';
    hoisted.readBinaryFile.mockResolvedValueOnce(encodeTextBytes(svg));

    const dataUrl = await loadImageAsBase64('/vault/assets/icon.svg');
    const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const decoded = atob(encoded);

    expect(dataUrl.startsWith('data:image/svg+xml;base64,')).toBe(true);
    expect(decoded).toContain('<svg');
    expect(decoded).toContain('<text>ok</text>');
    expect(decoded).not.toContain('<script');
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

    await Promise.resolve();
    await Promise.resolve();
    if (!resolveRead) {
      throw new Error('thumbnail read did not start');
    }
    resolveRead(encodeTextBytes('<svg xmlns="http://www.w3.org/2000/svg" />'));

    await expect(Promise.all([firstLoad, secondLoad])).resolves.toEqual([
      'blob:coalesced-svg-url',
      'blob:coalesced-svg-url',
    ]);
    expect(hoisted.readBinaryFile).toHaveBeenCalledTimes(1);
  });
});
