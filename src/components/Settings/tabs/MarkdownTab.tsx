import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import {
  selectCodeBlockLineNumbersEnabled,
  selectMarkdownTypewriterModeEnabled,
} from '@/stores/unified/settings/markdownSettings';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';
import { SettingsItem, SettingsSectionHeader } from '../components/SettingsControls';
import { SettingsSwitch } from '../components/SettingsFields';
import { MarkdownCodeBlockSettings } from './markdown/MarkdownCodeBlockSettings';
import { ImagesTab } from './ImagesTab';

export function MarkdownTab() {
  const typewriterMode = useUnifiedStore(
    selectMarkdownTypewriterModeEnabled
  );
  const showCodeBlockLineNumbers = useUnifiedStore(
    selectCodeBlockLineNumbersEnabled
  );
  const setMarkdownTypewriterMode = useUnifiedStore(
    (state) => state.setMarkdownTypewriterMode
  );
  const setMarkdownCodeBlockLineNumbers = useUnifiedStore(
    (state) => state.setMarkdownCodeBlockLineNumbers
  );

  return (
    <div className="max-w-3xl pb-10">
      <div className="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 text-[13px] text-zinc-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400">
        <span>Press Ctrl+/ to view keyboard shortcuts.</span>
        <ShortcutKeys
          keys={['Ctrl', '/']}
          keyClassName="rounded-[7px] border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-none dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
        />
      </div>
      <SettingsSectionHeader>Editing</SettingsSectionHeader>
      <SettingsItem
        title="Typewriter mode"
        description="Keep the cursor near the center while typing."
      >
        <SettingsSwitch
          checked={typewriterMode}
          onChange={setMarkdownTypewriterMode}
        />
      </SettingsItem>
      <MarkdownCodeBlockSettings
        showLineNumbers={showCodeBlockLineNumbers}
        onShowLineNumbersChange={setMarkdownCodeBlockLineNumbers}
      />
      <ImagesTab />
    </div>
  );
}
