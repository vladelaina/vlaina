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
 * Validate asset path format
 * Must be relative and start with .nekotick/assets/covers/
 */
export function isValidAssetPath(path: string): boolean {
  if (!isRelativePath(path)) {
    return false;
  }
  
  const normalized = toStoragePath(path);
  return normalized.startsWith('.nekotick/assets/covers/');
}

/**
 * Extract filename from asset path
 */
export function getAssetFilename(path: string): string {
  const normalized = toStoragePath(path);
  const parts = normalized.split('/');
  return parts[parts.length - 1];
}

/**
 * Build asset path from filename
 */
export function buildAssetPath(filename: string): string {
  return `.nekotick/assets/covers/${filename}`;
}
