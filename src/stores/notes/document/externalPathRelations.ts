import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { isAbsolutePath } from '@/lib/storage/adapter';

function normalizeExternalAbsolutePath(path: string): string | null {
  const normalized = normalizeNotePathKey(path) ?? path;
  return isAbsolutePath(normalized) ? normalized : null;
}

export function getExternalPathComparisonKey(path: string): string {
  const normalized = normalizeExternalAbsolutePath(path);
  if (!normalized) {
    return path;
  }

  return /^[A-Za-z]:\//.test(normalized) || normalized.startsWith('//')
    ? normalized.toLowerCase()
    : normalized;
}

export function isSameExternalPath(path: string, otherPath: string): boolean {
  const normalizedPath = normalizeExternalAbsolutePath(path);
  const normalizedOtherPath = normalizeExternalAbsolutePath(otherPath);
  if (!normalizedPath || !normalizedOtherPath) {
    return path === otherPath;
  }

  return getExternalPathComparisonKey(normalizedPath) === getExternalPathComparisonKey(normalizedOtherPath);
}

export function getPathWithinSuffix(path: string, basePath: string): string | null {
  const normalizedPath = normalizeExternalAbsolutePath(path);
  const normalizedBasePath = normalizeExternalAbsolutePath(basePath);
  if (!normalizedPath || !normalizedBasePath) {
    if (path === basePath) {
      return '';
    }
    return path.startsWith(`${basePath}/`) ? path.slice(basePath.length) : null;
  }

  const pathKey = getExternalPathComparisonKey(normalizedPath);
  const basePathKey = getExternalPathComparisonKey(normalizedBasePath);
  if (pathKey === basePathKey) {
    return '';
  }

  const childPrefix = basePathKey.endsWith('/') ? basePathKey : `${basePathKey}/`;
  return pathKey.startsWith(childPrefix)
    ? normalizedPath.slice(normalizedBasePath.length)
    : null;
}

export function isPathWithin(path: string, basePath: string): boolean {
  return getPathWithinSuffix(path, basePath) != null;
}
