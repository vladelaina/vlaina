import { getBaseName, getParentPath, getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { ensureDirectories, getPaths } from '@/lib/storage/paths';
import { resolveUniqueName } from '@/lib/naming/uniqueName';
import { desktopWindow } from '@/lib/desktop/window';
import { sanitizeFileName } from '@/stores/notes/noteUtils';
import { moveNotesRootSystemStore } from '@/stores/notes/systemStoragePaths';
import {
  getNotesRootStarredPaths,
  normalizeStarredNotesRootPath,
  saveStarredRegistry,
} from '@/stores/notes/starred';
import { flushCurrentPendingEditorMarkdown } from '@/stores/notes/pendingEditorMarkdownFlusher';
import { setCurrentNotesRootPath, useNotesStore } from './useNotesStore';
import { normalizeNotesRootPath } from './notesRootConfig';
import type { NotesRootInfo } from './useNotesRootStore';

export const NOTES_ROOTS_STORAGE_KEY = 'vlaina-notes-roots';
export const CURRENT_NOTES_ROOT_KEY = 'vlaina-current-notes-root';
const NOTES_ROOT_STATE_FILE = 'state.json';
const NOTES_ROOT_STATE_VERSION = 1;
const MAX_NOTES_ROOT_STATE_BYTES = 256 * 1024;
const notesRootStateUtf8Encoder = new TextEncoder();
const MAX_RECENT_NOTES_ROOTS_STORAGE_CHARS = 64 * 1024;
const MAX_CURRENT_NOTES_ROOT_ID_STORAGE_CHARS = 4096;
const MAX_NOTES_ROOT_ID_CHARS = 256;
const MAX_NOTES_ROOT_NAME_CHARS = 512;
const MAX_NOTES_ROOT_PATH_CHARS = 4096;
const MAX_NOTES_ROOT_BROADCAST_LABEL_CHARS = 512;
const MAX_NOTES_ROOT_BROADCAST_REQUEST_ID_CHARS = 128;
export const MAX_PENDING_NOTES_ROOT_BROADCAST_QUERIES = 100;
const UNSAFE_NOTES_ROOT_PATH_CHARS = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;

const MAX_RECENT_NOTES_ROOTS = 10;
const MAX_DELETED_NOTES_ROOT_PATHS = 100;

let notesRootStateFileWriteQueue: Promise<void> = Promise.resolve();
let notesRootStatePersistRevision = 0;

function generateNotesRootId(): string {
  return `notes-root-${crypto.randomUUID()}`;
}

export function loadFromStorage<T>(
  key: string,
  defaultValue: T,
  options: { maxLength?: number } = {},
): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved && options.maxLength && saved.length > options.maxLength) {
      return defaultValue;
    }
    return saved ? JSON.parse(saved) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
}

interface PersistedNotesRootState {
  recentNotesRoots: NotesRootInfo[];
  currentNotesRootId: string | null;
  deletedNotesRootPaths?: string[];
  restoredNotesRootPaths?: string[];
}

interface NotesRootStateFile {
  version: typeof NOTES_ROOT_STATE_VERSION;
  recentNotesRoots: NotesRootInfo[];
  currentNotesRootId: string | null;
  deletedNotesRootPaths?: string[];
}

function canPersistNotesRootStateToFile(): boolean {
  return typeof getStorageAdapter().getBasePath === 'function';
}

async function getNotesRootStatePath(): Promise<string | null> {
  if (!canPersistNotesRootStateToFile()) {
    return null;
  }

  await ensureDirectories();
  const { notes } = await getPaths();
  return joinPath(notes, NOTES_ROOT_STATE_FILE);
}

function loadLocalNotesRootState(): PersistedNotesRootState {
  return {
    recentNotesRoots: loadRecentNotesRootsFromStorage(),
    currentNotesRootId: loadFromStorage<string | null>(CURRENT_NOTES_ROOT_KEY, null, {
      maxLength: MAX_CURRENT_NOTES_ROOT_ID_STORAGE_CHARS,
    }),
    deletedNotesRootPaths: [],
  };
}

function saveLocalNotesRootState(state: PersistedNotesRootState): void {
  saveToStorage(NOTES_ROOTS_STORAGE_KEY, state.recentNotesRoots);
  saveToStorage(CURRENT_NOTES_ROOT_KEY, state.currentNotesRootId);
}

