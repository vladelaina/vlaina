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
import { ensureSystemDirectory, getNotesRootSystemStorePath } from './systemStoragePaths';
import { normalizeRecentNotePaths, normalizeWorkspaceState } from './persistenceValidation';
import { isSafeNotesRootPathSegment, MAX_NOTES_ROOT_RELATIVE_PATH_CHARS } from './utils/fs/notesRootPathContainment';
import { hasInternalNotePathSegment } from './utils/fs/internalNotePaths';

export type { MetadataFile, NoteMetadataEntry };

const CURRENT_METADATA_VERSION = 2;
const DEFAULT_NOTE_ICON_SIZE = 60;
const MAX_METADATA_CACHE_NOTES_ROOTS = 8;
const MAX_METADATA_SCAN_ENTRIES = 5000;
const MAX_METADATA_DIRECTORY_SCAN_ENTRIES = 10_000;
const MAX_METADATA_SCAN_DEPTH = 24;
const MAX_METADATA_READ_BYTES = 5 * 1024 * 1024;
const MAX_RECENT_NOTES_STORAGE_CHARS = 64 * 1024;
const MAX_WORKSPACE_STATE_BYTES = 256 * 1024;
const utf8Encoder = new TextEncoder();
const LOW_PRIORITY_METADATA_DIRECTORY_NAMES = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'target',
  '__pycache__',
]);
interface CachedMetadataEntry {
  createdAt: number | null;
  modifiedAt: number | null;
  size: number | null;
  metadata: NoteMetadataEntry;
}

interface MetadataScanBudget {
  scannedEntries: number;
  visitedEntries: number;
}

const metadataCacheByNotesRoot = new Map<string, Map<string, CachedMetadataEntry>>();

