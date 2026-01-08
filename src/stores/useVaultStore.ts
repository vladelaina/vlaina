/**
 * Vault Store - Multi-vault management
 * 
 * Cross-platform vault management using StorageAdapter
 */

import { create } from 'zustand';
import { getStorageAdapter, joinPath, isTauri } from '@/lib/storage/adapter';
import { setCurrentVaultPath } from './useNotesStore';

// .nekotick folder name (like Obsidian's .obsidian)
const NEKOTICK_CONFIG_FOLDER = '.nekotick';

// Default config files for a new vault
const DEFAULT_VAULT_CONFIG = {
  version: 1,
  created: Date.now(),
};

const DEFAULT_WORKSPACE_STATE = {
  lastOpenedFile: null,
  sidebarCollapsed: false,
};

// Welcome note content
const WELCOME_NOTE_NAME = 'Welcome';
const WELCOME_NOTE_CONTENT = `# Welcome

Ciallo～(∠・ω<)⌒★

This is your new vault.
`;

/**
 * Initialize .nekotick config folder in a vault
 */
async function initVaultConfig(vaultPath: string): Promise<void> {
  const storage = getStorageAdapter();
  const configPath = await joinPath(vaultPath, NEKOTICK_CONFIG_FOLDER);

  // Check if config folder exists
  if (await storage.exists(configPath)) return;

  // Create .nekotick folder
  await storage.mkdir(configPath, true);

  // Create default config files
  const configFilePath = await joinPath(configPath, 'config.json');
  await storage.writeFile(configFilePath, JSON.stringify(DEFAULT_VAULT_CONFIG, null, 2));

  const workspacePath = await joinPath(configPath, 'workspace.json');
  await storage.writeFile(workspacePath, JSON.stringify(DEFAULT_WORKSPACE_STATE, null, 2));
}

/**
 * Create welcome note in a new vault
 */
