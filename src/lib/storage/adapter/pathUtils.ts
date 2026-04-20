function isTauriEnv(): boolean {
  if (typeof window === 'undefined') return false;
  return '__VL_ELECTRON__' in window || 'vlainaDesktop' in window;
}

export function getPathSeparator(path?: string): string {
  if (!path) return '/';
  
  if (/^[a-zA-Z]:[\\/]/.test(path)) return '\\';
  
  if (path.includes('\\')) return '\\';
  
  return '/';
}

export function normalizePath(path: string, forceForwardSlash = false): string {
  if (forceForwardSlash || !isTauriEnv()) {
    return path.replace(/\\/g, '/');
  }
  return path;
}

export function joinPath(...segments: string[]): string {
  const filtered = segments.filter(Boolean);
  if (filtered.length === 0) return '';
  
  const sep = isTauriEnv() ? getPathSeparator(filtered[0]) : '/';
  
  return filtered
    .map((segment, index) => {
      if (index > 0) {
        segment = segment.replace(/^[/\\]+/, '');
      }
      if (index < filtered.length - 1) {
        segment = segment.replace(/[/\\]+$/, '');
      }
      return segment;
    })
    .join(sep);
}

export function getParentPath(path: string): string | null {
  const normalized = normalizePath(path, true).replace(/\/+$/, '');
  if (!normalized || normalized === '/') {
    return null;
  }

  const lastSlashIndex = normalized.lastIndexOf('/');
  if (lastSlashIndex === -1) {
    return null;
  }

  let parent = normalized.slice(0, lastSlashIndex);
  if (!parent) {
    parent = '/';
  } else if (/^[a-zA-Z]:$/.test(parent)) {
    parent = `${parent}/`;
  }

  if (path.includes('\\')) {
    return parent.replace(/\//g, '\\');
  }

  return parent;
}

export function getBaseName(path: string): string {
  const normalized = normalizePath(path, true);
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

export function getExtension(path: string): string {
  const name = getBaseName(path);
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) return '';
  return name.slice(lastDot + 1);
}

export function isAbsolutePath(path: string): boolean {
  if (/^[a-zA-Z]:[\\/]/.test(path)) return true;
  if (path.startsWith('/')) return true;
  return false;
}

export function relativePath(from: string, to: string): string {
  const fromNorm = normalizePath(from, true).replace(/\/$/, '');
  const toNorm = normalizePath(to, true);
  
  if (toNorm.startsWith(fromNorm + '/')) {
    return toNorm.slice(fromNorm.length + 1);
  }
  
  return toNorm;
}
