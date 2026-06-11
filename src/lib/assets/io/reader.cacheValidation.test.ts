import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearImageCache,
  loadImageAsBlob,
  loadImageThumbnailAsBlob,
} from './reader';

const hoisted = vi.hoisted(() => ({
  readBinaryFile: vi.fn<(path: string, _maxBytes?: number) => Promise<Uint8Array>>(async () => new Uint8Array([1, 2, 3])),
  writeBinaryFile: vi.fn<(path: string, bytes: Uint8Array, options?: { recursive?: boolean }) => Promise<void>>(async () => undefined),
  exists: vi.fn<(path: string) => Promise<boolean>>(async () => false),
  getBasePath: vi.fn(async () => '/app-data'),
  stat: vi.fn(async (): Promise<{ modifiedAt?: number | null; size?: number | null } | null> => null),
}));

function encodeTextBytes(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new TextEncoder().encode(value));
}

vi.mock('@/lib/storage/adapter', () => ({
  joinPath: async (...segments: string[]) => segments.join('/'),
  getStorageAdapter: () => ({
    platform: 'web',
    readBinaryFile: hoisted.readBinaryFile,
    writeBinaryFile: hoisted.writeBinaryFile,
    exists: hoisted.exists,
    getBasePath: hoisted.getBasePath,
    stat: hoisted.stat,
  }),
}));

describe('asset image reader cache validation', () => {
  beforeEach(() => {
    clearImageCache();
    hoisted.readBinaryFile.mockReset();
    hoisted.readBinaryFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
    hoisted.stat.mockReset();
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:test-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    clearImageCache();
    vi.restoreAllMocks();
  });

  it('does not reuse cached full image blobs when stat has size but no modified time', async () => {
    hoisted.stat.mockResolvedValue({ size: 3 });
    vi.mocked(URL.createObjectURL)
      .mockReturnValueOnce('blob:first-url')
      .mockReturnValueOnce('blob:second-url');

    await expect(loadImageAsBlob('/vault/assets/cover.png')).resolves.toBe('blob:first-url');
    await expect(loadImageAsBlob('/vault/assets/cover.png')).resolves.toBe('blob:second-url');

    expect(hoisted.readBinaryFile).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first-url');
  });

  it('does not reuse cached thumbnails when stat has size but no modified time', async () => {
    hoisted.stat.mockResolvedValue({ size: 48 });
    hoisted.readBinaryFile.mockResolvedValue(encodeTextBytes('<svg xmlns="http://www.w3.org/2000/svg" />'));
    vi.mocked(URL.createObjectURL)
      .mockReturnValueOnce('blob:first-thumb-url')
      .mockReturnValueOnce('blob:second-thumb-url');

    await expect(loadImageThumbnailAsBlob('/vault/assets/icon.svg')).resolves.toBe('blob:first-thumb-url');
    await expect(loadImageThumbnailAsBlob('/vault/assets/icon.svg')).resolves.toBe('blob:second-thumb-url');

    expect(hoisted.readBinaryFile).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first-thumb-url');
  });
});
