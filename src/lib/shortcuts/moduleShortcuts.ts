import { DEFAULT_SHORTCUTS } from './config';

export type ModuleShortcutId = 'notes' | 'chat';

export interface ModuleShortcutItem {
  action: string;
  keys: string[];
}

export interface ModuleShortcutSection {
  title: string;
  shortcuts: ModuleShortcutItem[];
}

export interface ModuleShortcutPreset {
  title: string;
  description: string;
  sections: ModuleShortcutSection[];
}

interface ModuleShortcutPresetOptions {
  isMac?: boolean;
}

const SHORTCUTS_BY_ID = new Map(DEFAULT_SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]));

function resolveShortcutKeys(id: string, fallbackKeys: string[]): string[] {
  return SHORTCUTS_BY_ID.get(id)?.keys ?? fallbackKeys;
}

const COMMON_SECTIONS: ModuleShortcutSection[] = [
  {
    title: 'General',
    shortcuts: [
      { action: 'Show shortcuts', keys: ['Ctrl', '/'] },
      { action: 'Toggle sidebar', keys: resolveShortcutKeys('toggleSidebar', ['Ctrl', '\\']) },
      { action: 'Global search', keys: resolveShortcutKeys('globalSearch', ['Ctrl', 'F']) },
      { action: 'Toggle drawer', keys: resolveShortcutKeys('toggleDrawer', ['Ctrl', 'D']) },
      { action: 'Open settings', keys: resolveShortcutKeys('open-settings', ['Ctrl', ',']) },
      { action: 'New window', keys: resolveShortcutKeys('newWindow', ['Ctrl', 'Shift', 'N']) },
    ],
  },
];

function createChatSections(isMac: boolean): ModuleShortcutSection[] {
  const deleteKey = isMac ? '⌫' : 'Backspace';
  return [
    {
      title: 'Chat',
      shortcuts: [
        { action: 'Open new chat', keys: ['Ctrl', 'Shift', 'O'] },
        {
          action: 'Open temporary chat (toggle if empty)',
          keys: resolveShortcutKeys('toggleTemporaryChatWelcome', ['Ctrl', 'Shift', 'J']),
        },
        { action: 'Stop response', keys: ['Esc'] },
        { action: 'Focus chat input', keys: ['Shift', 'Esc'] },
        { action: 'Previous chat', keys: ['Ctrl', 'Shift', 'Tab'] },
        { action: 'Next chat', keys: ['Ctrl', 'Tab'] },
        { action: 'Copy last code block', keys: ['Ctrl', 'Shift', ';'] },
        { action: 'Copy last response', keys: ['Ctrl', 'Shift', 'C'] },
        { action: 'Previous message', keys: ['Shift', '↑'] },
        { action: 'Next message', keys: ['Shift', '↓'] },
        { action: 'Delete chat', keys: ['Ctrl', 'Shift', deleteKey] },
      ],
    },
    ...COMMON_SECTIONS,
  ];
}

const NOTES_SECTIONS: ModuleShortcutSection[] = [
  {
    title: 'Notes',
    shortcuts: [
      { action: 'New note tab', keys: resolveShortcutKeys('newTab', ['Ctrl', 'T']) },
      { action: 'Close current tab', keys: ['Ctrl', 'W'] },
      { action: 'Next tab', keys: ['Ctrl', 'Tab'] },
      { action: 'Previous tab', keys: ['Ctrl', 'Shift', 'Tab'] },
      { action: 'Save note', keys: ['Ctrl', 'S'] },
      { action: 'Toggle embedded chat', keys: ['Ctrl', 'L'] },
    ],
  },
  ...COMMON_SECTIONS,
];

export function getModuleShortcutPreset(
  module: ModuleShortcutId,
  options: ModuleShortcutPresetOptions = {},
): ModuleShortcutPreset {
  const isMac = options.isMac === true;

  switch (module) {
    case 'notes':
      return {
        title: 'Keyboard shortcuts',
        description: 'Available keyboard shortcuts for Notes.',
        sections: NOTES_SECTIONS,
      };
    case 'chat':
    default:
      return {
        title: 'Keyboard shortcuts',
        description: 'Available keyboard shortcuts for Chat.',
        sections: createChatSections(isMac),
      };
  }
}
