import type { ShortcutConfig } from './types';

export const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
  { id: 'toggleSidebar', keys: ['Ctrl', '\\'], description: 'Toggle sidebar', scope: 'global', isSystem: true },
  { id: 'globalSearch', keys: ['Ctrl', 'F'], description: 'Global Search', scope: 'global', isSystem: true },

  { id: 'newTab', keys: ['Ctrl', 'T'], description: 'New tab', scope: 'notes' },
  { id: 'toggleTemporaryChatWelcome', keys: ['Ctrl', 'Shift', 'J'], description: 'Open temporary chat (toggle if empty)', scope: 'chat', isSystem: true },

  { id: 'toggleDrawer', keys: ['Ctrl', 'D'], description: 'Toggle drawer', scope: 'global' },
  { id: 'open-settings', keys: ['Ctrl', ','], description: 'Open settings', scope: 'global', isSystem: true },
  { id: 'newWindow', keys: ['Ctrl', 'Shift', 'N'], description: 'New Window', scope: 'global', isSystem: true },
];
