import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Icon } from '@/components/ui/icons';
import {
  SettingsItem,
  SettingsSectionHeader,
  SegmentedControl,
} from '../components/SettingsControls';
import { STORAGE_KEY_FONT_SIZE } from '@/lib/config';

export function AppearanceTab() {
  const { theme, setTheme } = useTheme();

  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_FONT_SIZE);
    return saved !== null ? parseInt(saved) : 14;
  });

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(e.target.value);
    setFontSize(newSize);
    localStorage.setItem(STORAGE_KEY_FONT_SIZE, newSize.toString());
  };

  return (
    <div className="max-w-3xl pb-10">
      <SettingsSectionHeader>Theme</SettingsSectionHeader>

      <SettingsItem
        title="Color mode"
        description="Choose your preferred color appearance"
      >
        <div className="w-64">
          <SegmentedControl
            options={[
 { value: 'system', label: 'System', icon: <Icon size="md" name="theme.system" /> },
 { value: 'light', label: 'Light', icon: <Icon size="md" name="theme.light" /> },
 { value: 'dark', label: 'Dark', icon: <Icon size="md" name="theme.dark" /> },
            ]}
            value={theme || 'system'}
            onChange={setTheme}
          />
        </div>
      </SettingsItem>

      <SettingsSectionHeader>Editor</SettingsSectionHeader>

      <SettingsItem
        title="Font Size"
        description="Adjust the base font size for the application"
      >
        <div className="flex items-center gap-4">
 <Icon size="md" name="editor.type" className="text-zinc-400" />
          <input
            type="range"
            spellCheck={false}
            min="12"
            max="20"
            step="1"
            value={fontSize}
            onChange={handleFontSizeChange}
            className="w-32 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#1E96EB]"
          />
          <span className="w-8 text-sm font-medium text-right tabular-nums text-zinc-700 dark:text-zinc-300">
            {fontSize}px
          </span>
        </div>
      </SettingsItem>
    </div>
  );
}
