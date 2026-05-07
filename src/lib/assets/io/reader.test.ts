import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearImageCache,
  getCachedBlobUrl,
  invalidateImageCache,
  loadImageAsBase64,
  loadImageAsBlob,
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
});
