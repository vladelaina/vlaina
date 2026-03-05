import { create } from 'zustand';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getStorageAdapter, joinPath, isTauri } from '@/lib/storage/adapter';
import { setCurrentVaultPath } from './useNotesStore';

const NEKOTICK_CONFIG_FOLDER = '.nekotick';
const STORE_FOLDER = 'store';

const DEFAULT_VAULT_CONFIG = {
  version: 1,
  created: Date.now(),
};

const DEFAULT_WORKSPACE_STATE = {
  lastOpenedFile: null,
  sidebarCollapsed: false,
};

const WELCOME_NOTE_NAME = 'Welcome';
const WELCOME_NOTE_CONTENT = `# Welcome

Ciallo～(∠・ω<)⌒★

This is your new vault.
`;

async function initVaultConfig(vaultPath: string): Promise<void> {
  const storage = getStorageAdapter();
  const storePath = await joinPath(vaultPath, NEKOTICK_CONFIG_FOLDER, STORE_FOLDER);

  if (await storage.exists(storePath)) return;

  await storage.mkdir(storePath, true);

  const configFilePath = await joinPath(storePath, 'config.json');
  await storage.writeFile(configFilePath, JSON.stringify(DEFAULT_VAULT_CONFIG, null, 2));

  const workspacePath = await joinPath(storePath, 'workspace.json');
  await storage.writeFile(workspacePath, JSON.stringify(DEFAULT_WORKSPACE_STATE, null, 2));
}

async function createWelcomeNote(vaultPath: string): Promise<void> {
  const storage = getStorageAdapter();
  const fileName = `${WELCOME_NOTE_NAME}.md`;
  const welcomePath = await joinPath(vaultPath, fileName);

  if (await storage.exists(welcomePath)) return;

  await storage.writeFile(welcomePath, WELCOME_NOTE_CONTENT);

  const metadataPath = await joinPath(vaultPath, NEKOTICK_CONFIG_FOLDER, STORE_FOLDER, 'metadata.json');
  const metadata = {
    version: 1,
    notes: {
      [fileName]: { icon: '🎀' }
    }
  };
  await storage.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
}

export interface VaultInfo {
  id: string;
  name: string;
  path: string;
  lastOpened: number;
}

interface VaultState {
  currentVault: VaultInfo | null;
  recentVaults: VaultInfo[];
  isLoading: boolean;
  error: string | null;
}

interface VaultActions {
  initialize: () => Promise<void>;
  openVault: (path: string, name?: string) => Promise<boolean>;
  createVault: (name: string, path: string) => Promise<boolean>;
  removeFromRecent: (id: string) => void;
  closeVault: () => void;
  clearError: () => void;
  checkVaultOpenInOtherWindow: (path: string) => Promise<string | null>;
}

type VaultStore = VaultState & VaultActions;

const VAULTS_STORAGE_KEY = 'nekotick-vaults';
const CURRENT_VAULT_KEY = 'nekotick-current-vault';
const MAX_RECENT_VAULTS = 5;

