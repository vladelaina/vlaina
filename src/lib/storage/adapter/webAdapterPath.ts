export function normalizeWebAdapterPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts: string[] = [];

  for (const part of normalized.split('/')) {
    if (!part || part === '.') {
      continue;
    }
    if (part === '..') {
      if (parts.length > 0) {
        parts.pop();
      } else if (!normalized.startsWith('/')) {
        throw new Error(`Path escapes storage root: ${path}`);
      }
      continue;
    }
    parts.push(part);
  }

  return parts.length > 0 ? `/${parts.join('/')}` : '/';
}

export function getWebAdapterParentDir(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 1) return null;
  parts.pop();
  return '/' + parts.join('/');
}

export function getWebAdapterPathBaseName(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? '';
}
