import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import {
  RECENT_NOTES_KEY,
  NOTE_ICON_SIZE_KEY,
  MAX_RECENT_NOTES,
  WORKSPACE_FILE,
} from './constants';
import type { FileTreeSortMode, MetadataFile, NoteCoverMetadata, NoteMetadataEntry } from './types';
import { normalizeNoteMetadataEntry, readNoteMetadataFromMarkdown } from './frontmatter';
import { ensureSystemDirectory, getVaultSystemStorePath } from './systemStoragePaths';
import { normalizeRecentNotePaths, normalizeWorkspaceState } from './persistenceValidation';
import { isSafeVaultPathSegment } from './utils/fs/vaultPathContainment';

export type { MetadataFile, NoteMetadataEntry };

const CURRENT_METADATA_VERSION = 2;
const DEFAULT_NOTE_ICON_SIZE = 60;
const MAX_METADATA_CACHE_VAULTS = 8;
const MAX_METADATA_SCAN_ENTRIES = 5000;
const MAX_METADATA_SCAN_DEPTH = 24;
const MAX_METADATA_READ_BYTES = 5 * 1024 * 1024;
const MAX_RECENT_NOTES_STORAGE_CHARS = 64 * 1024;
const MAX_WORKSPACE_STATE_BYTES = 256 * 1024;
const SKIPPED_METADATA_DIRECTORY_NAMES = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'target',
  '__pycache__',
]);

interface CachedMetadataEntry {
  modifiedAt: number | null;
  size: number | null;
  metadata: NoteMetadataEntry;
}

interface MetadataScanBudget {
  visitedEntries: number;
}

const metadataCacheByVault = new Map<string, Map<string, CachedMetadataEntry>>();

function setMetadataVaultCache(vaultPath: string, cache: Map<string, CachedMetadataEntry>) {
  metadataCacheByVault.delete(vaultPath);
  metadataCacheByVault.set(vaultPath, cache);

  while (metadataCacheByVault.size > MAX_METADATA_CACHE_VAULTS) {
    const oldestVaultPath = metadataCacheByVault.keys().next().value;
    if (oldestVaultPath === undefined) {
      return;
    }
    metadataCacheByVault.delete(oldestVaultPath);
  }
}

export function loadRecentNotes(): string[] {
  try {
    const saved = localStorage.getItem(RECENT_NOTES_KEY);
    if (saved && saved.length > MAX_RECENT_NOTES_STORAGE_CHARS) {
      return [];
    }
    return saved ? normalizeRecentNotePaths(JSON.parse(saved)) : [];
  } catch {
    return [];
  }
}

function saveRecentNotes(paths: string[]): void {
  try {
    localStorage.setItem(RECENT_NOTES_KEY, JSON.stringify(normalizeRecentNotePaths(paths)));
  } catch (error) {
  }
}

export function persistRecentNotes(paths: string[]): void {
  saveRecentNotes(paths);
}

function normalizeGlobalNoteIconSize(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_NOTE_ICON_SIZE;
}

export function loadGlobalNoteIconSize(): number {
  try {
    return normalizeGlobalNoteIconSize(localStorage.getItem(NOTE_ICON_SIZE_KEY));
  } catch {
    return DEFAULT_NOTE_ICON_SIZE;
  }
}

export function persistGlobalNoteIconSize(size: number): number {
  const normalized = normalizeGlobalNoteIconSize(size);

  try {
    localStorage.setItem(NOTE_ICON_SIZE_KEY, String(normalized));
  } catch (error) {
  }

  return normalized;
}

