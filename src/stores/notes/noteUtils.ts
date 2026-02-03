export function sanitizeFileName(name: string): string {
  let sanitized = name.replace(/[<>:"/\\|?*]/g, '');
  sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');
  return sanitized || 'Untitled';
}
