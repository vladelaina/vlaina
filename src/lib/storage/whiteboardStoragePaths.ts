import { getStorageAdapter, joinPath, type StorageAdapter } from '@/lib/storage/adapter';
import { getStorageBasePath } from '@/lib/storage/basePath';
import { getNotesRootStorageKey } from '@/lib/storage/notesRootStorageKey';

const SYSTEM_DIR = '.vlaina';
const WHITEBOARDS_DIR = 'whiteboards';
const NOTES_ROOTS_DIR = 'notes-roots';
export const WHITEBOARD_SYSTEM_STORAGE_SCOPE = 'system-default';

export async function getWhiteboardNotesRootsPath(): Promise<string> {
  return joinPath(await getStorageBasePath(), SYSTEM_DIR, WHITEBOARDS_DIR, NOTES_ROOTS_DIR);
}

export async function getWhiteboardNotesRootPath(notesRootPath: string): Promise<string> {
  return joinPath(await getWhiteboardNotesRootsPath(), getNotesRootStorageKey(notesRootPath));
}

export async function moveWhiteboardNotesRootStore(
  previousNotesRootPath: string,
  nextNotesRootPath: string,
): Promise<void> {
  try {
    const storage = getStorageAdapter();
    const previousPath = await getWhiteboardNotesRootPath(previousNotesRootPath);
    const nextPath = await getWhiteboardNotesRootPath(nextNotesRootPath);
    if (previousPath === nextPath || !await storage.exists(previousPath) || await storage.exists(nextPath)) return;
    await ensureDirectory(await getWhiteboardNotesRootsPath());
    await moveDirectorySafely(storage, previousPath, nextPath);
  } catch {
  }
}

async function ensureDirectory(path: string): Promise<void> {
  const storage = getStorageAdapter();
  if (!await storage.exists(path)) await storage.mkdir(path, true);
}

async function moveDirectorySafely(storage: StorageAdapter, source: string, destination: string): Promise<void> {
  try {
    await storage.rename(source, destination);
    return;
  } catch {
  }
  try {
    await copyDirectory(storage, source, destination);
  } catch (error) {
    await storage.deleteDir(destination, true).catch(() => undefined);
    throw error;
  }
  await storage.deleteDir(source, true);
}

async function copyDirectory(storage: StorageAdapter, source: string, destination: string): Promise<void> {
  await storage.mkdir(destination, true);
  const entries = await storage.listDir(source);
  for (const entry of entries) {
    const target = await joinPath(destination, entry.name);
    if (entry.isDirectory) {
      await copyDirectory(storage, entry.path, target);
    } else if (entry.isFile) {
      await storage.copyFile(entry.path, target);
    }
  }
}
