/**
 * Asset Library Types
 * Types for the centralized asset management system
 */

/** Single asset entry */
export interface AssetEntry {
  /** Filename */
  filename: string;
  /** SHA-256 hash (unused in simplified version) */
  hash: string;
  /** File size in bytes */
  size: number;
  /** MIME type (e.g., "image/jpeg") */
  mimeType: string;
  /** ISO timestamp */
  uploadedAt: string;
}

/** Result of an upload operation */
export interface UploadResult {
  /** Whether the upload succeeded */
  success: boolean;
  /** Asset filename (e.g., "photo.jpg") */
  path: string | null;
  /** Whether this was a duplicate */
  isDuplicate: boolean;
  /** If duplicate, the existing filename */
  existingFilename?: string;
  /** Error message if failed */
  error?: string;
}
