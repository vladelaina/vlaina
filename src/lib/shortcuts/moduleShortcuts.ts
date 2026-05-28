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
  notes: ['Paragraph', 'Format', 'View', 'Notes', 'Chat', 'General'],
  chat: ['Chat', 'General'],
};

const NOTES_REGISTRY_SHORTCUTS_SHOWN_IN_EDITOR_SECTIONS = new Set([
  'editorFind',
  'toggleSidebar',
]);

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
  Paragraph: 'shortcut.section.paragraph',
  Format: 'shortcut.section.format',
  View: 'shortcut.section.view',
};

function getEditorSectionTitle(section: ShortcutSection, t: ((key: MessageKey) => string) | undefined): string {
  return t ? t(SECTION_MESSAGE_KEYS[section]) : section;
}

function label(t: ((key: MessageKey) => string) | undefined, key: MessageKey, fallback: string): string {
  return t ? t(key) : fallback;
}

function getEditorShortcutPreset(t: ((key: MessageKey) => string) | undefined): Partial<Record<ShortcutSection, ModuleShortcutItem[]>> {
  return {
    Paragraph: [
      { action: label(t, 'editor.blockType.heading1', 'Heading 1'), keys: ['Ctrl', '1'] },
      { action: label(t, 'editor.blockType.heading2', 'Heading 2'), keys: ['Ctrl', '2'] },
      { action: label(t, 'editor.blockType.heading3', 'Heading 3'), keys: ['Ctrl', '3'] },
      { action: label(t, 'editor.blockType.heading4', 'Heading 4'), keys: ['Ctrl', '4'] },
      { action: label(t, 'editor.blockType.heading5', 'Heading 5'), keys: ['Ctrl', '5'] },
      { action: label(t, 'editor.blockType.heading6', 'Heading 6'), keys: ['Ctrl', '6'] },
      { action: label(t, 'editor.blockType.paragraph', 'Paragraph'), keys: ['Ctrl', '0'] },
      { action: label(t, 'shortcut.action.raiseHeadingLevel', 'Raise heading level'), keys: ['Ctrl', '='] },
      { action: label(t, 'shortcut.action.lowerHeadingLevel', 'Lower heading level'), keys: ['Ctrl', '-'] },
      { action: label(t, 'shortcut.action.insertTable', 'Insert table'), keys: ['Ctrl', 'T'] },
      { action: label(t, 'editor.table.insertRowBelow', 'Insert row below'), keys: ['Ctrl', 'Enter'] },
      { action: label(t, 'editor.table.deleteRow', 'Delete row'), keys: ['Ctrl', 'Shift', 'Backspace'] },
      { action: label(t, 'editor.blockType.codeBlock', 'Code block'), keys: ['Ctrl', 'Shift', 'K'] },
      { action: label(t, 'shortcut.action.mathBlock', 'Math block'), keys: ['Ctrl', 'Shift', 'M'] },
      { action: label(t, 'editor.blockType.orderedList', 'Ordered list'), keys: ['Ctrl', 'Shift', '['] },
      { action: label(t, 'editor.blockType.bulletList', 'Bullet list'), keys: ['Ctrl', 'Shift', ']'] },
      { action: label(t, 'shortcut.action.increaseIndent', 'Increase indent'), keys: ['Ctrl', ']'] },
      { action: label(t, 'shortcut.action.decreaseIndent', 'Decrease indent'), keys: ['Ctrl', '['] },
    ],
    Format: [
      { action: label(t, 'shortcut.action.bold', 'Bold'), keys: ['Ctrl', 'B'] },
      { action: label(t, 'shortcut.action.italic', 'Italic'), keys: ['Ctrl', 'I'] },
      { action: label(t, 'shortcut.action.underline', 'Underline'), keys: ['Ctrl', 'U'] },
      { action: label(t, 'shortcut.action.strikethrough', 'Strikethrough'), keys: ['Ctrl', 'Shift', '5'] },
      { action: label(t, 'shortcut.action.inlineCode', 'Inline code'), keys: ['Ctrl', 'Shift', '`'] },
      { action: label(t, 'shortcut.action.link', 'Link'), keys: ['Ctrl', 'K'] },
      { action: label(t, 'shortcut.action.clearFormatting', 'Clear formatting'), keys: ['Ctrl', '\\'] },
    ],
    View: [
      { action: label(t, 'shortcut.action.toggleSidebar', 'Toggle sidebar'), keys: ['Ctrl', '\\'] },
      { action: label(t, 'shortcut.action.editorFind', 'Find in note'), keys: ['Ctrl', 'F'] },
      { action: label(t, 'shortcut.action.actualSize', 'Actual size'), keys: ['Ctrl', 'Shift', '9'] },
      { action: label(t, 'chat.zoomIn', 'Zoom in'), keys: ['Ctrl', 'Shift', '='] },
      { action: label(t, 'chat.zoomOut', 'Zoom out'), keys: ['Ctrl', 'Shift', '-'] },
    ],
  };
}

function buildSections(
  module: ShortcutModule,
  isMac: boolean,
  t: ((key: MessageKey) => string) | undefined
): ModuleShortcutSection[] {
  const buckets = new Map<ShortcutSection, ModuleShortcutItem[]>();

  for (const shortcut of getShortcutDefinitionsForModule(module)) {
    if (module === 'notes' && NOTES_REGISTRY_SHORTCUTS_SHOWN_IN_EDITOR_SECTIONS.has(shortcut.id)) {
      continue;
    }

    const sectionItems = buckets.get(shortcut.section) ?? [];
    sectionItems.push({
      action: shortcut.actionKey && t ? t(shortcut.actionKey) : shortcut.action,
      keys: getResolvedKeys(shortcut, isMac),
    });
    buckets.set(shortcut.section, sectionItems);
  }

  if (module === 'notes') {
    const editorShortcuts = getEditorShortcutPreset(t);
    for (const [section, shortcuts] of Object.entries(editorShortcuts) as Array<[ShortcutSection, ModuleShortcutItem[]]>) {
      buckets.set(section, shortcuts);
    }
  }

  return SECTION_ORDER[module]
    .map((section) => ({
      title: getEditorSectionTitle(section, t),
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
