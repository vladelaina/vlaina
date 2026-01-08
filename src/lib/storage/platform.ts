/**
 * Platform Detection Utilities
 * 
 * Provides helpers for detecting runtime environment
 * and conditionally executing platform-specific code
 */

export type Platform = 'tauri' | 'web';

/**
 * Detect current platform
 */
export function getPlatform(): Platform {
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
 * Execute platform-specific code
 * 
 * @example
 * const result = await platformSwitch({
 *   tauri: async () => await invoke('some_command'),
 *   web: async () => localStorage.getItem('key'),
 * });
 */
export async function platformSwitch<T>(handlers: {
  tauri: () => T | Promise<T>;
  web: () => T | Promise<T>;
}): Promise<T> {
  const platform = getPlatform();
  return handlers[platform]();
}

/**
 * Execute code only on Tauri platform
 * Returns undefined on web
 */
export async function tauriOnly<T>(fn: () => T | Promise<T>): Promise<T | undefined> {
  if (isTauri()) {
    return fn();
  }
  return undefined;
}

/**
 * Execute code only on web platform
 * Returns undefined on Tauri
 */
export async function webOnly<T>(fn: () => T | Promise<T>): Promise<T | undefined> {
  if (isWeb()) {
    return fn();
  }
  return undefined;
}

/**
 * Get platform-specific value
 */
export function platformValue<T>(values: { tauri: T; web: T }): T {
  return values[getPlatform()];
}