async function createWelcomeNote(vaultPath: string): Promise<void> {
  const storage = getStorageAdapter();
  const fileName = `${WELCOME_NOTE_NAME}.md`;
  const welcomePath = await joinPath(vaultPath, fileName);

  // Only create if doesn't exist
  if (await storage.exists(welcomePath)) return;

  await storage.writeFile(welcomePath, WELCOME_NOTE_CONTENT);

  // Set the ribbon icon for welcome note
  const iconsPath = await joinPath(vaultPath, NEKOTICK_CONFIG_FOLDER, 'icons.json');
  const icons: Record<string, string> = {};
  icons[fileName] = '🎀';
  await storage.writeFile(iconsPath, JSON.stringify(icons, null, 2));
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

/**
 * Check if a path is a native filesystem path (Windows/macOS/Linux absolute path)
 * These paths are not valid in web environment
 */
function isNativeFilesystemPath(path: string): boolean {
  // Windows absolute path (C:\, D:\, etc.)
  if (/^[a-zA-Z]:[\\/]/.test(path)) return true;
  // Home directory path
  if (path.startsWith('~')) return true;
  // Unix absolute path starting with / followed by typical system directories
  // These are clearly native filesystem paths, not web virtual paths
  if (/^\/(?:Users|home|var|etc|usr|opt|tmp|root|mnt|media|System|Library|Applications|Volumes)(?:\/|$)/i.test(path)) return true;
  return false;
}

// Track which vault this window has open (window-specific)
let windowVaultPath: string | null = null;
let windowLabel: string | null = null;

// BroadcastChannel for cross-window communication
let vaultChannel: BroadcastChannel | null = null;
let pendingQueries: Map<string, (label: string | null) => void> = new Map();

function setupBroadcastChannel() {
  if (vaultChannel) return;

  vaultChannel = new BroadcastChannel('nekotick-vault');

  vaultChannel.onmessage = (event) => {
    const { type, requestId, vaultPath, responseLabel } = event.data;

    if (type === 'query' && windowVaultPath === vaultPath && windowLabel) {
      // This window has the vault open, respond
      vaultChannel?.postMessage({
        type: 'response',
        requestId,
        responseLabel: windowLabel,
      });
    } else if (type === 'response' && pendingQueries.has(requestId)) {
      // Got a response to our query
      const resolve = pendingQueries.get(requestId);
      pendingQueries.delete(requestId);
      resolve?.(responseLabel);
    }
  };
}

/**
 * Get current window label (Tauri only)
 */
async function getCurrentWindowLabel(): Promise<string | null> {
  if (!isTauri()) return null;
  
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
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

    // Get current window label (Tauri only)
    windowLabel = await getCurrentWindowLabel();

    // Check if this is a new window (should show welcome screen)
    const urlParams = new URLSearchParams(window.location.search);
    const isNewWindow = urlParams.get('newWindow') === 'true';

    // Filter out vaults that no longer exist
    // On web platform, also filter out native filesystem paths (Windows/macOS/Linux absolute paths)
    const existChecks = await Promise.all(
      savedVaults.map(async (v) => {
        // On web, reject native filesystem paths
        if (isWebPlatform && isNativeFilesystemPath(v.path)) {
          return { vault: v, exists: false };
        }
        return { vault: v, exists: await storage.exists(v.path) };
      })
    );
    const recentVaults = existChecks.filter((c) => c.exists).map((c) => c.vault);

    // Update storage if some vaults were removed
    if (recentVaults.length !== savedVaults.length) {
      saveToStorage(VAULTS_STORAGE_KEY, recentVaults);
    }

    let currentVault: VaultInfo | null = null;
    if (currentVaultId && !isNewWindow) {
      currentVault = recentVaults.find((v) => v.id === currentVaultId) || null;
      if (currentVault) {
        windowVaultPath = currentVault.path;
        // Set the vault path for notes store
        setCurrentVaultPath(currentVault.path);
      } else {
        // Current vault was deleted, clear it
        saveToStorage(CURRENT_VAULT_KEY, null);
      }
    }

    // Setup cross-window communication
    setupBroadcastChannel();

    set({ recentVaults, currentVault });
  },

  // Check if a vault is already open in another window
  checkVaultOpenInOtherWindow: async (path: string): Promise<string | null> => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    return new Promise((resolve) => {
      // Store the resolver
      pendingQueries.set(requestId, resolve);

      // Send query via BroadcastChannel
      vaultChannel?.postMessage({
        type: 'query',
        requestId,
        vaultPath: path,
      });

      // Timeout after 150ms - if no response, vault is not open elsewhere
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
      
      // On web platform, reject native filesystem paths
      if (storage.platform === 'web' && isNativeFilesystemPath(path)) {
        set({ error: 'Invalid path for web platform', isLoading: false });
        return false;
      }
      
      // Verify path exists
      const pathExists = await storage.exists(path);
      if (!pathExists) {
        set({ error: 'Folder does not exist or cannot be accessed', isLoading: false });
        return false;
      }

      // Ensure .nekotick config folder exists (for existing folders opened as vault)
      await initVaultConfig(path);

      const { recentVaults } = get();
      const vaultName = name || getVaultName(path);

      // Check if already in recent
      let vault = recentVaults.find((v) => v.path === path);

      if (vault) {
        // Update lastOpened
        vault = { ...vault, lastOpened: Date.now() };
      } else {
        // Create new entry
        vault = {
          id: generateId(),
          name: vaultName,
          path,
          lastOpened: Date.now(),
        };
      }

      // Update recent list
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

      // Update notes store path and track in this window
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
      
      // Create directory if not exists
      const pathExists = await storage.exists(path);
      if (!pathExists) {
        await storage.mkdir(path, true);
      }

      // Initialize .nekotick config folder
      await initVaultConfig(path);

      // Create welcome note
      await createWelcomeNote(path);

      // Open the vault
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

    // If removing current vault, clear it
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
