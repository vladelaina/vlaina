/**
 * Asset Logic Tests
 * Property-based tests for asset management logic
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { sortAssetsByDate } from './assetLogic';
import { AssetEntry } from './types';

// Arbitrary for generating valid AssetEntry
const assetEntryArb = fc.record({
  filename: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9._-]{0,49}$/),
  hash: fc.constant(''),
  size: fc.integer({ min: 1, max: 10000000 }),
  mimeType: fc.constantFrom('image/jpeg', 'image/png', 'image/gif', 'image/webp'),
  uploadedAt: fc.integer({ min: 1577836800000, max: 1893456000000 }) // 2020-2030
    .map(ts => new Date(ts).toISOString()),
});

describe('assetLogic', () => {
  describe('sortAssetsByDate', () => {
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
});
