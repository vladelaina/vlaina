import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { ensureDirectories, getPaths } from '@/lib/storage/paths';
import { normalizeNotesRootPath } from './notesRootConfig';
import type { NotesRootInfo } from './notesRootStoreTypes';
import { CURRENT_NOTES_ROOT_KEY, MAX_CURRENT_NOTES_ROOT_ID_STORAGE_CHARS, MAX_NOTES_ROOT_STATE_BYTES, NOTES_ROOTS_STORAGE_KEY, NOTES_ROOT_STATE_FILE, NOTES_ROOT_STATE_VERSION } from './notesRootStoreConstants';
import { loadRecentNotesRootsFromStorage, normalizeDeletedNotesRootPaths, normalizeRecentNotesRoots } from './notesRootInfoUtils';
import { saveToStorage } from './notesRootLocalStorage';

const notesRootStateUtf8Encoder = new TextEncoder();
let notesRootStateFileWriteQueue: Promise<void> = Promise.resolve();
let notesRootStatePersistRevision = 0;

export interface PersistedNotesRootState {
  recentNotesRoots: NotesRootInfo[];
  currentNotesRootId: string | null;
  hasLocalCurrentNotesRootId?: boolean;
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

function loadLocalCurrentNotesRootId(): { value: string | null; hasValue: boolean } {
  try {
    const saved = localStorage.getItem(CURRENT_NOTES_ROOT_KEY);
    if (!saved || saved.length > MAX_CURRENT_NOTES_ROOT_ID_STORAGE_CHARS) {
      return { value: null, hasValue: false };
    }

    const parsed = JSON.parse(saved);
    if (parsed === null) {
      return { value: null, hasValue: true };
    }
    if (typeof parsed === 'string') {
      return { value: parsed, hasValue: true };
    }
    return { value: null, hasValue: false };
  } catch {
    return { value: null, hasValue: false };
  }
}

function loadLocalNotesRootState(): PersistedNotesRootState {
  const currentNotesRootId = loadLocalCurrentNotesRootId();
  return {
    recentNotesRoots: loadRecentNotesRootsFromStorage(),
    currentNotesRootId: currentNotesRootId.value,
    hasLocalCurrentNotesRootId: currentNotesRootId.hasValue,
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
  const preferredCurrentNotesRootId = localState.hasLocalCurrentNotesRootId
    ? localState.currentNotesRootId
    : fileState.currentNotesRootId ?? recentNotesRoots[0]?.id ?? null;

  return {
    recentNotesRoots,
    currentNotesRootId: resolvePersistedCurrentNotesRootId(recentNotesRoots, preferredCurrentNotesRootId),
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
