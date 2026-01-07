/** Notes Store - Note utility functions */

/**
 * Extract first H1 title from markdown content
 */
export function extractFirstH1(content: string): string | null {
  const firstLineEnd = content.indexOf('\n');
  const firstLine = firstLineEnd === -1 ? content : content.substring(0, firstLineEnd);
  
  const match = firstLine.match(/^#\s+(.+)$/);
  if (match && match[1]) {
    let title = match[1].trim();
    if (title === 'Title' || title === '') {
      return null;
    }
    // Remove Windows-invalid filename characters
    title = title.replace(/[<>:"/\\|?*]/g, '');
    title = title.trim();
    return title || null;
  }
  return null;
}

/**
 * Sanitize filename for Windows compatibility
 */
export function sanitizeFileName(name: string): string {
  let sanitized = name.replace(/[<>:"/\\|?*]/g, '');
  sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');
  return sanitized || 'Untitled';
}
