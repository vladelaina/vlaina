/**
 * Asset Logic Tests
 * Property-based tests for asset management logic
 * 
 * Feature: asset-library
 * Property 1: Index HashMapConsistency
 * Property 4: Duplicate Detection Returns Existing Path
 * Property 6: Asset Sorting By Date
 * Property 8: Delete Removes From Both Locations
 * Property 9: Unused Asset Identification
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isDuplicateHash,
  getExistingFilename,
  addAssetToIndex,
  removeAssetFromIndex,
  isIndexConsistent,
  sortAssetsByDate,
  findUnusedAssets,
} from './assetLogic';
import { AssetEntry, createEmptyIndex } from './types';

// Arbitrary for generating valid AssetEntry
const assetEntryArb = fc.record({
  filename: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9._-]{0,49}$/),
  hash: fc.stringMatching(/^[0-9a-f]{16}$/),
  size: fc.integer({ min: 1, max: 10000000 }),
  mimeType: fc.constantFrom('image/jpeg', 'image/png', 'image/gif', 'image/webp'),
  uploadedAt: fc.integer({ min: 1577836800000, max: 1893456000000 }) // 2020-2030
    .map(ts => new Date(ts).toISOString()),
});

// Generate a valid index with unique filenames and hashes
const validIndexArb = fc.array(assetEntryArb, { minLength: 0, maxLength: 10 })
  .map(entries => {
    const index = createEmptyIndex();
    const usedFilenames = new Set<string>();
    const usedHashes = new Set<string>();
    
    for (const entry of entries) {
      // Skip if filename or hash already used
      if (usedFilenames.has(entry.filename) || usedHashes.has(entry.hash)) {
        continue;
      }
      
      usedFilenames.add(entry.filename);
      usedHashes.add(entry.hash);
      
      index.assets[entry.filename] = entry;
      index.hashMap[entry.hash] = entry.filename;
    }
    
    return index;
  });

describe('assetLogic', () => {
  describe('Property 1: Index HashMapConsistency', () => {
    it('newly created index is consistent', () => {
      const index = createEmptyIndex();
      expect(isIndexConsistent(index)).toBe(true);
    });

    it('index remains consistent after adding assets', () => {
      fc.assert(
        fc.property(
          validIndexArb,
          assetEntryArb,
          (index, newEntry) => {
            // Ensure unique filename and hash
            if (index.assets[newEntry.filename] || index.hashMap[newEntry.hash]) {
              return true; // Skip this case
            }
            
            const updated = addAssetToIndex(index, newEntry);
            expect(isIndexConsistent(updated)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('index remains consistent after removing assets', () => {
      fc.assert(
        fc.property(
          validIndexArb,
          (index) => {
            const filenames = Object.keys(index.assets);
            if (filenames.length === 0) return true;
            
            // Remove a random asset
            const toRemove = filenames[Math.floor(Math.random() * filenames.length)];
            const updated = removeAssetFromIndex(index, toRemove);
            
            expect(isIndexConsistent(updated)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: Duplicate Detection Returns Existing Path', () => {
    it('detects duplicate hash correctly', () => {
      fc.assert(
        fc.property(
          validIndexArb,
          (index) => {
            // For each asset in index, its hash should be detected as duplicate
            for (const [filename, entry] of Object.entries(index.assets)) {
              expect(isDuplicateHash(index, entry.hash)).toBe(true);
              expect(getExistingFilename(index, entry.hash)).toBe(filename);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('non-existent hash is not detected as duplicate', () => {
      fc.assert(
        fc.property(
          validIndexArb,
          fc.stringMatching(/^[0-9a-f]{16}$/),
          (index, randomHash) => {
            // If hash doesn't exist in index
            if (!index.hashMap[randomHash]) {
              expect(isDuplicateHash(index, randomHash)).toBe(false);
              expect(getExistingFilename(index, randomHash)).toBe(null);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 6: Asset Sorting By Date', () => {
    it('sorts assets by uploadedAt descending (newest first)', () => {
      fc.assert(
        fc.property(
          fc.array(assetEntryArb, { minLength: 0, maxLength: 20 }),
          (assets) => {
            const sorted = sortAssetsByDate(assets);
            
            // Verify descending order
            for (let i = 1; i < sorted.length; i++) {
              const prevDate = new Date(sorted[i - 1].uploadedAt).getTime();
              const currDate = new Date(sorted[i].uploadedAt).getTime();
              expect(prevDate).toBeGreaterThanOrEqual(currDate);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('does not modify original array', () => {
      const assets: AssetEntry[] = [
        { filename: 'a.jpg', hash: '1111111111111111', size: 100, mimeType: 'image/jpeg', uploadedAt: '2024-01-01T00:00:00Z' },
        { filename: 'b.jpg', hash: '2222222222222222', size: 200, mimeType: 'image/jpeg', uploadedAt: '2024-06-01T00:00:00Z' },
      ];
      
      const original = [...assets];
      sortAssetsByDate(assets);
      
      expect(assets).toEqual(original);
    });
  });

  describe('Property 8: Delete Removes From Both Locations', () => {
    it('removes asset from both assets and hashMap', () => {
      fc.assert(
        fc.property(
          validIndexArb,
          (index) => {
            const filenames = Object.keys(index.assets);
            if (filenames.length === 0) return true;
            
            const toRemove = filenames[0];
            const entry = index.assets[toRemove];
            const updated = removeAssetFromIndex(index, toRemove);
            
            // Should not exist in assets
            expect(toRemove in updated.assets).toBe(false);
            
            // Should not exist in hashMap
            expect(entry.hash in updated.hashMap).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('removing non-existent asset returns unchanged index', () => {
      const index = createEmptyIndex();
      const updated = removeAssetFromIndex(index, 'nonexistent.jpg');
      expect(updated).toEqual(index);
    });
  });

  describe('Property 9: Unused Asset Identification', () => {
    it('identifies assets not referenced in content', () => {
      fc.assert(
        fc.property(
          validIndexArb,
          (index) => {
            const filenames = Object.keys(index.assets);
            if (filenames.length === 0) return true;
            
            // Create content that references only some assets
            const referenced = filenames.slice(0, Math.floor(filenames.length / 2));
            const content = referenced.map(f => `.nekotick/assets/covers/${f}`).join('\n');
            
            const unused = findUnusedAssets(index, content);
            
            // All unused should not be in referenced
            for (const filename of unused) {
              expect(referenced).not.toContain(filename);
            }
            
            // All referenced should not be in unused
            for (const filename of referenced) {
              expect(unused).not.toContain(filename);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns all assets when content is empty', () => {
      const index = createEmptyIndex();
      index.assets['photo.jpg'] = {
        filename: 'photo.jpg',
        hash: '1234567890abcdef',
        size: 1000,
        mimeType: 'image/jpeg',
        uploadedAt: new Date().toISOString(),
      };
      index.hashMap['1234567890abcdef'] = 'photo.jpg';
      
      const unused = findUnusedAssets(index, '');
      expect(unused).toContain('photo.jpg');
    });

    it('returns empty when all assets are referenced', () => {
      const index = createEmptyIndex();
      index.assets['photo.jpg'] = {
        filename: 'photo.jpg',
        hash: '1234567890abcdef',
        size: 1000,
        mimeType: 'image/jpeg',
        uploadedAt: new Date().toISOString(),
      };
      index.hashMap['1234567890abcdef'] = 'photo.jpg';
      
      const content = 'Some text with .nekotick/assets/covers/photo.jpg reference';
      const unused = findUnusedAssets(index, content);
      expect(unused).toHaveLength(0);
    });
  });
});
