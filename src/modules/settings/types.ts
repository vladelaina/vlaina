/**
 * Settings Module Types
 * 设置模块类型定义
 */

export type SettingsTab = 'appearance' | 'shortcuts' | 'storage' | 'about';

export interface SettingsTabConfig {
  id: SettingsTab;
  label: string;
}

export interface ShortcutConfig {
  id: string;
  name: string;
  keys: string[];
  description?: string;
}
