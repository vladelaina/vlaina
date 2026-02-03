import type { StorageAdapter } from './types';
import { TauriAdapter } from './TauriAdapter';
import { WebAdapter } from './WebAdapter';

export type { StorageAdapter, FileInfo, WriteOptions, ReadOptions, ListOptions } from './types';
export { TauriAdapter } from './TauriAdapter';
export { WebAdapter } from './WebAdapter';
export * from './pathUtils';

let adapterInstance: StorageAdapter | null = null;

export function getPlatform(): 'tauri' | 'web' {
  if (typeof window === 'undefined') return 'web';

  if ('__TAURI_INTERNALS__' in window || '__TAURI__' in window) {
    return 'tauri';
  }

  return 'web';
}

export function isTauri(): boolean {
  return getPlatform() === 'tauri';
}

export function isWeb(): boolean {
  return getPlatform() === 'web';
}

export function getStorageAdapter(): StorageAdapter {
  if (!adapterInstance) {
    const platform = getPlatform();
    adapterInstance = platform === 'tauri'
      ? new TauriAdapter()
      : new WebAdapter();


  }
  return adapterInstance;
}

export function resetStorageAdapter(): void {
  adapterInstance = null;
}

export async function joinPath(...segments: string[]): Promise<string> {
  if (isTauri()) {
    const { join } = await import('@tauri-apps/api/path');
    return join(...segments);
  }

  const { joinPath: simpleJoin } = await import('./pathUtils');
  return simpleJoin(...segments);
}
