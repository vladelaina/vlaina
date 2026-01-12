/**
 * Asset Logic Tests
 * Property-based tests for asset management logic
 * 
 * Feature: asset-library
 * Property 6: Asset Sorting By Date
 * Property 9: Unused Asset Identification
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  sortAssetsByDate,
  findUnusedAssets,
} from './assetLogic';
import { AssetEntry } from './types';

// Arbitrary for generating valid AssetEntry
const assetEntryArb = fc.record({
  filename: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9._-]{0,49}$/),
  hash: fc.constant(''), // Not used in simplified version
  size: fc.integer({ min: 1, max: 10000000 }),
  mimeType: fc.constantFrom('image/jpeg', 'image/png', 'image/gif', 'image/webp'),
  uploadedAt: fc.integer({ min: 1577836800000, max: 1893456000000 }) // 2020-2030
    .map(ts => new Date(ts).toISOString()),
});

describe('assetLogic', () => {
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
        { filename: 'a.jpg', hash: '', size: 100, mimeType: 'image/jpeg', uploadedAt: '2024-01-01T00:00:00Z' },
        { filename: 'b.jpg', hash: '', size: 200, mimeType: 'image/jpeg', uploadedAt: '2024-06-01T00:00:00Z' },
      ];
      
      const original = [...assets];
      sortAssetsByDate(assets);
      
      expect(assets).toEqual(original);
    });
  });

  describe('Property 9: Unused Asset Identification', () => {
    it('identifies assets not referenced in content', () => {
      fc.assert(
        fc.property(
          fc.array(assetEntryArb, { minLength: 1, maxLength: 10 }),
          (assets) => {
            // Create content that references only some assets (by filename)
            const referenced = assets.slice(0, Math.floor(assets.length / 2)).map(a => a.filename);
            const content = referenced.join('\n');
            
            const unused = findUnusedAssets(assets, content);
            
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
      const assets: AssetEntry[] = [{
        filename: 'photo.jpg',
        hash: '',
        size: 1000,
        mimeType: 'image/jpeg',
        uploadedAt: new Date().toISOString(),
      }];
      
      const unused = findUnusedAssets(assets, '');
      expect(unused).toContain('photo.jpg');
    });

    it('returns empty when all assets are referenced by filename', () => {
      const assets: AssetEntry[] = [{
        filename: 'photo.jpg',
        hash: '',
        size: 1000,
        mimeType: 'image/jpeg',
        uploadedAt: new Date().toISOString(),
      }];
      
      const content = 'cover: photo.jpg';
      const unused = findUnusedAssets(assets, content);
      expect(unused).toHaveLength(0);
    });
  });
});
