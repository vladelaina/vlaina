import type { StorageAdapter } from './types';
import { ElectronAdapter } from './ElectronAdapter';
import { WebAdapter } from './WebAdapter';
import { joinPath as simpleJoin } from './pathUtils';

export type { StorageAdapter, FileInfo, WriteOptions, ReadOptions, ListOptions } from './types';
export { ElectronAdapter } from './ElectronAdapter';
export { WebAdapter } from './WebAdapter';
export * from './pathUtils';

let adapterInstance: StorageAdapter | null = null;

export function getPlatform(): 'electron' | 'web' {
  if (typeof window === 'undefined') return 'web';

  if ('__VL_ELECTRON__' in window || 'vlainaDesktop' in window) {
    return 'electron';
  }

  return 'web';
}

export function isElectron(): boolean {
  return getPlatform() === 'electron';
}

export function isWeb(): boolean {
  return getPlatform() === 'web';
}

export function getStorageAdapter(): StorageAdapter {
  if (!adapterInstance) {
    const platform = getPlatform();
    adapterInstance = platform === 'electron'
      ? new ElectronAdapter()
      : new WebAdapter();
  }

  return adapterInstance;
}

export function resetStorageAdapter(): void {
  adapterInstance = null;
}

export async function joinPath(...segments: string[]): Promise<string> {
  if (isElectron()) {
    const bridge = window.vlainaDesktop;
    if (!bridge) {
      throw new Error('Electron path bridge is not available.');
    }
    return bridge.path.join(...segments);
  }

  return simpleJoin(...segments);
}
