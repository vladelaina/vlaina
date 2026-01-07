import type { ShortcutConfig } from './types';
import { DEFAULT_SHORTCUTS } from './config';

const STORAGE_KEY = 'nekotick-shortcuts';
const MIGRATION_KEY = 'nekotick-shortcuts-migration-v1';

// Migrate old shortcuts that conflict with editor shortcuts
function migrateShortcuts(): void {
  if (localStorage.getItem(MIGRATION_KEY)) return;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const userShortcuts: ShortcutConfig[] = JSON.parse(stored);
      // Remove old Ctrl+K binding for open-settings (now uses Ctrl+,)
      const filtered = userShortcuts.filter(s => {
        if (s.id === 'open-settings') {
          const keys = s.keys?.map(k => k.toLowerCase()) || [];
          // Remove if it was Ctrl+K
          if (keys.includes('ctrl') && keys.includes('k') && keys.length === 2) {
            return false;
          }
        }
        return true;
      });
      if (filtered.length !== userShortcuts.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      }
    }
  } catch (e) {
    console.error('Failed to migrate shortcuts:', e);
  }
  
  localStorage.setItem(MIGRATION_KEY, '1');
}

export function getShortcuts(): ShortcutConfig[] {
  // Run migration on first access
  migrateShortcuts();
  
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