function parseNotesRootStateFile(value: unknown): PersistedNotesRootState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const data = value as Partial<NotesRootStateFile>;
  return {
    recentNotesRoots: normalizeRecentNotesRoots(Array.isArray(data.recentNotesRoots) ? data.recentNotesRoots : []),
    currentNotesRootId: typeof data.currentNotesRootId === 'string' ? data.currentNotesRootId : null,
    deletedNotesRootPaths: normalizeDeletedNotesRootPaths(data.deletedNotesRootPaths),
  };
}

function resolvePersistedCurrentNotesRootId(
  recentNotesRoots: NotesRootInfo[],
  currentNotesRootId: string | null,
): string | null {
  return currentNotesRootId && recentNotesRoots.some((notesRoot) => notesRoot.id === currentNotesRootId)
    ? currentNotesRootId
    : null;
}

function mergeNotesRootStates(
  fileState: PersistedNotesRootState | null,
  localState: PersistedNotesRootState,
): PersistedNotesRootState {
  if (!fileState) {
    return localState;
  }

  const deletedNotesRootPaths = normalizeDeletedNotesRootPaths(fileState.deletedNotesRootPaths || []);
  const recentNotesRoots = normalizeRecentNotesRoots([...fileState.recentNotesRoots, ...localState.recentNotesRoots])
    .filter((notesRoot) => !deletedNotesRootPaths.includes(normalizeNotesRootPath(notesRoot.path)));

  return {
    recentNotesRoots,
    currentNotesRootId: resolvePersistedCurrentNotesRootId(recentNotesRoots, fileState.currentNotesRootId),
    deletedNotesRootPaths,
  };
}

async function readNotesRootStateFile(): Promise<PersistedNotesRootState | null> {
  try {
    const storage = getStorageAdapter();
    const statePath = await getNotesRootStatePath();
    if (!statePath) {
      return null;
    }
    if (!(await storage.exists(statePath))) {
      return null;
    }
    const fileInfo = await storage.stat(statePath).catch(() => null);
    if (
      fileInfo?.isDirectory === true ||
      fileInfo?.isFile === false ||
      (typeof fileInfo?.size === 'number' && (
        !Number.isFinite(fileInfo.size) ||
        fileInfo.size < 0 ||
        fileInfo.size > MAX_NOTES_ROOT_STATE_BYTES
      ))
    ) {
      return null;
    }
    const content = await storage.readFile(statePath, MAX_NOTES_ROOT_STATE_BYTES);
    if (notesRootStateUtf8Encoder.encode(content).length > MAX_NOTES_ROOT_STATE_BYTES) {
      return null;
    }
    return parseNotesRootStateFile(JSON.parse(content));
  } catch {
    return null;
  }
}

function mergeNotesRootStateForSave(
  incomingState: PersistedNotesRootState,
  fileState: PersistedNotesRootState | null,
): PersistedNotesRootState {
  const deletedNotesRootPaths = new Set(normalizeDeletedNotesRootPaths([
    ...(fileState?.deletedNotesRootPaths || []),
    ...(incomingState.deletedNotesRootPaths || []),
  ]));
  normalizeDeletedNotesRootPaths(incomingState.restoredNotesRootPaths || [])
    .forEach((path) => deletedNotesRootPaths.delete(path));
  const normalizedDeletedNotesRootPaths = normalizeDeletedNotesRootPaths(Array.from(deletedNotesRootPaths));
  const recentNotesRoots = normalizeRecentNotesRoots([
    ...incomingState.recentNotesRoots,
    ...(fileState?.recentNotesRoots || []),
  ]).filter((notesRoot) => !deletedNotesRootPaths.has(normalizeNotesRootPath(notesRoot.path)));

  return {
    recentNotesRoots,
    currentNotesRootId: resolvePersistedCurrentNotesRootId(recentNotesRoots, incomingState.currentNotesRootId),
    deletedNotesRootPaths: normalizedDeletedNotesRootPaths,
  };
}

function queueNotesRootStateFileWrite(writeTask: () => Promise<void>): void {
  notesRootStateFileWriteQueue = notesRootStateFileWriteQueue
    .catch(() => undefined)
    .then(writeTask)
    .catch(() => undefined);
}

