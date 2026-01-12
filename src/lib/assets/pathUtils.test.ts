/**
 * Path Utils Tests
 * Property-based tests for path handling
 * 
 * Feature: asset-library
 * Property 10: Path Storage Format
 * Validates: Requirements 8.1, 8.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  toStoragePath,
  toOSPath,
  isRelativePath,
  isValidAssetFilename,
  buildAssetPath,
} from './pathUtils';

describe('pathUtils', () => {
  describe('Property 10: Path Storage Format', () => {
    describe('toStoragePath', () => {
      it('converts all backslashes to forward slashes', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 0, maxLength: 100 }),
            (path) => {
              const result = toStoragePath(path);
              expect(result).not.toContain('\\');
            }
          ),
          { numRuns: 100 }
        );
      });

      it('preserves forward slashes', () => {
        expect(toStoragePath('a/b/c')).toBe('a/b/c');
        expect(toStoragePath('.nekotick/assets/covers/photo.jpg')).toBe('.nekotick/assets/covers/photo.jpg');
      });

      it('converts Windows paths', () => {
        expect(toStoragePath('.nekotick\\assets\\covers\\photo.jpg')).toBe('.nekotick/assets/covers/photo.jpg');
        expect(toStoragePath('a\\b\\c')).toBe('a/b/c');
      });
    });

    describe('toOSPath', () => {
      it('converts to Windows format when separator is backslash', () => {
        expect(toOSPath('.nekotick/assets/covers/photo.jpg', '\\')).toBe('.nekotick\\assets\\covers\\photo.jpg');
      });

      it('keeps Unix format when separator is forward slash', () => {
        expect(toOSPath('.nekotick/assets/covers/photo.jpg', '/')).toBe('.nekotick/assets/covers/photo.jpg');
      });

      it('round-trips correctly', () => {
        fc.assert(
          fc.property(
            fc.stringMatching(/^[a-zA-Z0-9._/-]+$/),
            fc.constantFrom('/', '\\'),
            (path, sep) => {
              const osPath = toOSPath(path, sep);
              const storagePath = toStoragePath(osPath);
              expect(storagePath).toBe(path);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('isRelativePath', () => {
      it('returns false for Windows absolute paths', () => {
        expect(isRelativePath('C:\\Users\\test')).toBe(false);
        expect(isRelativePath('D:/Documents')).toBe(false);
        expect(isRelativePath('c:\\folder')).toBe(false);
      });

      it('returns false for Unix absolute paths', () => {
        expect(isRelativePath('/home/user')).toBe(false);
        expect(isRelativePath('/var/log')).toBe(false);
      });

      it('returns false for UNC paths', () => {
        expect(isRelativePath('\\\\server\\share')).toBe(false);
      });

      it('returns true for relative paths', () => {
        expect(isRelativePath('.nekotick/assets/covers/photo.jpg')).toBe(true);
        expect(isRelativePath('folder/file.txt')).toBe(true);
        expect(isRelativePath('file.txt')).toBe(true);
        expect(isRelativePath('./relative')).toBe(true);
        expect(isRelativePath('../parent')).toBe(true);
      });
    });

    describe('isValidAssetFilename', () => {
      it('returns true for valid filenames', () => {
        expect(isValidAssetFilename('photo.jpg')).toBe(true);
        expect(isValidAssetFilename('image.png')).toBe(true);
        expect(isValidAssetFilename('my-cover_2024.webp')).toBe(true);
      });

      it('returns false for paths with separators', () => {
        expect(isValidAssetFilename('folder/photo.jpg')).toBe(false);
        expect(isValidAssetFilename('folder\\photo.jpg')).toBe(false);
        expect(isValidAssetFilename('.nekotick/assets/covers/photo.jpg')).toBe(false);
      });

      it('returns false for filenames without extension', () => {
        expect(isValidAssetFilename('photo')).toBe(false);
        expect(isValidAssetFilename('noextension')).toBe(false);
      });
    });

    describe('buildAssetPath', () => {
      it('builds correct asset path', () => {
        expect(buildAssetPath('photo.jpg')).toBe('.nekotick/assets/covers/photo.jpg');
        expect(buildAssetPath('image.png')).toBe('.nekotick/assets/covers/image.png');
      });

      it('result always starts with correct prefix', () => {
        fc.assert(
          fc.property(
            fc.stringMatching(/^[a-zA-Z0-9._-]+\.[a-zA-Z]+$/),
            (filename) => {
              const path = buildAssetPath(filename);
              expect(path).toBe(`.nekotick/assets/covers/${filename}`);
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });
});
