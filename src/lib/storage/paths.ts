/**
 * Path Management for Storage Directories
 * 
 * Uses system-standard app data location:
 * - Windows: C:\Users\{user}\AppData\Roaming\NekoTick
 * - macOS:   ~/Library/Application Support/NekoTick
 * - Linux:   ~/.local/share/NekoTick
 * 
 * This follows platform conventions and keeps user's visible folders clean.
 */

import { mkdir, exists } from '@tauri-apps/plugin-fs';
import { appDataDir } from '@tauri-apps/api/path';

// Dynamic path management - initialized on first use
let basePath: string | null = null;

/**
 * Get the base path, initializing if necessary
 * Uses system-standard app data directory for cross-platform compatibility
 */
export async function getBasePath(): Promise<string> {
  if (basePath === null) {
    const appData = await appDataDir();
    // appDataDir already returns the correct path for each platform
    // It typically ends with the app name from tauri.conf.json
    basePath = appData.endsWith('\\') || appData.endsWith('/') 
      ? appData.slice(0, -1)  // Remove trailing slash
      : appData;
  }
  return basePath;
}

/**
 * Get all storage paths dynamically
 * 
 * Structure:
 *   NekoTick/
 *   ├── .nekotick/           <- Hidden metadata (app-only data)
 *   │   ├── progress.json    <- Progress metadata
 *   │   ├── tasks.json       <- Tasks metadata  
 *   │   └── sync-status.json <- Future: sync state
 *   ├── progress/            <- User-readable content
 *   │   └── progress.md
 *   ├── tasks/
 *   ├── archive/
 *   └── time-tracker/
 */
export async function getPaths() {
  const base = await getBasePath();
  return {
    base,
    // Hidden metadata folder (like .obsidian)
    metadata: `${base}\\.nekotick`,
    // User-visible content folders
    tasks: `${base}\\tasks`,
    progress: `${base}\\progress`,
    timeTracker: `${base}\\time-tracker`,
    archive: `${base}\\archive`,
  };
}

/**
 * Ensure all storage directories exist
 */
export async function ensureDirectories(): Promise<void> {
  try {
    const paths = await getPaths();
    for (const path of Object.values(paths)) {
      if (!(await exists(path))) {
        await mkdir(path, { recursive: true });
      }
    }
  } catch (error) {
    console.error('Failed to create directories:', error);
  }
}
