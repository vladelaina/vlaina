import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import {
  RECENT_NOTES_KEY,
  NOTE_ICON_SIZE_KEY,
  MAX_RECENT_NOTES,
  WORKSPACE_FILE,
} from './constants';
import type { FileTreeSortMode, MetadataFile, NoteCoverMetadata, NoteMetadataEntry } from './types';
import { normalizeNoteMetadataEntry, readNoteMetadataFromMarkdown } from './frontmatter';
import { ensureSystemDirectory, getVaultSystemStorePath } from './systemStoragePaths';

export type { MetadataFile, NoteMetadataEntry };

const CURRENT_METADATA_VERSION = 2;
const DEFAULT_NOTE_ICON_SIZE = 60;

export function loadRecentNotes(): string[] {
  try {
    const saved = localStorage.getItem(RECENT_NOTES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    console.error('[NotesStorage] Failed to load recent notes from localStorage');
    return [];
  }
}

function saveRecentNotes(paths: string[]): void {
  try {
    localStorage.setItem(RECENT_NOTES_KEY, JSON.stringify(paths));
  } catch (error) {
    console.error('[NotesStorage] Failed to save recent notes to localStorage:', error);
  }
}

export function persistRecentNotes(paths: string[]): void {
  saveRecentNotes(paths);
}

export function loadGlobalNoteIconSize(): number {
  try {
    const saved = localStorage.getItem(NOTE_ICON_SIZE_KEY);
    const parsed = saved ? Number(saved) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_NOTE_ICON_SIZE;
  } catch {
    console.error('[NotesStorage] Failed to load note icon size from localStorage');
    return DEFAULT_NOTE_ICON_SIZE;
  }
}

export function persistGlobalNoteIconSize(size: number): number {
  const normalized = Number.isFinite(size) && size > 0 ? size : DEFAULT_NOTE_ICON_SIZE;

  try {
    localStorage.setItem(NOTE_ICON_SIZE_KEY, String(normalized));
  } catch (error) {
    console.error('[NotesStorage] Failed to save note icon size to localStorage:', error);
  }

  return normalized;
}

export function addToRecentNotes(path: string, current: string[]): string[] {
  const filtered = current.filter(p => p !== path);
  const updated = [path, ...filtered].slice(0, MAX_RECENT_NOTES);
  saveRecentNotes(updated);
  return updated;
}

export async function safeWriteTextFile(path: string, content: string): Promise<void> {
  const storage = getStorageAdapter();

  await storage.writeFile(path, content);
}

function normalizeCover(cover: NoteCoverMetadata | null | undefined): NoteCoverMetadata | undefined {
  if (!cover?.assetPath) {
    return undefined;
  }

  const normalized: NoteCoverMetadata = {
    assetPath: cover.assetPath,
  };

  if (cover.positionX !== undefined) normalized.positionX = cover.positionX;
  if (cover.positionY !== undefined) normalized.positionY = cover.positionY;
  if (cover.height !== undefined) normalized.height = cover.height;
  if (cover.scale !== undefined) normalized.scale = cover.scale;

  return normalized;
}

function normalizeLoadedEntry(
  entry: Partial<NoteMetadataEntry> | null | undefined
): NoteMetadataEntry {
  return normalizeNoteMetadataEntry({
    ...entry,
    cover: normalizeCover(entry?.cover),
  });
}

export function createEmptyMetadataFile(): MetadataFile {
  return { version: CURRENT_METADATA_VERSION, notes: {} };
}

async function collectMarkdownPaths(
  basePath: string,
  relativePath: string = ''
): Promise<string[]> {
  const storage = getStorageAdapter();
  const currentPath = relativePath ? await joinPath(basePath, relativePath) : basePath;
  const entries = await storage.listDir(currentPath);
  const collected: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory === true) {
      collected.push(...await collectMarkdownPaths(basePath, entryPath));
      continue;
    }

    if (entry.isFile === true && entry.name.toLowerCase().endsWith('.md')) {
      collected.push(entryPath);
    }
  }

  return collected;
}

