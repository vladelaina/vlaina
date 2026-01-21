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

/**
 * Generate a filename based on the specified format
 * @param originalName - Original filename
 * @param format - Format: 'original', 'timestamp', or 'sequence'
 * @param existingNames - Set of existing filenames for conflict resolution
 * @returns Processed filename
 */
export function generateFilename(
  originalName: string,
  format: 'original' | 'timestamp' | 'sequence',
  existingNames: Set<string>
): string {
  // Get extension from original name
  const lastDot = originalName.lastIndexOf('.');
  const extension = lastDot > 0 ? originalName.substring(lastDot).toLowerCase() : '.png';

  let baseName: string;

  switch (format) {
    case 'original':
      // Keep original, just sanitize
      return processFilename(originalName, existingNames);

    case 'timestamp':
      // Generate timestamp-based name: YYYY-MM-DD_HH-MM-SS
      const now = new Date();
      const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      baseName = `${date}_${hours}-${minutes}-${seconds}`;
      break;

    case 'sequence':
      // Generate sequence-based name: 1.png, 2.png, etc.
      let counter = 1;
      const lowerExisting = new Set(
        Array.from(existingNames).map(n => n.toLowerCase())
      );

      do {
        baseName = counter.toString();
        counter++;
      } while (lowerExisting.has((baseName + extension).toLowerCase()));

      return baseName + extension;


    default:
      return processFilename(originalName, existingNames);
  }

  const newName = baseName + extension;
  return resolveFilenameConflict(newName, existingNames);
}
