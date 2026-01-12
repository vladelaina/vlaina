/**
 * Asset Library - Centralized asset management
 * 
 * This module provides:
 * - Safe filename handling with sanitization and conflict resolution
 * - Atomic file writes for crash safety
 * - Cross-platform path handling
 * - Image loading with blob URL caching
 */

// Types
export type { AssetEntry, UploadResult } from './types';

// Hash Service (kept for potential future use)
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
  sortAssetsByDate,
} from './assetLogic';

// Path Utils
export {
  toStoragePath,
  toOSPath,
  isRelativePath,
  isValidAssetFilename,
  buildAssetPath
} from './pathUtils';

// Image Loader
export { loadImageAsBlob, revokeImageBlob, clearImageCache } from './imageLoader';
