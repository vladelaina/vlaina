import { hasElectronDesktopBridge } from '@/lib/desktop/backend';

export type Platform = 'electron' | 'web';

export function getPlatform(): Platform {
  if (hasElectronDesktopBridge()) {
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

export async function platformSwitch<T>(handlers: {
  electron: () => T | Promise<T>;
  web: () => T | Promise<T>;
}): Promise<T> {
  return handlers[getPlatform()]();
}

export async function electronOnly<T>(fn: () => T | Promise<T>): Promise<T | undefined> {
  if (isElectron()) {
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

export function platformValue<T>(values: { electron: T; web: T }): T {
  return values[getPlatform()];
}
