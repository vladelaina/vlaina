/**
 * Asset Library Types
 * Types for the centralized asset management system
 */

/** Single asset entry in the index */
export interface AssetEntry {
  /** Original or conflict-resolved filename */
  filename: string;
  /** SHA-256 hash (first 16 hex chars) for deduplication */
  hash: string;
  /** File size in bytes */
  size: number;
  /** MIME type (e.g., "image/jpeg") */
  mimeType: string;
  /** ISO timestamp of upload */
  uploadedAt: string;
}

/** Asset index stored in .nekotick/store/covers.json */
export interface AssetIndex {
  /** Schema version for future migrations */
  version: 1;
  /** Map of filename -> AssetEntry */
  assets: Record<string, AssetEntry>;
  /** Map of hash -> filename for O(1) duplicate lookup */
  hashMap: Record<string, string>;
}

/** Result of an upload operation */
export interface UploadResult {
  /** Whether the upload succeeded */
  success: boolean;
  /** Asset filename (e.g., "photo.jpg") */
  path: string | null;
  /** Whether this was a duplicate (reused existing file) */
  isDuplicate: boolean;
  /** If duplicate, the existing filename */
  existingFilename?: string;
  /** Error message if failed */
  error?: string;
}

/** Default empty index */
export const createEmptyIndex = (): AssetIndex => ({
  version: 1,
  assets: {},
  hashMap: {},
});
