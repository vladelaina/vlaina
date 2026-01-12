/**
 * Path Management for Storage Directories
 * 
 * Cross-platform path utilities using StorageAdapter:
 * - Desktop (Tauri): Uses system app data directory
 *   - Windows: C:\Users\{user}\AppData\Roaming\NekoTick
 *   - macOS:   ~/Library/Application Support/NekoTick
 *   - Linux:   ~/.local/share/NekoTick
 * - Web: Uses virtual path /nekotick
 */

import { getStorageAdapter, joinPath } from './adapter';

// Dynamic path management - initialized on first use
let basePath: string | null = null;

/**
 * Get the base path, initializing if necessary
 * Uses system-standard app data directory for cross-platform compatibility
 */
export async function getBasePath(): Promise<string> {
  if (basePath === null) {
    const storage = getStorageAdapter();
    const appData = await storage.getBasePath();
    // Remove trailing slash
    basePath =
      appData.endsWith('\\') || appData.endsWith('/') ? appData.slice(0, -1) : appData;
  }
  return basePath;
}

/**
 * Get all storage paths dynamically
 * 
 * Structure (Unified Single-File Architecture):
 *   NekoTick/
 *   ├── .nekotick/           <- Hidden metadata
 *   │   ├── assets/          <- Binary assets (images)
 *   │   │   └── covers/
 *   │   └── store/           <- JSON data files
 *   │       └── data.json    <- Source of truth (all app data)
 *   └── nekotick.md          <- Human-readable backup
 */
export async function getPaths() {
  const base = await getBasePath();
  return {
    base,
    metadata: await joinPath(base, '.nekotick'),
    store: await joinPath(base, '.nekotick', 'store'),
    dataJson: await joinPath(base, '.nekotick', 'store', 'data.json'),
    markdown: await joinPath(base, 'nekotick.md'),
  };
}

/**
 * Ensure storage directories exist
 */
export async function ensureDirectories(): Promise<void> {
  try {
    const storage = getStorageAdapter();
    const base = await getBasePath();
    const storeDir = await joinPath(base, '.nekotick', 'store');
    
    if (!(await storage.exists(storeDir))) {
      await storage.mkdir(storeDir, true);
    }
  } catch (error) {
    console.error('Failed to create directories:', error);
  }
}