function setMetadataNotesRootCache(notesRootPath: string, cache: Map<string, CachedMetadataEntry>) {
  metadataCacheByNotesRoot.delete(notesRootPath);
  metadataCacheByNotesRoot.set(notesRootPath, cache);

  while (metadataCacheByNotesRoot.size > MAX_METADATA_CACHE_NOTES_ROOTS) {
    const oldestNotesRootPath = metadataCacheByNotesRoot.keys().next().value;
    if (oldestNotesRootPath === undefined) {
      return;
    }
    metadataCacheByNotesRoot.delete(oldestNotesRootPath);
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
  let parsed = Number.NaN;
  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string' && value.length <= 64) {
    const trimmed = value.trim();
    parsed = /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  }
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

function isLowPriorityMetadataDirectory(name: string) {
  return LOW_PRIORITY_METADATA_DIRECTORY_NAMES.has(name.toLowerCase());
}

function shouldHideMetadataDirectory(name: string) {
  return hasInternalNotePathSegment(name);
}

function getMetadataScanPriority(entry: { name: string; isDirectory?: boolean; isFile?: boolean }) {
  if (!isSafeNotesRootPathSegment(entry.name)) {
    return 3;
  }

  if (entry.isFile === true && isSupportedMarkdownPath(entry.name)) {
    return 0;
  }

  if (entry.isDirectory === true && !isLowPriorityMetadataDirectory(entry.name)) {
    return 1;
  }

  if (entry.isDirectory === true) {
    return 2;
  }

  return 3;
}

function prioritizeMetadataScanEntries<T extends { name: string; isDirectory?: boolean; isFile?: boolean }>(
  entries: readonly T[],
  maxEntries = entries.length,
): T[] {
  const priorityBuckets: T[][] = [[], [], [], []];
  const limit = Math.max(0, Math.floor(maxEntries));
  if (limit === 0) {
    return [];
  }

  let retainedEntries = 0;
  for (const entry of entries) {
    const priority = getMetadataScanPriority(entry);
    const bucket = priorityBuckets[priority];
    if (!bucket) {
      continue;
    }

    if (retainedEntries < limit) {
      bucket.push(entry);
      retainedEntries += 1;
      continue;
    }

    for (let worsePriority = priorityBuckets.length - 1; worsePriority > priority; worsePriority -= 1) {
      const worseBucket = priorityBuckets[worsePriority];
      if (worseBucket.length > 0) {
        worseBucket.pop();
        bucket.push(entry);
        break;
      }
    }
  }
  const prioritized: T[] = [];
  for (const bucket of priorityBuckets) {
    for (const entry of bucket) {
      if (prioritized.length >= limit) {
        return prioritized;
      }
      prioritized.push(entry);
    }
  }
  return prioritized;
}

function isReadableBoundedFile(
  fileInfo: { isFile?: boolean; isDirectory?: boolean; size?: number | null } | null | undefined,
  maxBytes: number,
): boolean {
  const size = fileInfo?.size;
  return (
    fileInfo?.isDirectory !== true &&
    fileInfo?.isFile !== false &&
    (
      typeof size !== 'number' ||
      (Number.isFinite(size) && size >= 0 && size <= maxBytes)
    )
  );
}

function isReadableBoundedMarkdownFile(
  fileInfo: { isFile?: boolean; isDirectory?: boolean; size?: number | null } | null | undefined,
  maxBytes: number,
): boolean {
  if (!fileInfo || fileInfo.isDirectory === true || fileInfo.isFile === false) {
    return false;
  }

  const size = fileInfo.size;
  return typeof size !== 'number' || (Number.isFinite(size) && size >= 0 && size <= maxBytes);
}

function getKnownReadableFileSize(
  fileInfo: { size?: number | null } | null | undefined,
): number | null {
  return typeof fileInfo?.size === 'number' && Number.isFinite(fileInfo.size) && fileInfo.size >= 0
    ? fileInfo.size
    : null;
}

function getKnownReadableModifiedAt(
  fileInfo: { modifiedAt?: number | null } | null | undefined,
): number | null {
  return typeof fileInfo?.modifiedAt === 'number' && Number.isFinite(fileInfo.modifiedAt)
    ? fileInfo.modifiedAt
    : null;
}

function getKnownReadableCreatedAt(
  fileInfo: { createdAt?: number | null } | null | undefined,
): number | null {
  return typeof fileInfo?.createdAt === 'number' && Number.isFinite(fileInfo.createdAt)
    ? fileInfo.createdAt
    : null;
}

export function mergeNoteMetadataWithFileInfo(
  entry: Partial<NoteMetadataEntry> | null | undefined,
  fileInfo: { createdAt?: number | null; modifiedAt?: number | null } | null | undefined,
): NoteMetadataEntry {
  const createdAt = getKnownReadableCreatedAt(fileInfo);
  const updatedAt = getKnownReadableModifiedAt(fileInfo);

  return normalizeLoadedEntry({
    ...entry,
    ...(createdAt !== null ? { createdAt } : {}),
    ...(updatedAt !== null ? { updatedAt } : {}),
  });
}

async function collectMarkdownPaths(
  basePath: string,
  relativePath: string = '',
  budget: MetadataScanBudget = { scannedEntries: 0, visitedEntries: 0 },
  depth = 0,
): Promise<string[]> {
  if (
    budget.scannedEntries >= MAX_METADATA_DIRECTORY_SCAN_ENTRIES ||
    budget.visitedEntries >= MAX_METADATA_SCAN_ENTRIES
  ) {
    return [];
  }

  const storage = getStorageAdapter();
  const currentPath = relativePath ? await joinPath(basePath, relativePath) : basePath;
  let entries: Awaited<ReturnType<typeof storage.listDir>>;
  try {
    entries = await storage.listDir(currentPath, { includeHidden: true });
  } catch (error) {
    if (!relativePath) {
      throw error;
    }
    return [];
  }
  const collected: string[] = [];

  const remainingScanEntries = MAX_METADATA_DIRECTORY_SCAN_ENTRIES - budget.scannedEntries;
  for (const entry of prioritizeMetadataScanEntries(entries, remainingScanEntries)) {
    if (budget.scannedEntries >= MAX_METADATA_DIRECTORY_SCAN_ENTRIES) {
      break;
    }
    budget.scannedEntries += 1;

    if (!isSafeNotesRootPathSegment(entry.name)) {
      continue;
    }

    const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    if (entryPath.length > MAX_NOTES_ROOT_RELATIVE_PATH_CHARS) {
      continue;
    }

    if (entry.isDirectory === true) {
      if (shouldHideMetadataDirectory(entry.name)) {
        continue;
      }
      if (depth >= MAX_METADATA_SCAN_DEPTH) {
        continue;
      }
      if (budget.visitedEntries >= MAX_METADATA_SCAN_ENTRIES) {
        break;
      }
      budget.visitedEntries += 1;
      collected.push(...await collectMarkdownPaths(basePath, entryPath, budget, depth + 1));
      continue;
    }

    if (entry.isFile === true && isSupportedMarkdownPath(entry.name)) {
      if (budget.visitedEntries >= MAX_METADATA_SCAN_ENTRIES) {
        break;
      }
      budget.visitedEntries += 1;
      collected.push(entryPath);
    }
  }

  return collected;
}

export async function loadNoteMetadata(notesRootPath: string): Promise<MetadataFile> {
  try {
    const storage = getStorageAdapter();
    const notePaths = await collectMarkdownPaths(notesRootPath);
    const notes: MetadataFile['notes'] = {};
    const notesRootCache = metadataCacheByNotesRoot.get(notesRootPath) ?? new Map<string, CachedMetadataEntry>();
    setMetadataNotesRootCache(notesRootPath, notesRootCache);
    const nextCache = new Map<string, CachedMetadataEntry>();

    const BATCH_SIZE = 10;
    for (let index = 0; index < notePaths.length; index += BATCH_SIZE) {
      const batch = notePaths.slice(index, index + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (relativePath) => {
          const fullPath = await joinPath(notesRootPath, relativePath);
          const fileInfo = await storage.stat(fullPath).catch(() => null);
          const createdAt = getKnownReadableCreatedAt(fileInfo);
          const modifiedAt = getKnownReadableModifiedAt(fileInfo);
          const size = getKnownReadableFileSize(fileInfo);
          if (!isReadableBoundedMarkdownFile(fileInfo, MAX_METADATA_READ_BYTES)) {
            return {
              relativePath,
              metadata: mergeNoteMetadataWithFileInfo({}, fileInfo),
            };
          }

          const canUseCache = modifiedAt !== null;
          const cached = notesRootCache.get(relativePath);
          if (
            canUseCache &&
            cached &&
            cached.createdAt === createdAt &&
            cached.modifiedAt === modifiedAt &&
            cached.size === size
          ) {
            nextCache.set(relativePath, cached);
            return {
              relativePath,
              metadata: cached.metadata,
            };
          }

          const content = await storage.readFile(fullPath, MAX_METADATA_READ_BYTES);
          if (utf8Encoder.encode(content).length > MAX_METADATA_READ_BYTES) {
            return {
              relativePath,
              metadata: mergeNoteMetadataWithFileInfo({}, fileInfo),
            };
          }
          const metadata = mergeNoteMetadataWithFileInfo(readNoteMetadataFromMarkdown(content), fileInfo);
          if (canUseCache) {
            nextCache.set(relativePath, {
              createdAt,
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

    setMetadataNotesRootCache(notesRootPath, nextCache);

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

let currentNotesRootPath: string | null = null;

export function setCurrentNotesRootPath(path: string | null): void {
  currentNotesRootPath = path;
}

export function getCurrentNotesRootPath(): string | null {
  return currentNotesRootPath;
}

export async function getNotesBasePath(): Promise<string> {
  if (!currentNotesRootPath) {
    throw new Error('No opened folder selected');
  }
  return currentNotesRootPath;
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

export async function loadWorkspaceState(notesRootPath: string): Promise<WorkspaceState | null> {
  try {
    const storage = getStorageAdapter();
    const wsPath = await getNotesRootSystemStorePath(notesRootPath, WORKSPACE_FILE);

    if (!(await storage.exists(wsPath))) {
      return null;
    }

    const fileInfo = await storage.stat(wsPath).catch(() => null);
    if (!isReadableBoundedFile(fileInfo, MAX_WORKSPACE_STATE_BYTES)) {
      return null;
    }

    const content = await storage.readFile(wsPath, MAX_WORKSPACE_STATE_BYTES);
    if (utf8Encoder.encode(content).length > MAX_WORKSPACE_STATE_BYTES) {
      return null;
    }
    return normalizeWorkspaceState(JSON.parse(content));
  } catch (error) {
    return null;
  }
}

export async function saveWorkspaceState(notesRootPath: string, state: WorkspaceState): Promise<void> {
  try {
    const storePath = await getNotesRootSystemStorePath(notesRootPath);
    await ensureSystemDirectory(storePath);

    const wsPath = await joinPath(storePath, WORKSPACE_FILE);
    const existingState = await loadWorkspaceState(notesRootPath);
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
    await safeWriteTextFile(wsPath, JSON.stringify(normalizeWorkspaceState(mergedState), null, 2));
  } catch (error) {
  }
}
