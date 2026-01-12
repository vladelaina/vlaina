/**
 * Filename Service Tests
 * Property-based tests for filename handling
 * 
 * Feature: asset-library
 * Property 3: Filename Handling Correctness
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  sanitizeFilename,
  truncateFilename,
  resolveFilenameConflict,
  processFilename,
} from './filenameService';

const DANGEROUS_CHARS = '<>:"/\\|?*';

describe('filenameService', () => {
  describe('Property 3: Filename Handling Correctness', () => {
    describe('sanitizeFilename', () => {
      it('removes exactly the dangerous characters and preserves others', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 100 }),
            (input) => {
              const result = sanitizeFilename(input);
              
              // Result should not contain any dangerous characters
              for (const char of DANGEROUS_CHARS) {
                expect(result).not.toContain(char);
              }
              
              // All non-dangerous characters from input should be preserved
              // (except leading/trailing whitespace which is trimmed)
              const inputWithoutDangerous = input.replace(/[<>:"/\\|?*]/g, '').trim();
              if (inputWithoutDangerous) {
                expect(result).toBe(inputWithoutDangerous);
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      it('preserves Chinese characters and spaces', () => {
        // Test specific safe characters
        const safeInputs = [
          '中文测试',
          'hello world',
          'photo_2024',
          '照片-test',
          'file.name.jpg',
        ];
        
        for (const input of safeInputs) {
          const result = sanitizeFilename(input);
          expect(result).toBe(input);
        }
      });

      it('returns "untitled" for empty or all-dangerous input', () => {
        expect(sanitizeFilename('')).toBe('untitled');
        expect(sanitizeFilename('   ')).toBe('untitled');
        expect(sanitizeFilename('<>:"/\\|?*')).toBe('untitled');
      });
    });

    describe('truncateFilename', () => {
      it('result is always <= maxLength', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 500 }),
            fc.integer({ min: 10, max: 200 }),
            (name, maxLength) => {
              const result = truncateFilename(name, maxLength);
              expect(result.length).toBeLessThanOrEqual(maxLength);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('preserves extension when truncating', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 200 }),
            fc.constantFrom('.jpg', '.png', '.gif', '.webp', '.txt'),
            fc.integer({ min: 20, max: 100 }),
            (baseName, ext, maxLength) => {
              const fullName = baseName + ext;
              const result = truncateFilename(fullName, maxLength);
              
              // If result is truncated and extension fits, it should end with extension
              if (result.length < fullName.length && ext.length < maxLength) {
                expect(result.endsWith(ext)).toBe(true);
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      it('does not modify names within limit', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 50 }),
            (name) => {
              const result = truncateFilename(name, 200);
              expect(result).toBe(name);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('resolveFilenameConflict', () => {
      it('appends numeric suffix for conflicts', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 50 })
              .filter(s => !s.includes('_') && s.trim().length > 0 && /^[a-zA-Z0-9]+$/.test(s)),
            fc.constantFrom('.jpg', '.png', '.gif'),
            (baseName, ext) => {
              const name = baseName + ext;
              const existing = new Set([name]);
              
              const result = resolveFilenameConflict(name, existing);
              
              // Result should be different from original
              expect(result).not.toBe(name);
              
              // Result should have _N suffix before extension
              expect(result).toMatch(/_\d+\.[a-z]+$/);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('handles case-insensitive conflicts', () => {
        const existing = new Set(['Photo.jpg', 'IMAGE.PNG']);
        
        // Same case
        expect(resolveFilenameConflict('Photo.jpg', existing)).toBe('Photo_1.jpg');
        
        // Different case - should still detect conflict
        expect(resolveFilenameConflict('photo.jpg', existing)).toBe('photo_1.jpg');
        expect(resolveFilenameConflict('PHOTO.JPG', existing)).toBe('PHOTO_1.JPG');
        expect(resolveFilenameConflict('image.png', existing)).toBe('image_1.png');
      });

      it('returns original name when no conflict', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            (name) => {
              const existing = new Set(['other.jpg', 'another.png']);
              
              if (!existing.has(name.toLowerCase())) {
                const result = resolveFilenameConflict(name, existing);
                expect(result).toBe(name);
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      it('finds next available number', () => {
        const existing = new Set(['photo.jpg', 'photo_1.jpg', 'photo_2.jpg']);
        const result = resolveFilenameConflict('photo.jpg', existing);
        expect(result).toBe('photo_3.jpg');
      });
    });

    describe('processFilename (integration)', () => {
      it('produces valid filesystem-safe names', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 0, maxLength: 300 }),
            (input) => {
              const result = processFilename(input, new Set());
              
              // Should not contain dangerous characters
              for (const char of DANGEROUS_CHARS) {
                expect(result).not.toContain(char);
              }
              
              // Should be within length limit
              expect(result.length).toBeLessThanOrEqual(200);
              
              // Should not be empty
              expect(result.length).toBeGreaterThan(0);
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });

  describe('Edge cases', () => {
    it('handles filenames with multiple dots', () => {
      expect(truncateFilename('my.file.name.jpg', 15)).toBe('my.file.nam.jpg');
    });

    it('handles filenames starting with dot', () => {
      expect(sanitizeFilename('.hidden')).toBe('.hidden');
    });

    it('handles unicode filenames', () => {
      expect(sanitizeFilename('照片_2024.jpg')).toBe('照片_2024.jpg');
      expect(sanitizeFilename('фото.png')).toBe('фото.png');
      expect(sanitizeFilename('写真<test>.jpg')).toBe('写真test.jpg');
    });
  });
});
