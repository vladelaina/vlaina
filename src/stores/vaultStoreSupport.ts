import { getBaseName, getParentPath, getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { ensureDirectories, getPaths } from '@/lib/storage/paths';
import { resolveUniqueName } from '@/lib/naming/uniqueName';
import { desktopWindow } from '@/lib/desktop/window';
import { sanitizeFileName } from '@/stores/notes/noteUtils';
import { moveVaultSystemStore } from '@/stores/notes/systemStoragePaths';
import {
  getVaultStarredPaths,
  normalizeStarredVaultPath,
  saveStarredRegistry,
} from '@/stores/notes/starred';
import { flushCurrentPendingEditorMarkdown } from '@/stores/notes/pendingEditorMarkdownFlusher';
import { setCurrentVaultPath, useNotesStore } from './useNotesStore';
import { normalizeVaultPath } from './vaultConfig';
import type { VaultInfo } from './useVaultStore';

export const VAULTS_STORAGE_KEY = 'vlaina-vaults';
export const CURRENT_VAULT_KEY = 'vlaina-current-vault';
const VAULT_STATE_FILE = 'state.json';
const VAULT_STATE_VERSION = 1;
const MAX_VAULT_STATE_BYTES = 256 * 1024;
const vaultStateUtf8Encoder = new TextEncoder();
const MAX_RECENT_VAULTS_STORAGE_CHARS = 64 * 1024;
const MAX_CURRENT_VAULT_ID_STORAGE_CHARS = 4096;
const MAX_VAULT_ID_CHARS = 256;
const MAX_VAULT_NAME_CHARS = 512;
const MAX_VAULT_PATH_CHARS = 4096;
const MAX_VAULT_BROADCAST_LABEL_CHARS = 512;
const MAX_VAULT_BROADCAST_REQUEST_ID_CHARS = 128;
export const MAX_PENDING_VAULT_BROADCAST_QUERIES = 100;
const UNSAFE_VAULT_PATH_CHARS = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;

const MAX_RECENT_VAULTS = 5;

function generateVaultId(): string {
  return `vault-${crypto.randomUUID()}`;
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

interface PersistedVaultState {
  recentVaults: VaultInfo[];
  currentVaultId: string | null;
  deletedVaultPaths?: string[];
}

interface VaultStateFile {
  version: typeof VAULT_STATE_VERSION;
  recentVaults: VaultInfo[];
  currentVaultId: string | null;
  deletedVaultPaths?: string[];
}

function canPersistVaultStateToFile(): boolean {
  return typeof getStorageAdapter().getBasePath === 'function';
}

async function getVaultStatePath(): Promise<string | null> {
  if (!canPersistVaultStateToFile()) {
    return null;
  }

  await ensureDirectories();
  const { notes } = await getPaths();
  return joinPath(notes, VAULT_STATE_FILE);
}

function loadLocalVaultState(): PersistedVaultState {
  return {
    recentVaults: loadRecentVaultsFromStorage(),
    currentVaultId: loadFromStorage<string | null>(CURRENT_VAULT_KEY, null, {
      maxLength: MAX_CURRENT_VAULT_ID_STORAGE_CHARS,
    }),
    deletedVaultPaths: [],
  };
}

function saveLocalVaultState(state: PersistedVaultState): void {
  saveToStorage(VAULTS_STORAGE_KEY, state.recentVaults);
  saveToStorage(CURRENT_VAULT_KEY, state.currentVaultId);
}

function parseVaultStateFile(value: unknown): PersistedVaultState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const data = value as Partial<VaultStateFile>;
  return {
    recentVaults: normalizeRecentVaults(Array.isArray(data.recentVaults) ? data.recentVaults : []),
    currentVaultId: typeof data.currentVaultId === 'string' ? data.currentVaultId : null,
    deletedVaultPaths: Array.isArray(data.deletedVaultPaths)
      ? data.deletedVaultPaths
          .filter((path): path is string => typeof path === 'string')
          .map(normalizeVaultPath)
          .filter(Boolean)
      : [],
  };
}

function mergeVaultStates(
  fileState: PersistedVaultState | null,
  localState: PersistedVaultState,
): PersistedVaultState {
  if (!fileState) {
    return localState;
  }

  return {
    recentVaults: normalizeRecentVaults([...fileState.recentVaults, ...localState.recentVaults])
      .filter((vault) => !(fileState.deletedVaultPaths || []).includes(normalizeVaultPath(vault.path))),
    currentVaultId: fileState.currentVaultId,
    deletedVaultPaths: fileState.deletedVaultPaths || [],
  };
}

async function readVaultStateFile(): Promise<PersistedVaultState | null> {
  try {
    const storage = getStorageAdapter();
    const statePath = await getVaultStatePath();
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
        fileInfo.size > MAX_VAULT_STATE_BYTES
      ))
    ) {
      return null;
    }
    const content = await storage.readFile(statePath, MAX_VAULT_STATE_BYTES);
    if (vaultStateUtf8Encoder.encode(content).length > MAX_VAULT_STATE_BYTES) {
      return null;
    }
    return parseVaultStateFile(JSON.parse(content));
  } catch {
    return null;
  }
}

