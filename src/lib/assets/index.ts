/**
 * Asset Library - Centralized asset management
 * 
 * This module provides:
 * - Content-based deduplication via SHA-256 hashing
 * - Safe filename handling with sanitization and conflict resolution
 * - Atomic file writes for crash safety
 * - Cross-platform path handling
 * - Image loading with blob URL caching
 */

// Types
export type { AssetEntry, AssetIndex, UploadResult } from './types';
export { createEmptyIndex } from './types';

// Hash Service
export { computeFileHash, computeQuickHash, computeBufferHash, isLargeFile } from './hashService';

// Filename Service
export { 
  sanitizeFilename, 
  truncateFilename, 
  resolveFilenameConflict, 
  processFilename,
  getMimeType,
  isImageFilename 
} from './filenameService';

// Atomic Write
export { writeAssetAtomic, cleanupTempFiles, isTempFile, getTempPath, getFinalPath } from './atomicWrite';

// Asset Logic (pure functions)
export {
  isDuplicateHash,
  getExistingFilename,
  addAssetToIndex,
  removeAssetFromIndex,
  isIndexConsistent,
  sortAssetsByDate,
  findUnusedAssets
} from './assetLogic';

// Path Utils
export {
  toStoragePath,
  toOSPath,
  isRelativePath,
  isValidAssetPath,
  getAssetFilename,
  buildAssetPath
} from './pathUtils';

// Image Loader
export { loadImageAsBlob, revokeImageBlob, clearImageCache } from './imageLoader';
