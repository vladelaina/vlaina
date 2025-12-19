// Shortcut configuration management

export type ShortcutId = 
  | 'toggle-drawer'
  | 'archive-completed'
  | 'open-archive'
  | 'open-settings';

export interface ShortcutConfig {
  id: ShortcutId;
  name: string;
  keys: string[]; // Empty array means not set
  editable: boolean;
}

const SHORTCUTS_STORAGE_KEY = 'nekotick-shortcuts';

// Default shortcut configuration (all empty, let users set them)
const defaultShortcuts: ShortcutConfig[] = [
  {
    id: 'open-settings',
    name: 'Open/Close Settings',
    keys: [],
    editable: true,
  },
  {
    id: 'toggle-drawer',
    name: 'Open/Close Sidebar',
    keys: [],
    editable: true,
  },
  {
    id: 'archive-completed',
    name: 'Archive Completed Tasks',
    keys: [],
    editable: true,
  },
  {
    id: 'open-archive',
    name: 'Open Archive View',
    keys: [],
    editable: true,
  },
];

// Get all shortcut configurations
export function getShortcuts(): ShortcutConfig[] {
  try {
    const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ShortcutConfig[];
      // Merge default config with user config (prevent loss when new shortcuts are added)
      const result = defaultShortcuts.map(defaultShortcut => {
        const userShortcut = parsed.find(s => s.id === defaultShortcut.id);
        return userShortcut || defaultShortcut;
      });
      return result;
    }
  } catch (error) {
    console.error('Failed to load shortcuts:', error);
  }
  return defaultShortcuts;
}

// Get key combination for a single shortcut
export function getShortcutKeys(id: ShortcutId): string[] | null {
  const shortcuts = getShortcuts();
  const shortcut = shortcuts.find(s => s.id === id);
  return shortcut?.keys.length ? shortcut.keys : null;
}

// Save shortcut configuration
export function saveShortcuts(shortcuts: ShortcutConfig[]): void {
  try {
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts));
  } catch (error) {
    console.error('Failed to save shortcuts:', error);
  }
}

// Update a single shortcut
export function updateShortcut(id: ShortcutId, keys: string[]): void {
  const shortcuts = getShortcuts();
  const updated = shortcuts.map(s => 
    s.id === id ? { ...s, keys } : s
  );
  saveShortcuts(updated);
}