function mergeVaultStateForSave(
  incomingState: PersistedVaultState,
  fileState: PersistedVaultState | null,
): PersistedVaultState {
  const incomingPaths = new Set(incomingState.recentVaults.map((vault) => normalizeVaultPath(vault.path)));
  const deletedVaultPaths = new Set([
    ...(fileState?.deletedVaultPaths || []),
    ...(incomingState.deletedVaultPaths || []),
  ]);
  incomingPaths.forEach((path) => deletedVaultPaths.delete(path));

  return {
    recentVaults: normalizeRecentVaults([
      ...incomingState.recentVaults,
      ...(fileState?.recentVaults || []),
    ]).filter((vault) => !deletedVaultPaths.has(normalizeVaultPath(vault.path))),
    currentVaultId: incomingState.currentVaultId,
    deletedVaultPaths: Array.from(deletedVaultPaths),
  };
}

export function persistVaultState(
  recentVaults: VaultInfo[],
  currentVaultId: string | null,
  options: { deletedVaults?: VaultInfo[] } = {},
): void {
  const state = {
    recentVaults: normalizeRecentVaults(recentVaults),
    currentVaultId,
    deletedVaultPaths: (options.deletedVaults || []).map((vault) => normalizeVaultPath(vault.path)),
  };
  saveLocalVaultState(state);

  void (async () => {
    try {
      const storage = getStorageAdapter();
      const statePath = await getVaultStatePath();
      if (!statePath) {
        return;
      }
      const mergedState = mergeVaultStateForSave(state, await readVaultStateFile());
      const payload: VaultStateFile = {
        version: VAULT_STATE_VERSION,
        recentVaults: mergedState.recentVaults,
        currentVaultId: mergedState.currentVaultId,
        deletedVaultPaths: mergedState.deletedVaultPaths,
      };
      await storage.writeFile(statePath, JSON.stringify(payload, null, 2));
    } catch (error) {
    }
  })();
}

export async function loadPersistedVaultState(): Promise<PersistedVaultState> {
  const localState = loadLocalVaultState();
  const fileState = await readVaultStateFile();
  const mergedState = mergeVaultStates(fileState, localState);

  saveLocalVaultState(mergedState);
  if (
    !fileState ||
    mergedState.currentVaultId !== fileState.currentVaultId ||
    mergedState.recentVaults.length !== fileState.recentVaults.length
  ) {
    persistVaultState(mergedState.recentVaults, mergedState.currentVaultId);
  }

  return mergedState;
}

export function waitForUiRelease() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 80);
  });
}

export function getVaultName(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || 'Untitled';
}

function normalizeVaultTimestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Date.now();
}

function isAbsoluteVaultPath(path: string): boolean {
  return (
    path.startsWith('/') ||
    /^[A-Za-z]:\//.test(path) ||
    /^\/\/[^/]+\/[^/]+/.test(path)
  );
}

function normalizeSafeVaultPath(path: string): string | null {
  if (!path || path.length > MAX_VAULT_PATH_CHARS || UNSAFE_VAULT_PATH_CHARS.test(path)) {
    return null;
  }

  const normalizedPath = normalizeVaultPath(path);
  if (
    !normalizedPath ||
    normalizedPath.length > MAX_VAULT_PATH_CHARS ||
    UNSAFE_VAULT_PATH_CHARS.test(normalizedPath) ||
    !isAbsoluteVaultPath(normalizedPath)
  ) {
    return null;
  }

  return normalizedPath;
}

export function normalizeVaultInfo(vault: VaultInfo): VaultInfo;
export function normalizeVaultInfo(vault: unknown): VaultInfo | null;
export function normalizeVaultInfo(vault: unknown): VaultInfo | null {
  if (!vault || typeof vault !== 'object') {
    return null;
  }

  const candidate = vault as Partial<VaultInfo>;
  if (
    typeof candidate.path !== 'string' ||
    candidate.path.length === 0 ||
      candidate.path.length > MAX_VAULT_PATH_CHARS
  ) {
    return null;
  }

  const normalizedPath = normalizeSafeVaultPath(candidate.path);
  if (!normalizedPath) {
    return null;
  }
  const id = typeof candidate.id === 'string' && candidate.id.length <= MAX_VAULT_ID_CHARS
    ? candidate.id
    : generateVaultId();
  const name = typeof candidate.name === 'string' && candidate.name.length <= MAX_VAULT_NAME_CHARS
    ? candidate.name
    : '';

  return {
    id,
    name: name || getVaultName(normalizedPath),
    path: normalizedPath,
    lastOpened: normalizeVaultTimestamp(candidate.lastOpened),
  };
}

