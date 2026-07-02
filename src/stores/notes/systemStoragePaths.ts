import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { getPaths } from '@/lib/storage/paths';

function hashNotesRootPath(path: string): string {
  let hash = 2166136261;
  for (let index = 0; index < path.length; index += 1) {
    hash ^= path.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function getNotesRootStorageKey(notesRootPath: string): string {
  const normalized = normalizeNotePathKey(notesRootPath) ?? notesRootPath.replace(/\\/g, '/');
  return `notes-root-${hashNotesRootPath(normalized)}`;
}

export async function getNotesSystemStorePath(...segments: string[]): Promise<string> {
  const { notes } = await getPaths();
  return joinPath(notes, ...segments);
}

export async function getNotesRootSystemStorePath(
  notesRootPath: string,
  ...segments: string[]
): Promise<string> {
  return getNotesSystemStorePath('notes-roots', getNotesRootStorageKey(notesRootPath), ...segments);
}

export async function ensureSystemDirectory(path: string): Promise<void> {
  const storage = getStorageAdapter();
  if (!(await storage.exists(path))) {
    await storage.mkdir(path, true);
  }
}

export async function moveNotesRootSystemStore(
  previousNotesRootPath: string,
  nextNotesRootPath: string
): Promise<void> {
  try {
    const storage = getStorageAdapter();
    const previousPath = await getNotesRootSystemStorePath(previousNotesRootPath);
    const nextPath = await getNotesRootSystemStorePath(nextNotesRootPath);

    if (
      previousPath === nextPath ||
      !(await storage.exists(previousPath)) ||
      await storage.exists(nextPath)
    ) {
      return;
    }

    await ensureSystemDirectory(await getNotesSystemStorePath('notes-roots'));
    await storage.rename(previousPath, nextPath);
  } catch (error) {
  }
}
