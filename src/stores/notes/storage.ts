/** Notes Store - Storage utilities for localStorage and file-based storage */

// Removed duplicate import
import { join } from '@tauri-apps/api/path';
import {
  RECENT_NOTES_KEY,
  MAX_RECENT_NOTES,
  NEKOTICK_CONFIG_FOLDER,
  ICONS_FILE,
  WORKSPACE_FILE,
  FAVORITES_FILE,
} from './constants';

// ============ File-based storage utilities ============
import { readTextFile, writeTextFile, mkdir, exists, rename, remove } from '@tauri-apps/plugin-fs'; // Add rename/remove

/**
 * Atomic write helper: writes to temp file then renames to target.
 * Prevents data corruption on crash or partial write.
 */
export async function safeWriteTextFile(path: string, content: string): Promise<void> {
  const tempPath = `${path}.tmp`;
  try {
    await writeTextFile(tempPath, content);
    // On Windows, rename might fail if target exists, but Tauri/Rust std::fs::rename usually handles replace.
    // However, for maximum safety, we try rename first.
    try {
      await rename(tempPath, path);
    } catch (e) {
      // If rename fails (e.g. locked), try removing target then rename
      // But removing target first is risky if rename fails after.
      // Let's assume standard rename overwrite works for now as it's atomic-ish.
      // If it throws, we might need a specific delete-then-rename flow but that breaks atomicity.
      // Re-throwing to be safe.
      throw e;
    }
  } catch (error) {
    // Cleanup temp file if something went wrong
    try { await remove(tempPath); } catch { }
    throw error;
  }
}

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
 * Load icons from .nekotick/icons.json
 */
export async function loadNoteIconsFromFile(vaultPath: string): Promise<Map<string, string>> {
  try {
    const iconsPath = await join(vaultPath, NEKOTICK_CONFIG_FOLDER, ICONS_FILE);
    const fileExists = await exists(iconsPath);
    if (!fileExists) return new Map();

    const content = await readTextFile(iconsPath);
    const obj = JSON.parse(content);
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

/**
 * Save icons to .nekotick/icons.json
 */
export async function saveNoteIconsToFile(vaultPath: string, icons: Map<string, string>): Promise<void> {
  try {
    const configPath = await join(vaultPath, NEKOTICK_CONFIG_FOLDER);
    const configExists = await exists(configPath);
    if (!configExists) {
      await mkdir(configPath, { recursive: true });
    }

    const iconsPath = await join(configPath, ICONS_FILE);
    const obj = Object.fromEntries(icons);
    await safeWriteTextFile(iconsPath, JSON.stringify(obj, null, 2));
  } catch { /* ignore */ }
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
  const folderExists = await exists(basePath);
  if (!folderExists) {
    await mkdir(basePath, { recursive: true });
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
    const wsPath = await join(vaultPath, NEKOTICK_CONFIG_FOLDER, WORKSPACE_FILE);
    if (!await exists(wsPath)) return null;
    const content = await readTextFile(wsPath);
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
    const configPath = await join(vaultPath, NEKOTICK_CONFIG_FOLDER);
    if (!await exists(configPath)) {
      await mkdir(configPath, { recursive: true });
    }
    const wsPath = await join(configPath, WORKSPACE_FILE);
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
    const favPath = await join(vaultPath, NEKOTICK_CONFIG_FOLDER, FAVORITES_FILE);
    if (!await exists(favPath)) return { notes: [], folders: [] };
    const content = await readTextFile(favPath);
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
    const configPath = await join(vaultPath, NEKOTICK_CONFIG_FOLDER);
    if (!await exists(configPath)) {
      await mkdir(configPath, { recursive: true });
    }
    const favPath = await join(configPath, FAVORITES_FILE);
    await safeWriteTextFile(favPath, JSON.stringify(favorites, null, 2));
  } catch { /* ignore */ }
}