function generateId(): string {
  return `vault_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function getVaultName(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || 'Untitled';
}

function isNativeFilesystemPath(path: string): boolean {
  if (/^[a-zA-Z]:[\\/]/.test(path)) return true;
  if (path.startsWith('~')) return true;
  if (/^\/(?:Users|home|var|etc|usr|opt|tmp|root|mnt|media|System|Library|Applications|Volumes)(?:\/|$)/i.test(path)) return true;
  return false;
}

let windowVaultPath: string | null = null;
let windowLabel: string | null = null;
let vaultChannel: BroadcastChannel | null = null;
let pendingQueries: Map<string, (label: string | null) => void> = new Map();

function setupBroadcastChannel() {
  if (vaultChannel) return;

  vaultChannel = new BroadcastChannel('nekotick-vault');

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

async function getCurrentWindowLabel(): Promise<string | null> {
  if (!isTauri()) return null;

  try {
    return getCurrentWindow().label;
  } catch {
    return null;
  }
}

export const useVaultStore = create<VaultStore>()((set, get) => ({
  currentVault: null,
  recentVaults: [],
  isLoading: false,
  error: null,

  initialize: async () => {
    const storage = getStorageAdapter();
    const savedVaults = loadFromStorage<VaultInfo[]>(VAULTS_STORAGE_KEY, []);
    const currentVaultId = loadFromStorage<string | null>(CURRENT_VAULT_KEY, null);
    const isWebPlatform = storage.platform === 'web';

    windowLabel = await getCurrentWindowLabel();

    const urlParams = new URLSearchParams(window.location.search);
    const isNewWindow = urlParams.get('newWindow') === 'true';

    const existChecks = await Promise.all(
      savedVaults.map(async (v) => {
        if (isWebPlatform && isNativeFilesystemPath(v.path)) {
          return { vault: v, exists: false };
        }
        return { vault: v, exists: await storage.exists(v.path) };
      })
    );
    const recentVaults = existChecks.filter((c) => c.exists).map((c) => c.vault);

    if (recentVaults.length !== savedVaults.length) {
      saveToStorage(VAULTS_STORAGE_KEY, recentVaults);
    }

    let currentVault: VaultInfo | null = null;
    if (currentVaultId && !isNewWindow) {
      currentVault = recentVaults.find((v) => v.id === currentVaultId) || null;
      if (currentVault) {
        windowVaultPath = currentVault.path;
        setCurrentVaultPath(currentVault.path);
      } else {
        saveToStorage(CURRENT_VAULT_KEY, null);
      }
    }

    setupBroadcastChannel();

    set({ recentVaults, currentVault });
  },

  checkVaultOpenInOtherWindow: async (path: string): Promise<string | null> => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    return new Promise((resolve) => {
      pendingQueries.set(requestId, resolve);

      vaultChannel?.postMessage({
        type: 'query',
        requestId,
        vaultPath: path,
      });

      setTimeout(() => {
        if (pendingQueries.has(requestId)) {
          pendingQueries.delete(requestId);
          resolve(null);
        }
      }, 150);
    });
  },

  openVault: async (path: string, name?: string) => {
    set({ isLoading: true, error: null });

    try {
      const storage = getStorageAdapter();

      if (storage.platform === 'web' && isNativeFilesystemPath(path)) {
        set({ error: 'Invalid path for web platform', isLoading: false });
        return false;
      }

      const pathExists = await storage.exists(path);
      if (!pathExists) {
        set({ error: 'Folder does not exist or cannot be accessed', isLoading: false });
        return false;
      }

      await initVaultConfig(path);

      const { recentVaults } = get();
      const vaultName = name || getVaultName(path);

      let vault = recentVaults.find((v) => v.path === path);

      if (vault) {
        vault = { ...vault, lastOpened: Date.now() };
      } else {
        vault = {
          id: generateId(),
          name: vaultName,
          path,
          lastOpened: Date.now(),
        };
      }

      const updatedRecent = [vault, ...recentVaults.filter((v) => v.path !== path)].slice(
        0,
        MAX_RECENT_VAULTS
      );

      saveToStorage(VAULTS_STORAGE_KEY, updatedRecent);
      saveToStorage(CURRENT_VAULT_KEY, vault.id);

      set({
        currentVault: vault,
        recentVaults: updatedRecent,
        isLoading: false,
      });

      windowVaultPath = vault.path;
      setCurrentVaultPath(vault.path);

      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to open vault',
        isLoading: false,
      });
      return false;
    }
  },

  createVault: async (name: string, path: string) => {
    set({ isLoading: true, error: null });

    try {
      const storage = getStorageAdapter();

      const pathExists = await storage.exists(path);
      if (!pathExists) {
        await storage.mkdir(path, true);
      }

      await initVaultConfig(path);
      await createWelcomeNote(path);

      return await get().openVault(path, name);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create vault',
        isLoading: false,
      });
      return false;
    }
  },

  removeFromRecent: (id: string) => {
    const { recentVaults, currentVault } = get();
    const updatedRecent = recentVaults.filter((v) => v.id !== id);

    saveToStorage(VAULTS_STORAGE_KEY, updatedRecent);

    if (currentVault?.id === id) {
      saveToStorage(CURRENT_VAULT_KEY, null);
      set({ currentVault: null, recentVaults: updatedRecent });
    } else {
      set({ recentVaults: updatedRecent });
    }
  },

  closeVault: () => {
    saveToStorage(CURRENT_VAULT_KEY, null);
    windowVaultPath = null;
    setCurrentVaultPath(null);
    set({ currentVault: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
