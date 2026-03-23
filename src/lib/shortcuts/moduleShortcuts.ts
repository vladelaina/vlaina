import { getShortcutDefinitionsForModule } from './registry';
import { getShortcutKeys } from './storage';
import type { ShortcutDefinition, ShortcutModule, ShortcutSection } from './types';

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

const SECTION_ORDER: Record<ShortcutModule, ShortcutSection[]> = {
  notes: ['Notes', 'General'],
  chat: ['Chat', 'General'],
};

function getResolvedKeys(shortcut: ShortcutDefinition, isMac: boolean): string[] {
  const resolvedKeys = getShortcutKeys(shortcut.id) ?? shortcut.keys;
  if (!isMac) {
    return resolvedKeys;
  }

  return resolvedKeys.map((key) => (shortcut.id === 'deleteChat' && key === 'Backspace' ? '⌫' : key));
}

function buildSections(module: ShortcutModule, isMac: boolean): ModuleShortcutSection[] {
  const buckets = new Map<ShortcutSection, ModuleShortcutItem[]>();

  for (const shortcut of getShortcutDefinitionsForModule(module)) {
    const sectionItems = buckets.get(shortcut.section) ?? [];
    sectionItems.push({
      action: shortcut.action,
      keys: getResolvedKeys(shortcut, isMac),
    });
    buckets.set(shortcut.section, sectionItems);
  }

  return SECTION_ORDER[module]
    .map((section) => ({
      title: section,
      shortcuts: buckets.get(section) ?? [],
    }))
    .filter((section) => section.shortcuts.length > 0);
}

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
        sections: buildSections('notes', isMac),
      };
    case 'chat':
    default:
      return {
        title: 'Keyboard shortcuts',
        description: 'Available keyboard shortcuts for Chat.',
        sections: buildSections('chat', isMac),
      };
  }
}
