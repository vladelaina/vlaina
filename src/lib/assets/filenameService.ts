/**
 * Filename Service
 * Handles filename sanitization, truncation, and conflict resolution
 */

// Characters that are dangerous/invalid in filenames across platforms
const DANGEROUS_CHARS = /[<>:"/\\|?*]/g;

// Maximum filename length (excluding extension)
const MAX_FILENAME_LENGTH = 200;

/**
 * Sanitize a filename by removing dangerous characters
 * Preserves Chinese characters, spaces, and other safe unicode
 */
export function sanitizeFilename(name: string): string {
  if (!name) return 'untitled';
  
  // Remove dangerous characters
  let sanitized = name.replace(DANGEROUS_CHARS, '');
  
  // Trim whitespace from start/end
  sanitized = sanitized.trim();
  
  // If nothing left, use default
  if (!sanitized) return 'untitled';
  
  return sanitized;
}

/**
 * Truncate filename to max length while preserving extension
 */
export function truncateFilename(name: string, maxLength: number = MAX_FILENAME_LENGTH): string {
  if (name.length <= maxLength) return name;
  
  const lastDot = name.lastIndexOf('.');
  
  // No extension
  if (lastDot === -1 || lastDot === 0) {
    return name.substring(0, maxLength);
  }
  
  const extension = name.substring(lastDot);
  const baseName = name.substring(0, lastDot);
  
  // If extension alone is too long, just truncate everything
  if (extension.length >= maxLength) {
    return name.substring(0, maxLength);
  }
  
  // Truncate base name to fit within limit
  const maxBaseLength = maxLength - extension.length;
  return baseName.substring(0, maxBaseLength) + extension;
}

/**
 * Resolve filename conflicts by appending numeric suffix
 * Handles case-insensitive comparison for cross-platform compatibility
 */
export function resolveFilenameConflict(
  name: string,
  existingNames: Set<string>
): string {
  // Create lowercase set for case-insensitive comparison
  const lowerExisting = new Set(
    Array.from(existingNames).map(n => n.toLowerCase())
  );
  
  // If no conflict, return as-is
  if (!lowerExisting.has(name.toLowerCase())) {
    return name;
  }
  
  const lastDot = name.lastIndexOf('.');
  let baseName: string;
  let extension: string;
  
  if (lastDot === -1 || lastDot === 0) {
    baseName = name;
    extension = '';
  } else {
    baseName = name.substring(0, lastDot);
    extension = name.substring(lastDot);
  }
  
  // Find next available number
  let counter = 1;
  let newName: string;
  
  do {
    newName = `${baseName}_${counter}${extension}`;
    counter++;
  } while (lowerExisting.has(newName.toLowerCase()));
  
  return newName;
}

/**
 * Process a filename through all steps: sanitize, truncate, resolve conflicts
 */
export function processFilename(
  originalName: string,
  existingNames: Set<string>,
  maxLength: number = MAX_FILENAME_LENGTH
): string {
  let name = sanitizeFilename(originalName);
  name = truncateFilename(name, maxLength);
  name = resolveFilenameConflict(name, existingNames);
  return name;
}

/**
 * Get MIME type from filename extension
 */
export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon',
    'avif': 'image/avif',
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Check if a filename represents an image
 */
export function isImageFilename(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
  return imageExtensions.includes(ext);
}
