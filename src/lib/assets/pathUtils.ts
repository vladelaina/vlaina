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
  // If filename starts with icons/, it goes to assets/icons
  if (filename.startsWith('icons/')) {
    // Remove prefix for actual storage path construction if needed, 
    // BUT here we want the full relative path from .nekotick root?
    // Actually this function seems to return path relative to vault root including .nekotick
    return `.nekotick/assets/${filename}`;
  }
  // Default legacy behavior: everything else is a cover
  return `.nekotick/assets/covers/${filename}`;
}

/**
 * Build full absolute path to an asset file
 * @param vaultPath - The vault root path
 * @param assetFilename - The asset filename (may include subdirectory)
 * @returns Full absolute path to the asset
 */
export function buildFullAssetPath(vaultPath: string, assetFilename: string): string {
  const sep = vaultPath.includes('\\') ? '\\' : '/';

  // Normalize filename checks
  const isIcon = assetFilename.startsWith('icons/') || assetFilename.startsWith('icons\\');
  const normalizedFilename = assetFilename.replace(/\//g, sep); // Ensure OS separators

  if (isIcon) {
    // It's in .nekotick/assets/icons/filename (filename already includes icons/ prefix?)
    // Wait, if assetFilename is "icons/foo.png", handling separators:
    // "icons\foo.png".
    // We want .nekotick\assets\icons\foo.png ... wait.
    // If we append "icons\foo.png" to ".nekotick\assets", it works.
    // But existing logic was ".nekotick\assets\covers" + filename.
    // So we need to conditionally choose the parent dir.

    // Actually, if filename already includes "icons/", we can just use .nekotick/assets/ + filename.
    return `${vaultPath}${sep}.nekotick${sep}assets${sep}${normalizedFilename}`;
  }

  // Legacy/Default: Covers
  return `${vaultPath}${sep}.nekotick${sep}assets${sep}covers${sep}${normalizedFilename}`;
}
