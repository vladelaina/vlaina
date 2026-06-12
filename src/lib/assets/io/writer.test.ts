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
    listDir: vi.fn(),
  },
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => mocks.storage,
  joinPath: (...segments: string[]) => Promise.resolve(segments.filter(Boolean).join('/')),
}));

import {
  cleanupTempFiles,
  getFinalPath,
  getTempPath,
  isTempFile,
  MAX_TEMP_FILE_CLEANUP_SCAN_ENTRIES,
  writeAssetAtomic,
} from './writer';

describe('atomicWrite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storage.writeBinaryFile.mockResolvedValue(undefined);
    mocks.storage.rename.mockResolvedValue(undefined);
    mocks.storage.exists.mockResolvedValue(false);
    mocks.storage.deleteFile.mockResolvedValue(undefined);
    mocks.storage.listDir.mockResolvedValue([]);
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
    it('cleans temp files directly inside the asset directory', async () => {
      mocks.storage.listDir.mockResolvedValue([
        { name: 'image.png.tmp', path: '/vault/assets/image.png.tmp', isFile: true, isDirectory: false },
        { name: 'image.png', path: '/vault/assets/image.png', isFile: true, isDirectory: false },
      ]);

      await expect(cleanupTempFiles('/vault/assets')).resolves.toBe(1);

      expect(mocks.storage.deleteFile).toHaveBeenCalledWith('/vault/assets/image.png.tmp');
    });

    it('does not clean unsafe temp directory entries', async () => {
      mocks.storage.listDir.mockResolvedValue([
        { name: '../secret.tmp', path: '/vault/secret.tmp', isFile: true, isDirectory: false },
        { name: 'escape.tmp', path: '/vault/assets/../escape.tmp', isFile: true, isDirectory: false },
        { name: 'nested.tmp', path: '/vault/assets/nested/nested.tmp', isFile: true, isDirectory: false },
        { name: 'dir.tmp', path: '/vault/assets/dir.tmp', isFile: false, isDirectory: true },
      ]);

      await expect(cleanupTempFiles('/vault/assets')).resolves.toBe(0);

      expect(mocks.storage.deleteFile).not.toHaveBeenCalled();
    });

    it('does not spend the temp cleanup budget on regular files before temp files', async () => {
      mocks.storage.listDir.mockResolvedValue([
        ...Array.from({ length: MAX_TEMP_FILE_CLEANUP_SCAN_ENTRIES }, (_value, index) => ({
          name: `asset-${index}.png`,
          path: `/vault/assets/asset-${index}.png`,
          isFile: true,
          isDirectory: false,
        })),
        {
          name: 'late.tmp',
          path: '/vault/assets/late.tmp',
          isFile: true,
          isDirectory: false,
        },
      ]);

      await expect(cleanupTempFiles('/vault/assets')).resolves.toBe(1);

      expect(mocks.storage.deleteFile).toHaveBeenCalledWith('/vault/assets/late.tmp');
    });

    it('bounds the number of temp file candidates scanned during cleanup', async () => {
      mocks.storage.listDir.mockResolvedValue([
        ...Array.from({ length: MAX_TEMP_FILE_CLEANUP_SCAN_ENTRIES }, (_value, index) => ({
          name: `asset-${index}.png.tmp`,
          path: `/vault/assets/asset-${index}.png.tmp`,
          isFile: true,
          isDirectory: false,
        })),
        {
          name: 'late.tmp',
          path: '/vault/assets/late.tmp',
          isFile: true,
          isDirectory: false,
        },
      ]);

      await expect(cleanupTempFiles('/vault/assets')).resolves.toBe(MAX_TEMP_FILE_CLEANUP_SCAN_ENTRIES);

      expect(mocks.storage.deleteFile).toHaveBeenCalledTimes(MAX_TEMP_FILE_CLEANUP_SCAN_ENTRIES);
      expect(mocks.storage.deleteFile).not.toHaveBeenCalledWith('/vault/assets/late.tmp');
    });

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
