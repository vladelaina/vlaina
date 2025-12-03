// 快捷键配置管理

export type ShortcutId = 
  | 'toggle-drawer'
  | 'archive-completed'
  | 'open-archive';

export interface ShortcutConfig {
  id: ShortcutId;
  name: string;
  keys: string[]; // 空数组表示未设置
  editable: boolean;
}

const SHORTCUTS_STORAGE_KEY = 'nekotick-shortcuts';

// 默认快捷键配置（全部为空，让用户自己设置）
const defaultShortcuts: ShortcutConfig[] = [
  {
    id: 'toggle-drawer',
    name: '打开/关闭侧边栏',
    keys: [],
    editable: true,
  },
  {
    id: 'archive-completed',
    name: '归档已完成任务',
    keys: [],
    editable: true,
  },
  {
    id: 'open-archive',
    name: '打开归档视图',
    keys: [],
    editable: true,
  },
];

// 获取所有快捷键配置
export function getShortcuts(): ShortcutConfig[] {
  try {
    const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ShortcutConfig[];
      // 合并默认配置和用户配置（防止新增快捷键后丢失）
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

// 获取单个快捷键的按键组合
export function getShortcutKeys(id: ShortcutId): string[] | null {
  const shortcuts = getShortcuts();
  const shortcut = shortcuts.find(s => s.id === id);
  return shortcut?.keys.length ? shortcut.keys : null;
}

// 保存快捷键配置
export function saveShortcuts(shortcuts: ShortcutConfig[]): void {
  try {
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts));
  } catch (error) {
    console.error('Failed to save shortcuts:', error);
  }
}

// 更新单个快捷键
export function updateShortcut(id: ShortcutId, keys: string[]): void {
  const shortcuts = getShortcuts();
  const updated = shortcuts.map(s => 
    s.id === id ? { ...s, keys } : s
  );
  saveShortcuts(updated);
}
