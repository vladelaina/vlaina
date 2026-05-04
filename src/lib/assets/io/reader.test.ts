import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearImageCache,
  getCachedBlobUrl,
  invalidateImageCache,
  loadImageAsBlob,
} from './reader';

const hoisted = vi.hoisted(() => ({
  readBinaryFile: vi.fn(async () => new Uint8Array([1, 2, 3])),
  stat: vi.fn(async (): Promise<{ modifiedAt?: number; size?: number } | null> => null),
}));

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
});
