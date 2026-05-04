import { getBaseName, getParentPath, getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { resolveUniqueName } from '@/lib/naming/uniqueName';
import { desktopWindow } from '@/lib/desktop/window';
import { sanitizeFileName } from '@/stores/notes/noteUtils';
import { moveVaultSystemStore } from '@/stores/notes/systemStoragePaths';
import {
  getVaultStarredPaths,
  normalizeStarredVaultPath,
  saveStarredRegistry,
} from '@/stores/notes/starred';
import { setCurrentVaultPath, useNotesStore } from './useNotesStore';
import { normalizeVaultPath } from './vaultConfig';
import type { VaultInfo } from './useVaultStore';

export const VAULTS_STORAGE_KEY = 'vlaina-vaults';
export const CURRENT_VAULT_KEY = 'vlaina-current-vault';

const MAX_RECENT_VAULTS = 5;

function generateVaultId(): string {
  return `vault-${crypto.randomUUID()}`;
}

export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const saved = localStorage.getItem(key);
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

export function waitForUiRelease() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 80);
  });
}

export function getVaultName(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || 'Untitled';
}

export function normalizeVaultInfo(vault: VaultInfo): VaultInfo {
  const normalizedPath = normalizeVaultPath(vault.path);
  return {
    ...vault,
    name: vault.name || getVaultName(normalizedPath),
    path: normalizedPath,
  };
}

export function normalizeRecentVaults(vaults: VaultInfo[]): VaultInfo[] {
  const seenPaths = new Set<string>();
  const normalizedVaults: VaultInfo[] = [];

  for (const vault of vaults) {
    const normalizedVault = normalizeVaultInfo(vault);
    if (seenPaths.has(normalizedVault.path)) {
      continue;
    }

    seenPaths.add(normalizedVault.path);
    normalizedVaults.push(normalizedVault);
  }

  return normalizedVaults.slice(0, MAX_RECENT_VAULTS);
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
  if (vaultChannel) return;

  vaultChannel = new BroadcastChannel('vlaina-vault');

  vaultChannel.onmessage = (event) => {
    const { type, requestId, vaultPath, responseLabel } = event.data;

    if (type === 'query' && windowVaultPath === vaultPath && windowLabel) {
      vaultChannel?.postMessage({
        type: 'response',
        requestId,
        responseLabel: windowLabel,
      });
    } else if (type === 'response' && pendingQueries.has(requestId)) {
      const resolve = pendingQueries.get(requestId);
      pendingQueries.delete(requestId);
      resolve?.(responseLabel);
    }
  };
}

export async function queryVaultOpenInOtherWindow(path: string): Promise<string | null> {
  const normalizedPath = normalizeVaultPath(path);
  const requestId = `req-${crypto.randomUUID()}`;

  return new Promise((resolve) => {
    pendingQueries.set(requestId, resolve);

    vaultChannel?.postMessage({
      type: 'query',
      requestId,
      vaultPath: normalizedPath,
    });

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

  const normalizedPath = normalizeVaultPath(path);
  const normalizedCurrentVault = normalizeVaultInfo(currentVault);
  const normalizedCurrentVaultPath = normalizeVaultPath(normalizedCurrentVault.path);
  if (!normalizedPath || normalizedPath === normalizedCurrentVaultPath) return;
  void moveVaultSystemStore(normalizedCurrentVaultPath, normalizedPath);

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

  saveToStorage(VAULTS_STORAGE_KEY, nextRecentVaults);
  saveToStorage(CURRENT_VAULT_KEY, nextVault.id);

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
  void saveStarredRegistry(nextStarredEntries);

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
  const updatedRecent = recentVaults.filter((vault) => vault.id !== id);

  saveToStorage(VAULTS_STORAGE_KEY, updatedRecent);

  if (currentVault?.id === id) {
    saveToStorage(CURRENT_VAULT_KEY, null);
    set({ currentVault: null, recentVaults: updatedRecent });
  } else {
    set({ recentVaults: updatedRecent });
  }
}

export function closeCurrentVaultAction(set: (state: { currentVault: VaultInfo | null }) => void) {
  saveToStorage(CURRENT_VAULT_KEY, null);
  setWindowVaultPath(null);
  setCurrentVaultPath(null);
  set({ currentVault: null });
}
