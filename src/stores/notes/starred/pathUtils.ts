import { normalizeNotePathKey } from '@/lib/notes/displayName';

export function normalizeStarredVaultPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized || path;
}

export function normalizeStarredRelativePath(path: string): string | null {
  const normalized = normalizeNotePathKey(path);
  return normalized && normalized !== '/' ? normalized : null;
}
