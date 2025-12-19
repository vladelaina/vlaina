/**
 * Settings Module
 * 
 * Provides application settings functionality including appearance, shortcuts, storage, etc.
 */

// Components
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

// Types
export type { SettingsTab, SettingsTabConfig, ShortcutConfig } from './types';
