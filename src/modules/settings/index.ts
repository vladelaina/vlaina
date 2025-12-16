/**
 * Settings Module - 设置模块
 * 
 * 提供应用设置功能，包括外观、快捷键、存储等配置
 */

// 组件
export {
  SettingsModal,
  LoginDialog,
  AboutTab,
  AppearanceTab,
  ShortcutsTab,
  StorageTab,
} from './components';

// Hooks
export { useModalBehavior, useShortcutEditor } from './hooks';

// 类型
export type { SettingsTab, SettingsTabConfig, ShortcutConfig } from './types';
