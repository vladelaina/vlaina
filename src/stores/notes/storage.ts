/**
 * Notes Store - Storage utilities
 * 
 * Provides cross-platform storage operations using the StorageAdapter
 * Works on both Tauri (native file system) and Web (IndexedDB)
 */

import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import {
  RECENT_NOTES_KEY,
  MAX_RECENT_NOTES,
  NEKOTICK_CONFIG_FOLDER,
  METADATA_FILE,
  ICONS_FILE,
  WORKSPACE_FILE,
  FAVORITES_FILE,
} from './constants';
import type { MetadataFile, NoteMetadataEntry } from './types';

// Re-export for convenience
export type { MetadataFile, NoteMetadataEntry };

// ============ localStorage utilities ============

export function loadRecentNotes(): string[] {
  try {
    const saved = localStorage.getItem(RECENT_NOTES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveRecentNotes(paths: string[]): void {
  try {
    localStorage.setItem(RECENT_NOTES_KEY, JSON.stringify(paths));
  } catch { /* ignore */ }
}

export function addToRecentNotes(path: string, current: string[]): string[] {
  const filtered = current.filter(p => p !== path);
  const updated = [path, ...filtered].slice(0, MAX_RECENT_NOTES);
  saveRecentNotes(updated);
  return updated;
}

// ============ File-based storage utilities ============

/**
 * Atomic write helper: writes to temp file then renames to target.
 * Prevents data corruption on crash or partial write.
 */
export async function safeWriteTextFile(path: string, content: string): Promise<void> {
  const storage = getStorageAdapter();

  // On web, atomic write is handled internally by IndexedDB transactions
  // On Tauri, TauriAdapter.writeFile already implements atomic write
  await storage.writeFile(path, content);
}

// ============ Unified Metadata System ============

const CURRENT_METADATA_VERSION = 1;

/**
 * Load unified metadata from .nekotick/metadata.json
 * Includes automatic migration from legacy icons.json
 */
export async function loadNoteMetadata(vaultPath: string): Promise<MetadataFile> {
  try {
    const storage = getStorageAdapter();
    const metadataPath = await joinPath(vaultPath, NEKOTICK_CONFIG_FOLDER, METADATA_FILE);

    // Check if new metadata.json exists
    if (await storage.exists(metadataPath)) {
      const content = await storage.readFile(metadataPath);
      const data = JSON.parse(content) as MetadataFile;
      return data;
    }

    // Migration: check for legacy icons.json
    const legacyIconsPath = await joinPath(vaultPath, NEKOTICK_CONFIG_FOLDER, ICONS_FILE);
    if (await storage.exists(legacyIconsPath)) {
      const content = await storage.readFile(legacyIconsPath);
      const legacyIcons = JSON.parse(content) as Record<string, string>;

      // Convert legacy format to new format
      const notes: Record<string, NoteMetadataEntry> = {};
      Object.entries(legacyIcons).forEach(([path, icon]) => {
        notes[path] = { icon };
      });

      const migrated: MetadataFile = {
        version: CURRENT_METADATA_VERSION,
        notes,
      };

      // Save migrated data
      await saveNoteMetadata(vaultPath, migrated);
      return migrated;
    }

    // No existing data
    return { version: CURRENT_METADATA_VERSION, notes: {} };
  } catch {
    return { version: CURRENT_METADATA_VERSION, notes: {} };
  }
}

/**
 * Save unified metadata to .nekotick/metadata.json
 */
export async function saveNoteMetadata(vaultPath: string, metadata: MetadataFile): Promise<void> {
  try {
    const storage = getStorageAdapter();
    const configPath = await joinPath(vaultPath, NEKOTICK_CONFIG_FOLDER);

    if (!(await storage.exists(configPath))) {
      await storage.mkdir(configPath, true);
    }

    const metadataPath = await joinPath(configPath, METADATA_FILE);
    await safeWriteTextFile(metadataPath, JSON.stringify(metadata, null, 2));
  } catch { /* ignore */ }
}

/**
 * Helper: Get metadata for a specific note
 */
export function getNoteEntry(metadata: MetadataFile, path: string): NoteMetadataEntry {
  return metadata.notes[path] || {};
}

/**
 * Helper: Update metadata for a specific note
 */
export function setNoteEntry(
  metadata: MetadataFile,
  path: string,
  updates: Partial<NoteMetadataEntry>
): MetadataFile {
  const existing = metadata.notes[path] || {};
  const updated = { ...existing, ...updates };

  // Clean up undefined/null values
  if (updated.icon === null || updated.icon === undefined) delete updated.icon;
  if (updated.cover === null || updated.cover === undefined) {
    delete updated.cover;
    delete updated.coverY;
  }

  // Remove entry if empty
  if (Object.keys(updated).length === 0) {
    const { [path]: _, ...rest } = metadata.notes;
    return { ...metadata, notes: rest };
  }

  return {
    ...metadata,
    notes: { ...metadata.notes, [path]: updated },
  };
}


// ============ Vault path management ============

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

// ============ Workspace state persistence ============

export interface WorkspaceState {
  currentNotePath: string | null;
  expandedFolders: string[];
}

/**
 * Load workspace state from .nekotick/workspace.json
 */
export async function loadWorkspaceState(vaultPath: string): Promise<WorkspaceState | null> {
  try {
    const storage = getStorageAdapter();
    const wsPath = await joinPath(vaultPath, NEKOTICK_CONFIG_FOLDER, WORKSPACE_FILE);

    if (!(await storage.exists(wsPath))) {
      return null;
    }

    const content = await storage.readFile(wsPath);
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Save workspace state to .nekotick/workspace.json
 */
export async function saveWorkspaceState(vaultPath: string, state: WorkspaceState): Promise<void> {
  try {
    const storage = getStorageAdapter();
    const configPath = await joinPath(vaultPath, NEKOTICK_CONFIG_FOLDER);

    if (!(await storage.exists(configPath))) {
      await storage.mkdir(configPath, true);
    }

    const wsPath = await joinPath(configPath, WORKSPACE_FILE);
    await safeWriteTextFile(wsPath, JSON.stringify(state, null, 2));
  } catch { /* ignore */ }
}

// ============ Favorites persistence ============

export interface FavoritesData {
  notes: string[];
  folders: string[];
}

/**
 * Load favorites from .nekotick/favorites.json
 */
export async function loadFavoritesFromFile(vaultPath: string): Promise<FavoritesData> {
  try {
    const storage = getStorageAdapter();
    const favPath = await joinPath(vaultPath, NEKOTICK_CONFIG_FOLDER, FAVORITES_FILE);

    if (!(await storage.exists(favPath))) {
      return { notes: [], folders: [] };
    }

    const content = await storage.readFile(favPath);
    const data = JSON.parse(content);
    return {
      notes: Array.isArray(data.notes) ? data.notes : [],
      folders: Array.isArray(data.folders) ? data.folders : [],
    };
  } catch {
    return { notes: [], folders: [] };
  }
}

/**
 * Save favorites to .nekotick/favorites.json
 */
export async function saveFavoritesToFile(vaultPath: string, favorites: FavoritesData): Promise<void> {
  try {
    const storage = getStorageAdapter();
    const configPath = await joinPath(vaultPath, NEKOTICK_CONFIG_FOLDER);

    if (!(await storage.exists(configPath))) {
      await storage.mkdir(configPath, true);
    }

    const favPath = await joinPath(configPath, FAVORITES_FILE);
    await safeWriteTextFile(favPath, JSON.stringify(favorites, null, 2));
  } catch { /* ignore */ }
}