export function persistNotesRootState(
  recentNotesRoots: NotesRootInfo[],
  currentNotesRootId: string | null,
  options: { deletedNotesRoots?: NotesRootInfo[]; restoredNotesRoots?: NotesRootInfo[] } = {},
): void {
  const persistRevision = ++notesRootStatePersistRevision;
  const state = {
    recentNotesRoots: normalizeRecentNotesRoots(recentNotesRoots),
    currentNotesRootId,
    deletedNotesRootPaths: normalizeDeletedNotesRootPaths(
      (options.deletedNotesRoots || []).map((notesRoot) => notesRoot.path)
    ),
    restoredNotesRootPaths: normalizeDeletedNotesRootPaths(
      (options.restoredNotesRoots || []).map((notesRoot) => notesRoot.path)
    ),
  };
  saveLocalNotesRootState(state);

  queueNotesRootStateFileWrite(async () => {
    try {
      const storage = getStorageAdapter();
      const statePath = await getNotesRootStatePath();
      if (!statePath) {
        return;
      }
      const mergedState = mergeNotesRootStateForSave(state, await readNotesRootStateFile());
      if (persistRevision === notesRootStatePersistRevision) {
        saveLocalNotesRootState(mergedState);
      }
      const payload: NotesRootStateFile = {
        version: NOTES_ROOT_STATE_VERSION,
        recentNotesRoots: mergedState.recentNotesRoots,
        currentNotesRootId: mergedState.currentNotesRootId,
        deletedNotesRootPaths: mergedState.deletedNotesRootPaths,
      };
      await storage.writeFile(statePath, JSON.stringify(payload, null, 2));
    } catch (error) {
    }
  });
}

export async function loadPersistedNotesRootState(): Promise<PersistedNotesRootState> {
  const localState = loadLocalNotesRootState();
  const fileState = await readNotesRootStateFile();
  const mergedState = mergeNotesRootStates(fileState, localState);

  saveLocalNotesRootState(mergedState);
  if (
    !fileState ||
    mergedState.currentNotesRootId !== fileState.currentNotesRootId ||
    mergedState.recentNotesRoots.length !== fileState.recentNotesRoots.length
  ) {
    persistNotesRootState(mergedState.recentNotesRoots, mergedState.currentNotesRootId);
  }

  return mergedState;
}

export function waitForUiRelease() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 80);
  });
}

export function getNotesRootName(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || 'Untitled';
}

function normalizeNotesRootTimestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Date.now();
}

function isAbsoluteNotesRootPath(path: string): boolean {
  return (
    path.startsWith('/') ||
    /^[A-Za-z]:\//.test(path) ||
    /^\/\/[^/]+\/[^/]+/.test(path)
  );
}

function normalizeSafeNotesRootPath(path: string): string | null {
  if (!path || path.length > MAX_NOTES_ROOT_PATH_CHARS || UNSAFE_NOTES_ROOT_PATH_CHARS.test(path)) {
    return null;
  }

  const normalizedPath = normalizeNotesRootPath(path);
  if (
    !normalizedPath ||
    normalizedPath.length > MAX_NOTES_ROOT_PATH_CHARS ||
    UNSAFE_NOTES_ROOT_PATH_CHARS.test(normalizedPath) ||
    !isAbsoluteNotesRootPath(normalizedPath)
  ) {
    return null;
  }

  return normalizedPath;
}

function normalizeDeletedNotesRootPaths(paths: unknown): string[] {
  if (!Array.isArray(paths)) {
    return [];
  }

  const deletedNotesRootPaths: string[] = [];
  const seenPaths = new Set<string>();

  for (let index = paths.length - 1; index >= 0; index -= 1) {
    const path = paths[index];
    if (typeof path !== 'string') {
      continue;
    }
    const normalizedPath = normalizeSafeNotesRootPath(path);
    if (!normalizedPath || seenPaths.has(normalizedPath)) {
      continue;
    }

    seenPaths.add(normalizedPath);
    deletedNotesRootPaths.push(normalizedPath);

    if (deletedNotesRootPaths.length >= MAX_DELETED_NOTES_ROOT_PATHS) {
      break;
    }
  }

  return deletedNotesRootPaths.reverse();
}

