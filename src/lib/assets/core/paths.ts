import { dirname, join } from '@tauri-apps/api/path';

/**
 * Resolves the absolute path for a system asset (icon or cover) within the vault.
 * Always targets the .nekotick/assets directory.
 */
export async function resolveSystemAssetPath(
  vaultPath: string, 
  filename: string, 
  category: 'covers' | 'icons'
): Promise<string> {
  const assetsBaseDir = await join(vaultPath, '.nekotick', 'assets');
  
  if (category === 'icons') {
    // Filename usually comes as 'icons/name.png' or just 'name.png'. 
    // If it has prefix, strip it for joining, or just join carefully.
    // Our storage format: icons are stored in 'icons' folder, filenames in DB might be 'icons/foo.png'.
    const name = filename.replace(/^icons[\\/]/, '');
    return join(assetsBaseDir, 'icons', name);
  } else {
    // Covers
    // Filename in DB is usually just 'foo.jpg'.
    return join(assetsBaseDir, 'covers', filename);
  }
}

/**
 * Robustly joins paths ensuring OS-specific separators using Tauri API.
 */
export async function joinPaths(...paths: string[]): Promise<string> {
  return join(...paths);
}

/**
 * Helper to get the directory name of a path.
 */
export async function getDirname(path: string): Promise<string> {
  return dirname(path);
}

// Deprecated synchronous helpers - removing as requested for thorough refactor.
// If valid usage exists elsewhere, it should be migrated to async/await patterns.
