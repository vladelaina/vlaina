import { useMemo } from 'react';
import { Icon, type IconName } from '@/components/ui/icons';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';
import { getShortcutDefinitions, getShortcutKeys, type ShortcutSection } from '@/lib/shortcuts';
import { SettingsSectionHeader } from '../components/SettingsControls';

interface ShortcutRow {
  id: string;
  action: string;
  keys: string[];
}

const SECTION_META: Record<ShortcutSection, { title: string; description: string; icon: IconName }> = {
  General: {
    title: 'General',
    description: 'Global shortcuts that work across Notes and Chat.',
    icon: 'editor.keyboard',
  },
  Notes: {
    title: 'Notes',
    description: 'Navigation and panel shortcuts for the notes workspace.',
    icon: 'file.text',
  },
  Chat: {
    title: 'Chat',
    description: 'Conversation, response, and navigation shortcuts for chat.',
    icon: 'common.sparkle',
  },
};

const SECTION_ORDER: ShortcutSection[] = ['General', 'Notes', 'Chat'];

export function ShortcutsTab() {
  const sections = useMemo(() => {
    const buckets = new Map<ShortcutSection, ShortcutRow[]>();

    for (const shortcut of getShortcutDefinitions()) {
      const resolvedKeys = getShortcutKeys(shortcut.id) ?? shortcut.keys;
      const items = buckets.get(shortcut.section) ?? [];
      items.push({
        id: shortcut.id,
        action: shortcut.action,
        keys: resolvedKeys,
      });
      buckets.set(shortcut.section, items);
    }

    return SECTION_ORDER.map((section) => ({
      ...SECTION_META[section],
      rows: buckets.get(section) ?? [],
    })).filter((section) => section.rows.length > 0);
  }, []);

  return (
    <div className="max-w-3xl pb-10">
      <div className="rounded-[18px] border border-zinc-200/80 bg-zinc-50/80 px-5 py-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-zinc-500 shadow-sm dark:bg-white/5 dark:text-zinc-300">
            <Icon name="editor.keyboard" size="md" />
          </span>
          <div className="min-w-0">
            <div className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100">
              Keyboard shortcuts overview
            </div>
            <p className="mt-1 text-[13px] leading-6 text-zinc-500 dark:text-zinc-400">
              This page shows the current bindings in one place. In Notes or Chat, you can still press <span className="font-medium text-zinc-700 dark:text-zinc-200">Ctrl+/</span> for the focused module view.
            </p>
          </div>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.title}>
          <SettingsSectionHeader>{section.title}</SettingsSectionHeader>
          <div className="mb-3 flex items-center gap-2 text-[13px] text-zinc-500 dark:text-zinc-400">
            <Icon name={section.icon} size="sm" className="text-zinc-400 dark:text-zinc-500" />
            <span>{section.description}</span>
          </div>
          <div className="overflow-hidden rounded-[18px] border border-zinc-200/80 bg-white dark:border-white/10 dark:bg-[#202020]">
            {section.rows.map((row, index) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03]"
                style={index < section.rows.length - 1 ? { borderBottom: '1px solid rgba(228,228,231,0.7)' } : undefined}
              >
                <div className="min-w-0">
                  <div className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100">
                    {row.action}
                  </div>
                </div>
                <ShortcutKeys
                  keys={row.keys}
                  className="shrink-0"
                  keyClassName="rounded-[8px] border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] font-medium text-zinc-700 shadow-none dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
