/**
 * Atomic Write Service Tests
 * Property-based tests for temp file cleanup
 * 
 * Feature: asset-library
 * Property 7: Temp File Cleanup
 * Validates: Requirements 6.3
 */

import { beforeEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  storage: {
    writeBinaryFile: vi.fn(),
    rename: vi.fn(),
    exists: vi.fn(),
    deleteFile: vi.fn(),
  },
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => mocks.storage,
}));

import { isTempFile, getTempPath, getFinalPath, writeAssetAtomic } from './writer';

describe('atomicWrite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storage.writeBinaryFile.mockResolvedValue(undefined);
    mocks.storage.rename.mockResolvedValue(undefined);
    mocks.storage.exists.mockResolvedValue(false);
    mocks.storage.deleteFile.mockResolvedValue(undefined);
  });

  it('uses a unique temp file for each atomic write to the same target', async () => {
    await writeAssetAtomic('/vault/assets/image.png', new Uint8Array([1]));
    await writeAssetAtomic('/vault/assets/image.png', new Uint8Array([2]));

    const firstTempPath = mocks.storage.writeBinaryFile.mock.calls[0]?.[0];
    const secondTempPath = mocks.storage.writeBinaryFile.mock.calls[1]?.[0];

    expect(firstTempPath).not.toBe(secondTempPath);
    expect(firstTempPath).toMatch(/\/vault\/assets\/image\.png\..+\.tmp$/);
    expect(secondTempPath).toMatch(/\/vault\/assets\/image\.png\..+\.tmp$/);
    expect(mocks.storage.rename).toHaveBeenNthCalledWith(1, firstTempPath, '/vault/assets/image.png');
    expect(mocks.storage.rename).toHaveBeenNthCalledWith(2, secondTempPath, '/vault/assets/image.png');
  });

  describe('Property 7: Temp File Cleanup', () => {
    describe('isTempFile', () => {
      it('correctly identifies temp files', () => {
        expect(isTempFile('photo.jpg.tmp')).toBe(true);
        expect(isTempFile('image.png.tmp')).toBe(true);
        expect(isTempFile('.tmp')).toBe(true);
      });

      it('correctly identifies non-temp files', () => {
        expect(isTempFile('photo.jpg')).toBe(false);
        expect(isTempFile('image.png')).toBe(false);
        expect(isTempFile('file.tmp.jpg')).toBe(false);
        expect(isTempFile('tmp')).toBe(false);
      });
    });

    describe('getTempPath', () => {
      it('appends .tmp extension', () => {
        expect(getTempPath('photo.jpg')).toBe('photo.jpg.tmp');
        expect(getTempPath('path/to/file.png')).toBe('path/to/file.png.tmp');
      });
    });

    describe('getFinalPath', () => {
      it('removes .tmp extension', () => {
        expect(getFinalPath('photo.jpg.tmp')).toBe('photo.jpg');
        expect(getFinalPath('path/to/file.png.tmp')).toBe('path/to/file.png');
      });

      it('returns unchanged if not temp file', () => {
        expect(getFinalPath('photo.jpg')).toBe('photo.jpg');
        expect(getFinalPath('file.tmp.jpg')).toBe('file.tmp.jpg');
      });
    });

    describe('round-trip property', () => {
      it('getTempPath then getFinalPath returns original', () => {
        const testPaths = [
          'photo.jpg',
          'image.png',
          'path/to/file.gif',
          'chinese_file.webp',
          'file with spaces.jpg',
        ];

        for (const path of testPaths) {
          const tempPath = getTempPath(path);
          const finalPath = getFinalPath(tempPath);
          expect(finalPath).toBe(path);
        }
      });
    });
  });
});