export function addToRecentNotes(path: string, current: string[]): string[] {
  const normalizedPath = normalizeRecentNotePaths([path])[0];
  if (!normalizedPath) {
    return normalizeRecentNotePaths(current);
  }

  const filtered = normalizeRecentNotePaths(current).filter(p => p !== normalizedPath);
  const updated = [normalizedPath, ...filtered].slice(0, MAX_RECENT_NOTES);
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

function shouldSkipMetadataDirectory(name: string) {
  return name.startsWith('.') || SKIPPED_METADATA_DIRECTORY_NAMES.has(name);
}

async function collectMarkdownPaths(
  basePath: string,
  relativePath: string = '',
  budget: MetadataScanBudget = { visitedEntries: 0 },
  depth = 0,
): Promise<string[]> {
  if (budget.visitedEntries >= MAX_METADATA_SCAN_ENTRIES || depth >= MAX_METADATA_SCAN_DEPTH) {
    return [];
  }

  const storage = getStorageAdapter();
  const currentPath = relativePath ? await joinPath(basePath, relativePath) : basePath;
  const entries = await storage.listDir(currentPath);
  const collected: string[] = [];

  for (const entry of entries) {
    if (budget.visitedEntries >= MAX_METADATA_SCAN_ENTRIES) {
      break;
    }
    budget.visitedEntries += 1;

    if (!isSafeVaultPathSegment(entry.name)) {
      continue;
    }

    if (entry.name.startsWith('.')) {
      continue;
    }

    const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory === true) {
      if (shouldSkipMetadataDirectory(entry.name)) {
        continue;
      }
      collected.push(...await collectMarkdownPaths(basePath, entryPath, budget, depth + 1));
      continue;
    }

    if (entry.isFile === true && isSupportedMarkdownPath(entry.name)) {
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
    const vaultCache = metadataCacheByVault.get(vaultPath) ?? new Map<string, CachedMetadataEntry>();
    setMetadataVaultCache(vaultPath, vaultCache);
    const nextCache = new Map<string, CachedMetadataEntry>();

    const BATCH_SIZE = 10;
    for (let index = 0; index < notePaths.length; index += BATCH_SIZE) {
      const batch = notePaths.slice(index, index + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (relativePath) => {
          const fullPath = await joinPath(vaultPath, relativePath);
          const fileInfo = await storage.stat(fullPath).catch(() => null);
          const modifiedAt = fileInfo?.modifiedAt ?? null;
          const size = fileInfo?.size ?? null;
          if (typeof size === 'number' && size > MAX_METADATA_READ_BYTES) {
            return {
              relativePath,
              metadata: {},
            };
          }

          const canUseCache = modifiedAt !== null || size !== null;
          const cached = vaultCache.get(relativePath);
          if (canUseCache && cached && cached.modifiedAt === modifiedAt && cached.size === size) {
            nextCache.set(relativePath, cached);
            return {
              relativePath,
              metadata: cached.metadata,
            };
          }

          const content = await storage.readFile(fullPath);
          const metadata = normalizeLoadedEntry(readNoteMetadataFromMarkdown(content));
          if (canUseCache) {
            nextCache.set(relativePath, {
              modifiedAt,
              size,
              metadata,
            });
          }
          return {
            relativePath,
            metadata,
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

    setMetadataVaultCache(vaultPath, nextCache);

    return {
      version: CURRENT_METADATA_VERSION,
      notes,
    };
  } catch (error) {
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

    const fileInfo = await storage.stat(wsPath).catch(() => null);
    if (fileInfo?.size && fileInfo.size > MAX_WORKSPACE_STATE_BYTES) {
      return null;
    }

    const content = await storage.readFile(wsPath);
    return normalizeWorkspaceState(JSON.parse(content));
  } catch (error) {
    return null;
  }
}

export async function saveWorkspaceState(vaultPath: string, state: WorkspaceState): Promise<void> {
  try {
    const storePath = await getVaultSystemStorePath(vaultPath);
    await ensureSystemDirectory(storePath);

    const wsPath = await joinPath(storePath, WORKSPACE_FILE);
    const existingState = await loadWorkspaceState(vaultPath);
    const normalizedState = normalizeWorkspaceState(state);
    const mergedState = normalizedState && existingState
      ? {
          ...normalizedState,
          expandedFolders: Array.from(new Set([
            ...existingState.expandedFolders,
            ...normalizedState.expandedFolders,
          ])),
        }
      : normalizedState;
    await safeWriteTextFile(wsPath, JSON.stringify(mergedState, null, 2));
  } catch (error) {
  }
}
