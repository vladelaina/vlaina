import type { ShortcutConfig } from './types';

export const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
  // Notes view
  { id: 'toggleSidebar', keys: ['Ctrl', 'Shift', 'B'], description: 'Toggle sidebar', scope: 'notes' },
  { id: 'newTab', keys: ['Ctrl', 'T'], description: 'New tab', scope: 'notes' },
  
  // Global
  { id: 'toggleDrawer', keys: ['Ctrl', 'D'], description: 'Toggle drawer', scope: 'global' },
  { id: 'archiveCompleted', keys: ['Ctrl', 'Shift', 'E'], description: 'Archive completed tasks', scope: 'global' },
  { id: 'openArchive', keys: ['Ctrl', 'Shift', 'A'], description: 'Open archive', scope: 'global' },
  { id: 'open-settings', keys: ['Ctrl', ','], description: 'Open settings', scope: 'global' },
];
