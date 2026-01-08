/**
 * Storage Adapter Factory
 * 
 * Provides unified access to storage across platforms
 */

import type { StorageAdapter } from './types';
import { TauriAdapter } from './TauriAdapter';
import { WebAdapter } from './WebAdapter';

export type { StorageAdapter, FileInfo, WriteOptions, ReadOptions, ListOptions } from './types';
export { TauriAdapter } from './TauriAdapter';
export { WebAdapter } from './WebAdapter';
export * from './pathUtils';

// Singleton instance
let adapterInstance: StorageAdapter | null = null;

/**
 * Detect current platform
 */
export function getPlatform(): 'tauri' | 'web' {
  if (typeof window === 'undefined') return 'web';
  
  // Check for Tauri 2.x first, then fallback to 1.x
  if ('__TAURI_INTERNALS__' in window || '__TAURI__' in window) {
    return 'tauri';
  }
  
  return 'web';
}

/**
 * Check if running in Tauri desktop environment
 */
export function isTauri(): boolean {
  return getPlatform() === 'tauri';
}

/**
 * Check if running in web browser environment
 */
export function isWeb(): boolean {
  return getPlatform() === 'web';
}

/**
 * Get the storage adapter for current platform
 * Uses singleton pattern for efficiency
 */
export function getStorageAdapter(): StorageAdapter {
  if (!adapterInstance) {
    const platform = getPlatform();
    adapterInstance = platform === 'tauri' 
      ? new TauriAdapter() 
      : new WebAdapter();
    
    console.log(`[Storage] Initialized ${platform} adapter`);
  }
  return adapterInstance;
}

/**
 * Reset adapter instance (useful for testing)
 */
export function resetStorageAdapter(): void {
  adapterInstance = null;
}

/**
 * Async join path - compatible with both platforms
 * On Tauri, uses native path joining
 * On Web, uses simple string joining
 */
export async function joinPath(...segments: string[]): Promise<string> {
  if (isTauri()) {
    const { join } = await import('@tauri-apps/api/path');
    return join(...segments);
  }
  
  const { joinPath: simpleJoin } = await import('./pathUtils');
  return simpleJoin(...segments);
}