export async function loadNoteMetadata(vaultPath: string): Promise<MetadataFile> {
  try {
    const storage = getStorageAdapter();
    const notePaths = await collectMarkdownPaths(vaultPath);
    const notes: MetadataFile['notes'] = {};

    const BATCH_SIZE = 10;
    for (let index = 0; index < notePaths.length; index += BATCH_SIZE) {
      const batch = notePaths.slice(index, index + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (relativePath) => {
          const fullPath = await joinPath(vaultPath, relativePath);
          const content = await storage.readFile(fullPath);
          return {
            relativePath,
            metadata: normalizeLoadedEntry(readNoteMetadataFromMarkdown(content)),
          };
        })
      );

      for (const result of results) {
        if (result.status !== 'fulfilled') {
          continue;
        }

        const { relativePath, metadata } = result.value;
        if (Object.keys(metadata).length > 0) {
          notes[relativePath] = metadata;
        }
      }
    }

    return {
      version: CURRENT_METADATA_VERSION,
      notes,
    };
  } catch (error) {
    console.error('[NotesStorage] Failed to load note metadata:', error);
    return createEmptyMetadataFile();
  }
}

export function getNoteEntry(metadata: MetadataFile, path: string): NoteMetadataEntry {
  return metadata.notes[path] || {};
}

export function setNoteEntry(
  metadata: MetadataFile,
  path: string,
  updates: Partial<NoteMetadataEntry>
): MetadataFile {
  const existing = metadata.notes[path] || {};
  const updated = normalizeLoadedEntry({
    ...existing,
    ...updates,
    cover: 'cover' in updates ? updates.cover : existing.cover,
  });

  if (Object.keys(updated).length === 0) {
    const { [path]: _, ...rest } = metadata.notes;
    return { ...metadata, notes: rest };
  }

  return {
    ...metadata,
    notes: { ...metadata.notes, [path]: updated },
  };
}

export function remapMetadataEntries(
  metadata: MetadataFile | null,
  remapPath: (path: string) => string | null
): MetadataFile | null {
  if (!metadata) {
    return metadata;
  }

  let changed = false;
  const nextNotes: MetadataFile['notes'] = {};

  for (const [path, entry] of Object.entries(metadata.notes)) {
    const nextPath = remapPath(path);
    if (nextPath == null) {
      changed = true;
      continue;
    }
    if (nextPath !== path) {
      changed = true;
    }
    nextNotes[nextPath] = entry;
  }

  if (!changed) {
    return metadata;
  }

  return {
    ...metadata,
    notes: nextNotes,
  };
}

let currentVaultPath: string | null = null;

export function setCurrentVaultPath(path: string | null): void {
  currentVaultPath = path;
}

export function getCurrentVaultPath(): string | null {
  return currentVaultPath;
}

export async function getNotesBasePath(): Promise<string> {
  if (!currentVaultPath) {
    throw new Error('No vault selected');
  }
  return currentVaultPath;
}

export async function ensureNotesFolder(basePath: string): Promise<void> {
  const storage = getStorageAdapter();

  if (!(await storage.exists(basePath))) {
    await storage.mkdir(basePath, true);
  }
}

export interface WorkspaceState {
  currentNotePath: string | null;
  expandedFolders: string[];
  fileTreeSortMode?: FileTreeSortMode;
}

export async function loadWorkspaceState(vaultPath: string): Promise<WorkspaceState | null> {
  try {
    const storage = getStorageAdapter();
    const wsPath = await getVaultSystemStorePath(vaultPath, WORKSPACE_FILE);

    if (!(await storage.exists(wsPath))) {
      return null;
    }

    const content = await storage.readFile(wsPath);
    return JSON.parse(content);
  } catch (error) {
    console.error('[NotesStorage] Failed to load workspace state:', error);
    return null;
  }
}

export async function saveWorkspaceState(vaultPath: string, state: WorkspaceState): Promise<void> {
  try {
    const storePath = await getVaultSystemStorePath(vaultPath);
    await ensureSystemDirectory(storePath);

    const wsPath = await joinPath(storePath, WORKSPACE_FILE);
    await safeWriteTextFile(wsPath, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('[NotesStorage] Failed to save workspace state:', error);
  }
}