export function normalizeRecentVaults(vaults: unknown): VaultInfo[] {
  if (!Array.isArray(vaults)) {
    return [];
  }

  const seenPaths = new Set<string>();
  const normalizedVaults: VaultInfo[] = [];

  for (const vault of vaults) {
    const normalizedVault = normalizeVaultInfo(vault);
    if (!normalizedVault || seenPaths.has(normalizedVault.path)) {
      continue;
    }

    seenPaths.add(normalizedVault.path);
    normalizedVaults.push(normalizedVault);
  }

  return normalizedVaults.slice(0, MAX_RECENT_VAULTS);
}

export function parseRecentVaultsStorageValue(value: string | null): VaultInfo[] {
  if (!value || value.length > MAX_RECENT_VAULTS_STORAGE_CHARS) {
    return [];
  }

  try {
    return normalizeRecentVaults(JSON.parse(value));
  } catch {
    return [];
  }
}

export function isOversizedRecentVaultsStorageValue(value: string | null): boolean {
  return !!value && value.length > MAX_RECENT_VAULTS_STORAGE_CHARS;
}

function loadRecentVaultsFromStorage(): VaultInfo[] {
  try {
    return parseRecentVaultsStorageValue(localStorage.getItem(VAULTS_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function upsertRecentVault(recentVaults: VaultInfo[], path: string, name?: string) {
  const normalizedPath = normalizeVaultPath(path);
  const vaultName = name || getVaultName(normalizedPath);
  const existingVault = recentVaults.find((candidate) => candidate.path === normalizedPath);

  const vault = existingVault
    ? { ...existingVault, name: vaultName, lastOpened: Date.now() }
    : {
        id: generateVaultId(),
        name: vaultName,
        path: normalizedPath,
        lastOpened: Date.now(),
      };

  return {
    vault,
    recentVaults: normalizeRecentVaults([
      vault,
      ...recentVaults.filter((candidate) => candidate.path !== normalizedPath),
    ]),
  };
}

export async function resolveRenamedVaultPath(currentPath: string, nextName: string) {
  const storage = getStorageAdapter();
  const parentPath = getParentPath(currentPath);
  if (!parentPath) {
    throw new Error('Cannot rename the current vault at this path');
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
    path: normalizeVaultPath(await joinPath(parentPath, resolvedName)),
  };
}

export function isNativeFilesystemPath(path: string): boolean {
  if (/^[a-zA-Z]:[\\/]/.test(path)) return true;
  if (path.startsWith('~')) return true;
  if (/^\/(?:Users|home|var|etc|usr|opt|tmp|root|mnt|media|System|Library|Applications|Volumes)(?:\/|$)/i.test(path)) return true;
  return false;
}

let windowVaultPath: string | null = null;
let windowLabel: string | null = null;
let vaultChannel: BroadcastChannel | null = null;
const pendingQueries: Map<string, (label: string | null) => void> = new Map();

type VaultBroadcastMessage =
  | { type: 'query'; requestId: string; vaultPath: string }
  | { type: 'response'; requestId: string; responseLabel: string | null };

function normalizeBroadcastString(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : null;
}

export function parseVaultBroadcastMessage(value: unknown): VaultBroadcastMessage | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const data = value as Partial<Record<'type' | 'requestId' | 'vaultPath' | 'responseLabel', unknown>>;
  const requestId = normalizeBroadcastString(data.requestId, MAX_VAULT_BROADCAST_REQUEST_ID_CHARS);
  if (!requestId) {
    return null;
  }

  if (data.type === 'query') {
    const vaultPath = normalizeBroadcastString(data.vaultPath, MAX_VAULT_PATH_CHARS);
    const normalizedVaultPath = vaultPath ? normalizeSafeVaultPath(vaultPath) : null;
    return normalizedVaultPath ? { type: 'query', requestId, vaultPath: normalizedVaultPath } : null;
  }

  if (data.type === 'response') {
    if (data.responseLabel === null || data.responseLabel === undefined) {
      return { type: 'response', requestId, responseLabel: null };
    }
    const responseLabel = normalizeBroadcastString(data.responseLabel, MAX_VAULT_BROADCAST_LABEL_CHARS);
    return responseLabel ? { type: 'response', requestId, responseLabel } : null;
  }

  return null;
}

export function setWindowVaultPath(path: string | null) {
  windowVaultPath = path;
}

export async function initializeWindowLabel(): Promise<void> {
  try {
    windowLabel = await desktopWindow.getLabel();
  } catch {
    windowLabel = null;
  }
}

export function setupBroadcastChannel() {
  if (vaultChannel || typeof BroadcastChannel === 'undefined') return;

  try {
    vaultChannel = new BroadcastChannel('vlaina-vault');
  } catch {
    vaultChannel = null;
    return;
  }

  vaultChannel.onmessage = (event) => {
    const message = parseVaultBroadcastMessage(event.data);
    if (!message) {
      return;
    }

    if (message.type === 'query' && windowVaultPath === message.vaultPath && windowLabel) {
      try {
        vaultChannel?.postMessage({
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

export async function queryVaultOpenInOtherWindow(path: string): Promise<string | null> {
  const normalizedPath = normalizeSafeVaultPath(path);
  if (!normalizedPath) {
    return null;
  }
  const requestId = `req-${crypto.randomUUID()}`;
  setupBroadcastChannel();
  if (pendingQueries.size >= MAX_PENDING_VAULT_BROADCAST_QUERIES) {
    return null;
  }

  return new Promise((resolve) => {
    pendingQueries.set(requestId, resolve);

    try {
      vaultChannel?.postMessage({
        type: 'query',
        requestId,
        vaultPath: normalizedPath,
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

export function syncCurrentVaultExternalPathAction({
  path,
  currentVault,
  recentVaults,
  set,
}: {
  path: string;
  currentVault: VaultInfo | null;
  recentVaults: VaultInfo[];
  set: (state: { currentVault?: VaultInfo | null; recentVaults?: VaultInfo[]; error?: string | null }) => void;
}) {
  if (!currentVault) return;
  flushCurrentPendingEditorMarkdown();

  const normalizedPath = normalizeVaultPath(path);
  const normalizedCurrentVault = normalizeVaultInfo(currentVault);
  const normalizedCurrentVaultPath = normalizeVaultPath(normalizedCurrentVault.path);
  if (!normalizedPath || normalizedPath === normalizedCurrentVaultPath) return;
  void Promise.resolve(moveVaultSystemStore(normalizedCurrentVaultPath, normalizedPath))
    .catch(() => undefined);

  const nextVault = normalizeVaultInfo({
    ...normalizedCurrentVault,
    name: getVaultName(normalizedPath),
    path: normalizedPath,
    lastOpened: Date.now(),
  });
  const nextRecentVaults = normalizeRecentVaults([
    nextVault,
    ...normalizeRecentVaults(recentVaults).filter(
      (vault) => vault.id !== normalizedCurrentVault.id && vault.path !== normalizedPath
    ),
  ]);

  persistVaultState(nextRecentVaults, nextVault.id);

  const notesState = useNotesStore.getState();
  const normalizedStarredVaultPath = normalizeStarredVaultPath(normalizedCurrentVaultPath);
  const nextStarredEntries = notesState.starredEntries.map((entry) =>
    normalizeStarredVaultPath(entry.vaultPath) === normalizedStarredVaultPath
      ? { ...entry, vaultPath: normalizedPath }
      : entry
  );
  const nextStarredPaths = getVaultStarredPaths(nextStarredEntries, normalizedPath);
  const pendingStarredNavigation = notesState.pendingStarredNavigation;
  const nextPendingStarredNavigation =
    pendingStarredNavigation &&
    normalizeStarredVaultPath(pendingStarredNavigation.vaultPath) === normalizedStarredVaultPath
      ? { ...pendingStarredNavigation, vaultPath: normalizedPath }
      : pendingStarredNavigation;

  setWindowVaultPath(normalizedPath);
  setCurrentVaultPath(normalizedPath);

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
    currentVault: nextVault,
    recentVaults: nextRecentVaults,
    error: null,
  });
}

export function removeRecentVaultAction({
  id,
  recentVaults,
  currentVault,
  set,
}: {
  id: string;
  recentVaults: VaultInfo[];
  currentVault: VaultInfo | null;
  set: (state: { currentVault?: VaultInfo | null; recentVaults: VaultInfo[] }) => void;
}) {
  const deletedVaults = recentVaults.filter((vault) => vault.id === id);
  const updatedRecent = recentVaults.filter((vault) => vault.id !== id);

  persistVaultState(updatedRecent, currentVault?.id === id ? null : currentVault?.id ?? null, {
    deletedVaults,
  });

  if (currentVault?.id === id) {
    set({ currentVault: null, recentVaults: updatedRecent });
  } else {
    set({ recentVaults: updatedRecent });
  }
}

export function closeCurrentVaultAction(
  set: (state: { currentVault: VaultInfo | null }) => void,
  recentVaults: VaultInfo[] = loadLocalVaultState().recentVaults,
) {
  persistVaultState(recentVaults, null);
  setWindowVaultPath(null);
  setCurrentVaultPath(null);
  set({ currentVault: null });
}
