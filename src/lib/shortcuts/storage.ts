import type { ShortcutConfig } from './types';
import { DEFAULT_SHORTCUTS } from './config';

const STORAGE_KEY = 'vlaina-shortcuts';
const MAX_SHORTCUT_STORAGE_CHARS = 32 * 1024;
const MAX_SHORTCUT_KEY_CHARS = 64;
const MAX_SHORTCUT_KEYS = 8;

const DEFAULT_SHORTCUT_IDS = new Set(DEFAULT_SHORTCUTS.map(({ id }) => id));

function normalizeStoredShortcutMap(value: unknown): Map<string, string[]> {
  const shortcuts = new Map<string, string[]>();
  if (!Array.isArray(value)) {
    return shortcuts;
  }

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id : '';
    if (!DEFAULT_SHORTCUT_IDS.has(id) || !Array.isArray(record.keys)) {
      continue;
    }

    const keys = record.keys
      .filter((key): key is string => typeof key === 'string' && key.length <= MAX_SHORTCUT_KEY_CHARS)
      .slice(0, MAX_SHORTCUT_KEYS);
    shortcuts.set(id, keys);
  }

  return shortcuts;
}

export function getShortcuts(): ShortcutConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored.length > MAX_SHORTCUT_STORAGE_CHARS) {
      return DEFAULT_SHORTCUTS;
    }
    if (stored) {
      const userShortcuts = normalizeStoredShortcutMap(JSON.parse(stored));
      return DEFAULT_SHORTCUTS.map(defaultConfig => {
        const keys = userShortcuts.get(defaultConfig.id);
        return keys ? { ...defaultConfig, keys } : defaultConfig;
      });
    }
  } catch (e) {
  }
  return DEFAULT_SHORTCUTS;
}

export function getShortcutKeys(id: string): string[] | undefined {
  const shortcuts = getShortcuts();
  return shortcuts.find(s => s.id === id)?.keys;
}

export function saveShortcuts(shortcuts: ShortcutConfig[]): void {
  try {
    const toSave = Array.from(normalizeStoredShortcutMap(shortcuts), ([id, keys]) => ({ id, keys }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
  }
}

export function resetShortcuts(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
  }
}
