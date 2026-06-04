import { hasElectronDesktopBridge } from '@/lib/desktop/backend';

function isElectronEnv(): boolean {
  return hasElectronDesktopBridge();
}

function getUncRoot(normalizedPath: string): string | null {
  if (!normalizedPath.startsWith('//') || normalizedPath.startsWith('///')) {
    return null;
  }

  const serverEnd = normalizedPath.indexOf('/', 2);
  if (serverEnd === -1) {
    return null;
  }

  const shareStart = serverEnd + 1;
  const shareEnd = normalizedPath.indexOf('/', shareStart);
  const share = shareEnd === -1
    ? normalizedPath.slice(shareStart)
    : normalizedPath.slice(shareStart, shareEnd);

  if (!share) {
    return null;
  }

  return shareEnd === -1 ? normalizedPath : normalizedPath.slice(0, shareEnd);
}

function appendPathParts(root: string, parts: string[]): string {
  if (parts.length === 0) {
    return root;
  }

  return `${root}${root.endsWith('/') ? '' : '/'}${parts.join('/')}`;
}

export function getPathSeparator(path?: string): string {
  if (!path) return '/';
  
  if (/^[a-zA-Z]:[\\/]/.test(path)) return '\\';
  
  if (path.includes('\\')) return '\\';
  
  return '/';
}

export function normalizePath(path: string, forceForwardSlash = false): string {
  if (forceForwardSlash || !isElectronEnv()) {
    return path.replace(/\\/g, '/');
  }
  return path;
}

export function normalizeAbsolutePath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const uncRoot = getUncRoot(normalized);
  const driveMatch = normalized.match(/^([a-zA-Z]:)(?:\/|$)/);
  const root = uncRoot ?? (driveMatch ? `${driveMatch[1]}/` : normalized.startsWith('/') ? '/' : '');
  if (!root) return path;

  const parts: string[] = [];
  const rest = normalized.slice(root.length).replace(/^\/+/, '');
  for (const part of rest.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      parts.pop();
      continue;
    }
    parts.push(part);
  }

  const nextPath = appendPathParts(root, parts);
  return path.includes('\\') ? nextPath.replace(/\//g, '\\') : nextPath;
}

export function joinPath(...segments: string[]): string {
  const filtered = segments.filter(Boolean);
  if (filtered.length === 0) return '';
  
  const sep = isElectronEnv() ? getPathSeparator(filtered[0]) : '/';
  
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

  const uncRoot = getUncRoot(normalized);
  if (uncRoot && normalized === uncRoot) {
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
  if (/^\\\\[^\\]+\\[^\\]+/.test(path)) return true;
  if (/^[a-zA-Z]:[\\/]/.test(path)) return true;
  if (path.startsWith('/')) return true;
  return false;
}

export function relativePath(from: string, to: string): string {
  const fromNorm = normalizePath(from, true).replace(/\/$/, '');
  const toNorm = normalizePath(to, true);

  if (toNorm === fromNorm) {
    return '';
  }

  if (fromNorm === '') {
    return toNorm.replace(/^\/+/, '');
  }

  if (toNorm.startsWith(fromNorm + '/')) {
    return toNorm.slice(fromNorm.length + 1);
  }
  
  return toNorm;
}
