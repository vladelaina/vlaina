import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { isAbsolutePath, normalizeAbsolutePath } from '@/lib/storage/adapter';

interface ExternalPathMutation {
  revision: number;
  path: string;
}

const MAX_EXTERNAL_PATH_MUTATIONS = 256;

let externalPathMutationRevision = 0;
const externalPathMutations: ExternalPathMutation[] = [];

function getPathComparisonKey(path: string): string {
  const normalizedPath = normalizeNotePathKey(path) ?? path;
  const resolvedPath = isAbsolutePath(normalizedPath)
    ? normalizeNotePathKey(normalizeAbsolutePath(normalizedPath)) ?? normalizedPath
    : normalizedPath;
  return /^[A-Za-z]:\//.test(resolvedPath) || resolvedPath.startsWith('//')
    ? resolvedPath.toLowerCase()
    : resolvedPath;
}

function isPathWithin(path: string, basePath: string): boolean {
  const pathKey = getPathComparisonKey(path);
  const basePathKey = getPathComparisonKey(basePath);
  const childPrefix = basePathKey.endsWith('/') ? basePathKey : `${basePathKey}/`;
  return pathKey === basePathKey || pathKey.startsWith(childPrefix);
}

function markExternalPathMutation(path: string): void {
  externalPathMutationRevision += 1;
  externalPathMutations.push({ revision: externalPathMutationRevision, path });
  if (externalPathMutations.length > MAX_EXTERNAL_PATH_MUTATIONS) {
    externalPathMutations.splice(0, externalPathMutations.length - MAX_EXTERNAL_PATH_MUTATIONS);
  }
}

export function getExternalPathMutationRevision(): number {
  return externalPathMutationRevision;
}

export function markExternalPathDeletion(path: string): void {
  markExternalPathMutation(path);
}

export function markExternalPathRename(oldPath: string): void {
  markExternalPathMutation(oldPath);
}

export function wasPathExternallyMutatedSince(path: string, revision: number): boolean {
  if (externalPathMutationRevision <= revision) {
    return false;
  }

  const firstTrackedRevision = externalPathMutations[0]?.revision;
  const historyMayHaveGap = firstTrackedRevision !== undefined && firstTrackedRevision > revision + 1;

  for (let index = externalPathMutations.length - 1; index >= 0; index -= 1) {
    const mutation = externalPathMutations[index];
    if (mutation.revision <= revision) {
      break;
    }
    if (isPathWithin(path, mutation.path)) {
      return true;
    }
  }

  return historyMayHaveGap;
}