export function normalizeNotesRootInfo(notesRoot: NotesRootInfo): NotesRootInfo;
export function normalizeNotesRootInfo(notesRoot: unknown): NotesRootInfo | null;
export function normalizeNotesRootInfo(notesRoot: unknown): NotesRootInfo | null {
  if (!notesRoot || typeof notesRoot !== 'object') {
    return null;
  }

  const candidate = notesRoot as Partial<NotesRootInfo>;
  if (
    typeof candidate.path !== 'string' ||
    candidate.path.length === 0 ||
      candidate.path.length > MAX_NOTES_ROOT_PATH_CHARS
  ) {
    return null;
  }

  const normalizedPath = normalizeSafeNotesRootPath(candidate.path);
  if (!normalizedPath) {
    return null;
  }
  const id = typeof candidate.id === 'string' && candidate.id.length <= MAX_NOTES_ROOT_ID_CHARS
    ? candidate.id
    : generateNotesRootId();
  const name = typeof candidate.name === 'string' && candidate.name.length <= MAX_NOTES_ROOT_NAME_CHARS
    ? candidate.name
    : '';

  return {
    id,
    name: name || getNotesRootName(normalizedPath),
    path: normalizedPath,
    lastOpened: normalizeNotesRootTimestamp(candidate.lastOpened),
  };
}

export function normalizeRecentNotesRoots(notesRoots: unknown): NotesRootInfo[] {
  if (!Array.isArray(notesRoots)) {
    return [];
  }

  const seenPaths = new Set<string>();
  const normalizedNotesRoots: NotesRootInfo[] = [];

  for (const notesRoot of notesRoots) {
    const normalizedNotesRoot = normalizeNotesRootInfo(notesRoot);
    if (!normalizedNotesRoot || seenPaths.has(normalizedNotesRoot.path)) {
      continue;
    }

    seenPaths.add(normalizedNotesRoot.path);
    normalizedNotesRoots.push(normalizedNotesRoot);
  }

  return normalizedNotesRoots.slice(0, MAX_RECENT_NOTES_ROOTS);
}

export function parseRecentNotesRootsStorageValue(value: string | null): NotesRootInfo[] {
  if (!value || value.length > MAX_RECENT_NOTES_ROOTS_STORAGE_CHARS) {
    return [];
  }

  try {
    return normalizeRecentNotesRoots(JSON.parse(value));
  } catch {
    return [];
  }
}

export function isOversizedRecentNotesRootsStorageValue(value: string | null): boolean {
  return !!value && value.length > MAX_RECENT_NOTES_ROOTS_STORAGE_CHARS;
}

