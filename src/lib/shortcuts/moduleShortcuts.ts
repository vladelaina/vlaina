import { getShortcutDefinitionsForModule } from './registry';
import { getShortcutKeys } from './storage';
import type { ShortcutDefinition, ShortcutModule, ShortcutSection } from './types';
import type { MessageKey } from '@/lib/i18n';

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
  t?: (key: MessageKey) => string;
}

const SECTION_ORDER: Record<ShortcutModule, ShortcutSection[]> = {
  notes: ['Notes', 'Chat', 'General'],
  chat: ['Chat', 'General'],
};

function getResolvedKeys(shortcut: ShortcutDefinition, isMac: boolean): string[] {
  const resolvedKeys = getShortcutKeys(shortcut.id) ?? shortcut.keys;
  if (!isMac) {
    return resolvedKeys;
  }

  return resolvedKeys.map((key) => (shortcut.id === 'deleteChat' && key === 'Backspace' ? '⌫' : key));
}

const SECTION_MESSAGE_KEYS: Record<ShortcutSection, MessageKey> = {
  General: 'shortcut.section.general',
  Notes: 'shortcut.section.notes',
  Chat: 'shortcut.section.chat',
};

function buildSections(
  module: ShortcutModule,
  isMac: boolean,
  t: ((key: MessageKey) => string) | undefined
): ModuleShortcutSection[] {
  const buckets = new Map<ShortcutSection, ModuleShortcutItem[]>();

  for (const shortcut of getShortcutDefinitionsForModule(module)) {
    const sectionItems = buckets.get(shortcut.section) ?? [];
    sectionItems.push({
      action: shortcut.actionKey && t ? t(shortcut.actionKey) : shortcut.action,
      keys: getResolvedKeys(shortcut, isMac),
    });
    buckets.set(shortcut.section, sectionItems);
  }

  return SECTION_ORDER[module]
    .map((section) => ({
      title: t ? t(SECTION_MESSAGE_KEYS[section]) : section,
      shortcuts: buckets.get(section) ?? [],
    }))
    .filter((section) => section.shortcuts.length > 0);
}

export function getModuleShortcutPreset(
  module: ModuleShortcutId,
  options: ModuleShortcutPresetOptions = {},
): ModuleShortcutPreset {
  const isMac = options.isMac === true;
  const { t } = options;

  switch (module) {
    case 'notes':
      return {
        title: t ? t('shortcut.title') : 'Keyboard shortcuts',
        description: t ? t('shortcut.description.notes') : 'Available keyboard shortcuts for Notes.',
        sections: buildSections('notes', isMac, t),
      };
    case 'chat':
    default:
      return {
        title: t ? t('shortcut.title') : 'Keyboard shortcuts',
        description: t ? t('shortcut.description.chat') : 'Available keyboard shortcuts for Chat.',
        sections: buildSections('chat', isMac, t),
      };
  }
}
