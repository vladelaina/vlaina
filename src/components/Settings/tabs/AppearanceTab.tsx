import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Icon } from '@/components/ui/icons';
import {
  SettingsItem,
  SettingsSectionHeader,
  SegmentedControl,
} from '../components/SettingsControls';
import { STORAGE_KEY_FONT_SIZE } from '@/lib/config';

const DEFAULT_FONT_SIZE = 16;

export function AppearanceTab() {
  const { theme, setTheme } = useTheme();

  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_FONT_SIZE);
    return saved !== null ? parseInt(saved) : DEFAULT_FONT_SIZE;
  });

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(e.target.value);
    setFontSize(newSize);
    localStorage.setItem(STORAGE_KEY_FONT_SIZE, newSize.toString());
  };

  const resetFontSize = () => {
    setFontSize(DEFAULT_FONT_SIZE);
    localStorage.removeItem(STORAGE_KEY_FONT_SIZE);
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
 { value: 'light', label: 'Light', icon: <Icon size="md" name="theme.light" /> },
            ]}
            value={theme === 'light' ? theme : 'light'}
            onChange={setTheme}
          />
        </div>
      </SettingsItem>

      <SettingsSectionHeader>Editor</SettingsSectionHeader>

      <SettingsItem
        title="Font size"
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
            className="w-32 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[var(--sidebar-row-selected-text)]"
          />
          <span className="w-8 text-sm font-medium text-right tabular-nums text-zinc-700 dark:text-zinc-300">
            {fontSize}px
          </span>
          <button
            type="button"
            onClick={resetFontSize}
            disabled={fontSize === DEFAULT_FONT_SIZE}
            className="rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--sidebar-row-selected-text)] transition-colors hover:bg-[var(--sidebar-row-selected-bg)] disabled:pointer-events-none disabled:text-zinc-300 dark:hover:bg-[rgba(65,168,234,0.14)] dark:disabled:text-zinc-600"
          >
            Reset
          </button>
        </div>
      </SettingsItem>
    </div>
  );
}
