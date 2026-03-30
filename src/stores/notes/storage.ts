import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import {
  RECENT_NOTES_KEY,
  MAX_RECENT_NOTES,
  APP_CONFIG_FOLDER,
  STORE_FOLDER,
  METADATA_FILE,
  WORKSPACE_FILE,
} from './constants';
import type { FileTreeSortMode, MetadataFile, NoteMetadataEntry } from './types';

export type { MetadataFile, NoteMetadataEntry };

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

const CURRENT_METADATA_VERSION = 1;

export async function loadNoteMetadata(vaultPath: string): Promise<MetadataFile> {
  try {
    const storage = getStorageAdapter();
    const storePath = await joinPath(vaultPath, APP_CONFIG_FOLDER, STORE_FOLDER);
    const metadataPath = await joinPath(storePath, METADATA_FILE);

    if (await storage.exists(metadataPath)) {
      const content = await storage.readFile(metadataPath);
      const data = JSON.parse(content) as MetadataFile;
      return data;
    }

    return { version: CURRENT_METADATA_VERSION, notes: {} };
  } catch (error) {
    console.error('[NotesStorage] Failed to load note metadata:', error);
    return { version: CURRENT_METADATA_VERSION, notes: {} };
  }
}

export async function saveNoteMetadataOrThrow(vaultPath: string, metadata: MetadataFile): Promise<void> {
  const storage = getStorageAdapter();
  const storePath = await joinPath(vaultPath, APP_CONFIG_FOLDER, STORE_FOLDER);

  if (!(await storage.exists(storePath))) {
    await storage.mkdir(storePath, true);
  }

  const metadataPath = await joinPath(storePath, METADATA_FILE);
  await safeWriteTextFile(metadataPath, JSON.stringify(metadata, null, 2));
}

export async function saveNoteMetadata(vaultPath: string, metadata: MetadataFile): Promise<void> {
  try {
    await saveNoteMetadataOrThrow(vaultPath, metadata);
  } catch (error) {
    console.error('[NotesStorage] Failed to save note metadata:', error);
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
  const updated = { ...existing, ...updates };

  if (updated.icon === null || updated.icon === undefined) delete updated.icon;
  if (updated.cover === null || updated.cover === undefined) {
    delete updated.cover;
    delete updated.coverX;
    delete updated.coverY;
    delete updated.coverH;
    delete updated.coverScale;
  }

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
    const wsPath = await joinPath(vaultPath, APP_CONFIG_FOLDER, STORE_FOLDER, WORKSPACE_FILE);

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
    const storage = getStorageAdapter();
    const storePath = await joinPath(vaultPath, APP_CONFIG_FOLDER, STORE_FOLDER);

    if (!(await storage.exists(storePath))) {
      await storage.mkdir(storePath, true);
    }

    const wsPath = await joinPath(storePath, WORKSPACE_FILE);
    await safeWriteTextFile(wsPath, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('[NotesStorage] Failed to save workspace state:', error);
  }
}
