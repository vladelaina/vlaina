import type { ShortcutConfig } from './types';
import { DEFAULT_SHORTCUTS } from './config';

const STORAGE_KEY = 'nekotick-shortcuts';

export function getShortcuts(): ShortcutConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const userShortcuts: ShortcutConfig[] = JSON.parse(stored);
      return DEFAULT_SHORTCUTS.map(defaultConfig => {
        const userConfig = userShortcuts.find(s => s.id === defaultConfig.id);
        return userConfig ? { ...defaultConfig, keys: userConfig.keys } : defaultConfig;
      });
    }
  } catch (e) {
    console.error('Failed to load shortcuts:', e);
  }
  return DEFAULT_SHORTCUTS;
}

export function getShortcutKeys(id: string): string[] | undefined {
  const shortcuts = getShortcuts();
  return shortcuts.find(s => s.id === id)?.keys;
}

export function saveShortcuts(shortcuts: ShortcutConfig[]): void {
  try {
    const toSave = shortcuts.map(({ id, keys }) => ({ id, keys }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error('Failed to save shortcuts:', e);
  }
}

export function resetShortcuts(): void {
  localStorage.removeItem(STORAGE_KEY);
}
