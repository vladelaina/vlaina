import { SettingsItem, SettingsSectionHeader } from '../../components/SettingsControls';
import { SettingsSwitch } from '../../components/SettingsFields';
import { useI18n } from '@/lib/i18n';

interface MarkdownCodeBlockSettingsProps {
  showLineNumbers: boolean;
  onShowLineNumbersChange: (checked: boolean) => void;
}

export function MarkdownCodeBlockSettings({
  showLineNumbers,
  onShowLineNumbersChange,
}: MarkdownCodeBlockSettingsProps) {
  const { t } = useI18n();

  return (
    <>
      <SettingsSectionHeader>{t('settings.markdown.codeBlock')}</SettingsSectionHeader>

      <div className="space-y-1">
        <SettingsItem title={t('settings.markdown.showLineNumbers')}>
          <SettingsSwitch
            checked={showLineNumbers}
            onChange={onShowLineNumbersChange}
            activeColor="bg-[var(--vlaina-sidebar-row-selected-text)]"
          />
        </SettingsItem>
      </div>
    </>
  );
}
