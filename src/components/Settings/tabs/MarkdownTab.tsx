import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import {
  selectCodeBlockLineNumbersEnabled,
  selectMarkdownTypewriterModeEnabled,
} from '@/stores/unified/settings/markdownSettings';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';
import { cn } from '@/lib/utils';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { SettingsItem, SettingsSectionHeader } from '../components/SettingsControls';
import { SettingsSwitch } from '../components/SettingsFields';
import { MarkdownCodeBlockSettings } from './markdown/MarkdownCodeBlockSettings';
import { ImagesTab } from './ImagesTab';
import { useI18n } from '@/lib/i18n';

export function MarkdownTab() {
  const { t } = useI18n();
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
      <div className={cn('mb-8 flex items-center justify-between gap-4 rounded-full px-6 py-3 text-[13px] text-[var(--notes-sidebar-text-soft)]', chatComposerPillSurfaceClass)}>
        <span>{t('settings.markdown.shortcutHint')}</span>
        <ShortcutKeys
          keys={['Ctrl', '/']}
          keyClassName="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-[var(--notes-sidebar-text)] shadow-none dark:border-white/10 dark:bg-white/5"
        />
      </div>
      <SettingsSectionHeader>{t('settings.markdown.editing')}</SettingsSectionHeader>
      <div className="space-y-1">
        <SettingsItem
          title={t('settings.markdown.typewriterMode')}
          description={t('settings.markdown.typewriterModeDescription')}
        >
          <SettingsSwitch
            checked={typewriterMode}
            onChange={setMarkdownTypewriterMode}
            activeColor="bg-[var(--sidebar-row-selected-text)]"
          />
        </SettingsItem>
      </div>

      <MarkdownCodeBlockSettings
        showLineNumbers={showCodeBlockLineNumbers}
        onShowLineNumbersChange={setMarkdownCodeBlockLineNumbers}
      />
      <ImagesTab />
    </div>
  );
}
