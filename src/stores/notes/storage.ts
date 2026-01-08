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
  ICONS_FILE,
  WORKSPACE_FILE,
  FAVORITES_FILE,
} from './constants';

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

/**
 * Load icons from .nekotick/icons.json
 */
export async function loadNoteIconsFromFile(vaultPath: string): Promise<Map<string, string>> {
  try {
    const storage = getStorageAdapter();
    const iconsPath = await joinPath(vaultPath, NEKOTICK_CONFIG_FOLDER, ICONS_FILE);
    
    if (!(await storage.exists(iconsPath))) {
      return new Map();
    }

    const content = await storage.readFile(iconsPath);
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
    const storage = getStorageAdapter();
    const configPath = await joinPath(vaultPath, NEKOTICK_CONFIG_FOLDER);
    
    if (!(await storage.exists(configPath))) {
      await storage.mkdir(configPath, true);
    }

    const iconsPath = await joinPath(configPath, ICONS_FILE);
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
