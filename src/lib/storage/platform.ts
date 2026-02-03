export type Platform = 'tauri' | 'web';

export function getPlatform(): Platform {
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

export async function platformSwitch<T>(handlers: {
  tauri: () => T | Promise<T>;
  web: () => T | Promise<T>;
}): Promise<T> {
  const platform = getPlatform();
  return handlers[platform]();
}

export async function tauriOnly<T>(fn: () => T | Promise<T>): Promise<T | undefined> {
  if (isTauri()) {
    return fn();
  }
  return undefined;
}

export async function webOnly<T>(fn: () => T | Promise<T>): Promise<T | undefined> {
  if (isWeb()) {
    return fn();
  }
  return undefined;
}

export function platformValue<T>(values: { tauri: T; web: T }): T {
  return values[getPlatform()];
}
