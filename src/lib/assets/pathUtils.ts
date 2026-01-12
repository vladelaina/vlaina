/**
 * Path Utilities for Asset Library
 * Cross-platform path handling
 */

/**
 * Convert path to storage format (forward slashes)
 * Used when storing paths in index.json or note references
 */
export function toStoragePath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Convert storage path to OS-native format
 * @param path - Path with forward slashes
 * @param separator - OS path separator ('/' or '\\')
 */
export function toOSPath(path: string, separator: string): string {
  if (separator === '/') {
    return path;
  }
  return path.replace(/\//g, separator);
}

/**
 * Check if a path is relative (no absolute prefix)
 */
export function isRelativePath(path: string): boolean {
  // Check for Windows absolute paths (C:\, D:\, etc.)
  if (/^[A-Za-z]:[\\/]/.test(path)) {
    return false;
  }
  
  // Check for Unix absolute paths
  if (path.startsWith('/')) {
    return false;
  }
  
  // Check for UNC paths (\\server\share)
  if (path.startsWith('\\\\')) {
    return false;
  }
  
  return true;
}

/**
 * Validate asset filename format
 * Must be a simple filename without path separators
 */
export function isValidAssetFilename(filename: string): boolean {
  // No path separators allowed
  if (filename.includes('/') || filename.includes('\\')) {
    return false;
  }
  // Must have an extension
  if (!filename.includes('.')) {
    return false;
  }
  return true;
}

/**
 * Build full asset path from filename
 */
export function buildAssetPath(filename: string): string {
  return `.nekotick/assets/covers/${filename}`;
}
