/**
 * Asset Logic - Pure functions for asset management
 * Simplified version without index management
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

/**
 * Find unused assets by checking if their filenames appear in content
 */
export function findUnusedAssets(
  assets: AssetEntry[],
  allContent: string
): string[] {
  const unused: string[] = [];
  
  for (const asset of assets) {
    if (!allContent.includes(asset.filename)) {
      unused.push(asset.filename);
    }
  }
  
  return unused;
}