function loadRecentNotesRootsFromStorage(): NotesRootInfo[] {
  try {
    return parseRecentNotesRootsStorageValue(localStorage.getItem(NOTES_ROOTS_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function upsertRecentNotesRoot(recentNotesRoots: NotesRootInfo[], path: string, name?: string) {
  const normalizedPath = normalizeNotesRootPath(path);
  const notesRootName = name || getNotesRootName(normalizedPath);
  const existingNotesRoot = recentNotesRoots.find((candidate) => candidate.path === normalizedPath);

  const notesRoot = existingNotesRoot
    ? { ...existingNotesRoot, name: notesRootName, lastOpened: Date.now() }
    : {
        id: generateNotesRootId(),
        name: notesRootName,
        path: normalizedPath,
        lastOpened: Date.now(),
      };

  return {
    notesRoot,
    recentNotesRoots: normalizeRecentNotesRoots([
      notesRoot,
      ...recentNotesRoots.filter((candidate) => candidate.path !== normalizedPath),
    ]),
  };
}

export async function resolveRenamedNotesRootPath(currentPath: string, nextName: string) {
  const storage = getStorageAdapter();
  const parentPath = getParentPath(currentPath);
  if (!parentPath) {
    throw new Error('Cannot rename the opened folder at this path');
  }

  const currentFolderName = getBaseName(currentPath);
  const desiredName = sanitizeFileName(nextName);
  const resolvedName = await resolveUniqueName(desiredName, async (candidateName) => {
    if (candidateName === currentFolderName) {
      return false;
    }

    const candidatePath = await joinPath(parentPath, candidateName);
    return storage.exists(candidatePath);
  });

  return {
    name: resolvedName,
    path: normalizeNotesRootPath(await joinPath(parentPath, resolvedName)),
  };
}

export function isNativeFilesystemPath(path: string): boolean {
  if (/^[a-zA-Z]:[\\/]/.test(path)) return true;
  if (path.startsWith('~')) return true;
  if (/^\/(?:Users|home|var|etc|usr|opt|tmp|root|mnt|media|System|Library|Applications|Volumes)(?:\/|$)/i.test(path)) return true;
  return false;
}

let windowNotesRootPath: string | null = null;
let windowLabel: string | null = null;
let notesRootChannel: BroadcastChannel | null = null;
const pendingQueries: Map<string, (label: string | null) => void> = new Map();

type NotesRootBroadcastMessage =
  | { type: 'query'; requestId: string; notesRootPath: string }
  | { type: 'response'; requestId: string; responseLabel: string | null };

function normalizeBroadcastString(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : null;
}

export function parseNotesRootBroadcastMessage(value: unknown): NotesRootBroadcastMessage | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const data = value as Partial<Record<'type' | 'requestId' | 'notesRootPath' | 'responseLabel', unknown>>;
  const requestId = normalizeBroadcastString(data.requestId, MAX_NOTES_ROOT_BROADCAST_REQUEST_ID_CHARS);
  if (!requestId) {
    return null;
  }

  if (data.type === 'query') {
    const notesRootPath = normalizeBroadcastString(data.notesRootPath, MAX_NOTES_ROOT_PATH_CHARS);
    const normalizedNotesRootPath = notesRootPath ? normalizeSafeNotesRootPath(notesRootPath) : null;
    return normalizedNotesRootPath ? { type: 'query', requestId, notesRootPath: normalizedNotesRootPath } : null;
  }

  if (data.type === 'response') {
    if (data.responseLabel === null || data.responseLabel === undefined) {
      return { type: 'response', requestId, responseLabel: null };
    }
    const responseLabel = normalizeBroadcastString(data.responseLabel, MAX_NOTES_ROOT_BROADCAST_LABEL_CHARS);
    return responseLabel ? { type: 'response', requestId, responseLabel } : null;
  }

  return null;
}

export function setWindowNotesRootPath(path: string | null) {
  windowNotesRootPath = path;
}

export async function initializeWindowLabel(): Promise<void> {
  try {
    windowLabel = await desktopWindow.getLabel();
  } catch {
    windowLabel = null;
  }
}

export function setupBroadcastChannel() {
  if (notesRootChannel || typeof BroadcastChannel === 'undefined') return;

  try {
    notesRootChannel = new BroadcastChannel('vlaina-notes-root');
  } catch {
    notesRootChannel = null;
    return;
  }

  notesRootChannel.onmessage = (event) => {
    const message = parseNotesRootBroadcastMessage(event.data);
    if (!message) {
      return;
    }

    if (message.type === 'query' && windowNotesRootPath === message.notesRootPath && windowLabel) {
      try {
        notesRootChannel?.postMessage({
          type: 'response',
          requestId: message.requestId,
          responseLabel: windowLabel,
        });
      } catch {
      }
    } else if (message.type === 'response' && pendingQueries.has(message.requestId)) {
      const resolve = pendingQueries.get(message.requestId);
      pendingQueries.delete(message.requestId);
      resolve?.(message.responseLabel);
    }
  };
}

export async function queryNotesRootOpenInOtherWindow(path: string): Promise<string | null> {
  const normalizedPath = normalizeSafeNotesRootPath(path);
  if (!normalizedPath) {
    return null;
  }
  const requestId = `req-${crypto.randomUUID()}`;
  setupBroadcastChannel();
  if (pendingQueries.size >= MAX_PENDING_NOTES_ROOT_BROADCAST_QUERIES) {
    return null;
  }

  return new Promise((resolve) => {
    pendingQueries.set(requestId, resolve);

    try {
      notesRootChannel?.postMessage({
        type: 'query',
        requestId,
        notesRootPath: normalizedPath,
      });
    } catch {
    }

    setTimeout(() => {
      if (pendingQueries.has(requestId)) {
        pendingQueries.delete(requestId);
        resolve(null);
      }
    }, 150);
  });
}

export function syncCurrentNotesRootExternalPathAction({
  path,
  currentNotesRoot,
  recentNotesRoots,
  set,
}: {
  path: string;
  currentNotesRoot: NotesRootInfo | null;
  recentNotesRoots: NotesRootInfo[];
  set: (state: { currentNotesRoot?: NotesRootInfo | null; recentNotesRoots?: NotesRootInfo[]; error?: string | null }) => void;
}) {
  if (!currentNotesRoot) return;
  flushCurrentPendingEditorMarkdown();

  const normalizedPath = normalizeNotesRootPath(path);
  const normalizedCurrentNotesRoot = normalizeNotesRootInfo(currentNotesRoot);
  const normalizedCurrentNotesRootPath = normalizeNotesRootPath(normalizedCurrentNotesRoot.path);
  if (!normalizedPath || normalizedPath === normalizedCurrentNotesRootPath) return;
  void Promise.resolve(moveNotesRootSystemStore(normalizedCurrentNotesRootPath, normalizedPath))
    .catch(() => undefined);

  const nextNotesRoot = normalizeNotesRootInfo({
    ...normalizedCurrentNotesRoot,
    name: getNotesRootName(normalizedPath),
    path: normalizedPath,
    lastOpened: Date.now(),
  });
  const nextRecentNotesRoots = normalizeRecentNotesRoots([
    nextNotesRoot,
    ...normalizeRecentNotesRoots(recentNotesRoots).filter(
      (notesRoot) => notesRoot.id !== normalizedCurrentNotesRoot.id && notesRoot.path !== normalizedPath
    ),
  ]);

  persistNotesRootState(nextRecentNotesRoots, nextNotesRoot.id, {
    restoredNotesRoots: [nextNotesRoot],
  });

  const notesState = useNotesStore.getState();
  const normalizedStarredNotesRootPath = normalizeStarredNotesRootPath(normalizedCurrentNotesRootPath);
  const nextStarredEntries = notesState.starredEntries.map((entry) =>
    normalizeStarredNotesRootPath(entry.notesRootPath) === normalizedStarredNotesRootPath
      ? { ...entry, notesRootPath: normalizedPath }
      : entry
  );
  const nextStarredPaths = getNotesRootStarredPaths(nextStarredEntries, normalizedPath);
  const pendingStarredNavigation = notesState.pendingStarredNavigation;
  const nextPendingStarredNavigation =
    pendingStarredNavigation &&
    normalizeStarredNotesRootPath(pendingStarredNavigation.notesRootPath) === normalizedStarredNotesRootPath
      ? { ...pendingStarredNavigation, notesRootPath: normalizedPath }
      : pendingStarredNavigation;

  setWindowNotesRootPath(normalizedPath);
  setCurrentNotesRootPath(normalizedPath);

  notesState.clearAssetUrlCache();
  useNotesStore.setState({
    notesPath: normalizedPath,
    starredEntries: nextStarredEntries,
    starredNotes: nextStarredPaths.notes,
    starredFolders: nextStarredPaths.folders,
    pendingStarredNavigation: nextPendingStarredNavigation,
  });
  void Promise.resolve(saveStarredRegistry(nextStarredEntries)).catch(() => undefined);

  set({
    currentNotesRoot: nextNotesRoot,
    recentNotesRoots: nextRecentNotesRoots,
    error: null,
  });
}

export function removeRecentNotesRootAction({
  id,
  recentNotesRoots,
  currentNotesRoot,
  set,
}: {
  id: string;
  recentNotesRoots: NotesRootInfo[];
  currentNotesRoot: NotesRootInfo | null;
  set: (state: { currentNotesRoot?: NotesRootInfo | null; recentNotesRoots: NotesRootInfo[] }) => void;
}) {
  const deletedNotesRoots = recentNotesRoots.filter((notesRoot) => notesRoot.id === id);
  const updatedRecent = recentNotesRoots.filter((notesRoot) => notesRoot.id !== id);

  persistNotesRootState(updatedRecent, currentNotesRoot?.id === id ? null : currentNotesRoot?.id ?? null, {
    deletedNotesRoots,
  });

  if (currentNotesRoot?.id === id) {
    set({ currentNotesRoot: null, recentNotesRoots: updatedRecent });
  } else {
    set({ recentNotesRoots: updatedRecent });
  }
}

export function closeCurrentNotesRootAction(
  set: (state: { currentNotesRoot: NotesRootInfo | null }) => void,
  recentNotesRoots: NotesRootInfo[] = loadLocalNotesRootState().recentNotesRoots,
) {
  persistNotesRootState(recentNotesRoots, null);
  setWindowNotesRootPath(null);
  setCurrentNotesRootPath(null);
  set({ currentNotesRoot: null });
}
