/** Notes Store - Note utility functions */

/**
 * Sanitize filename for Windows compatibility
 */
export function sanitizeFileName(name: string): string {
  let sanitized = name.replace(/[<>:"/\\|?*]/g, '');
  sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');
  return sanitized || 'Untitled';
}
