import type { ShortcutConfig } from './types';

/**
 * Default keyboard shortcuts configuration.
 * 
 * 'isSystem' flag indicates core application shell shortcuts that should be:
 * 1. Consistent across all installations (Convention over Configuration).
 * 2. Hidden from user customization to prevent conflicts with OS or critical app functions.
 */
export const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
  // Global Navigation & Actions
  { id: 'globalSearch', keys: ['Ctrl', 'F'], description: 'Global Search', scope: 'global', isSystem: true },
  
  // App Specific
  { id: 'newTab', keys: ['Ctrl', 'T'], description: 'New tab', scope: 'notes' },
  { id: 'toggleTemporaryChatWelcome', keys: ['Ctrl', 'Shift', 'J'], description: 'Open temporary chat (toggle if empty)', scope: 'chat', isSystem: true },
  
  // Actions
  { id: 'toggleDrawer', keys: ['Ctrl', 'D'], description: 'Toggle drawer', scope: 'global' },
  { id: 'archiveCompleted', keys: ['Ctrl', 'Shift', 'E'], description: 'Archive completed tasks', scope: 'global' },
  { id: 'openArchive', keys: ['Ctrl', 'Shift', 'A'], description: 'Open archive', scope: 'global' },
  { id: 'open-settings', keys: ['Ctrl', ','], description: 'Open settings', scope: 'global', isSystem: true },
  { id: 'newWindow', keys: ['Ctrl', 'Shift', 'N'], description: 'New Window', scope: 'global', isSystem: true },
];
