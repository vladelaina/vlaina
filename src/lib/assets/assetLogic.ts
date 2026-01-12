/**
 * Asset Logic - Pure functions for asset management
 * Separated from store for easier testing
 */

import { AssetIndex, AssetEntry } from './types';

/**
 * Check if a hash already exists in the index
 */
export function isDuplicateHash(index: AssetIndex, hash: string): boolean {
  return hash in index.hashMap;
}

/**
 * Get existing filename for a hash
 */
export function getExistingFilename(index: AssetIndex, hash: string): string | null {
  return index.hashMap[hash] || null;
}

/**
 * Add an asset entry to the index
 * Returns a new index (immutable)
 */
export function addAssetToIndex(
  index: AssetIndex,
  entry: AssetEntry
): AssetIndex {
  return {
    ...index,
    assets: { ...index.assets, [entry.filename]: entry },
    hashMap: { ...index.hashMap, [entry.hash]: entry.filename },
  };
}

/**
 * Remove an asset from the index
 * Returns a new index (immutable)
 */
export function removeAssetFromIndex(
  index: AssetIndex,
  filename: string
): AssetIndex {
  const entry = index.assets[filename];
  if (!entry) return index;

  const { [filename]: _, ...remainingAssets } = index.assets;
  const { [entry.hash]: __, ...remainingHashMap } = index.hashMap;

  return {
    ...index,
    assets: remainingAssets,
    hashMap: remainingHashMap,
  };
}

/**
 * Validate index consistency
 * Returns true if hashMap is consistent with assets
 */
export function isIndexConsistent(index: AssetIndex): boolean {
  // Every hash in hashMap should point to an existing asset
  for (const [hash, filename] of Object.entries(index.hashMap)) {
    const asset = index.assets[filename];
    if (!asset || asset.hash !== hash) {
      return false;
    }
  }

  // Every asset should have its hash in hashMap
  for (const [filename, asset] of Object.entries(index.assets)) {
    if (index.hashMap[asset.hash] !== filename) {
      return false;
    }
  }

  return true;
}

/**
 * Sort assets by upload date (newest first)
 */
export function sortAssetsByDate(assets: AssetEntry[]): AssetEntry[] {
  return [...assets].sort((a, b) => 
    new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
}

/**
 * Find unused assets by checking if their paths appear in content
 */
export function findUnusedAssets(
  index: AssetIndex,
  allContent: string,
  assetsDir: string = '.nekotick/assets/covers'
): string[] {
  const unused: string[] = [];
  
  for (const filename of Object.keys(index.assets)) {
    const assetPath = `${assetsDir}/${filename}`;
    if (!allContent.includes(assetPath)) {
      unused.push(filename);
    }
  }
  
  return unused;
}
