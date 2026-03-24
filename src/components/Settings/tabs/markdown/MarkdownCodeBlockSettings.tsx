import { SettingsItem, SettingsSectionHeader } from '../../components/SettingsControls';
import { SettingsSwitch } from '../../components/SettingsFields';

interface MarkdownCodeBlockSettingsProps {
  showLineNumbers: boolean;
  onShowLineNumbersChange: (checked: boolean) => void;
}

export function MarkdownCodeBlockSettings({
  showLineNumbers,
  onShowLineNumbersChange,
}: MarkdownCodeBlockSettingsProps) {
  return (
    <>
      <SettingsSectionHeader>Code Block</SettingsSectionHeader>

      <SettingsItem title="Show line numbers">
        <SettingsSwitch
          checked={showLineNumbers}
          onChange={onShowLineNumbersChange}
        />
      </SettingsItem>
    </>
  );
}
