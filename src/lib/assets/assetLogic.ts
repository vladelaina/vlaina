/**
 * Asset Logic - Pure functions for asset management
 */

import { AssetEntry } from './types';

/**
 * Sort assets by upload date (newest first)
 */
export function sortAssetsByDate(assets: AssetEntry[]): AssetEntry[] {
  return [...assets].sort((a, b) => 
    new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
}
