import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useCalendarStore } from '@/stores/useCalendarStore';
import {
  SettingsItem,
  SettingsSectionHeader,
  SegmentedControl,
  SettingsToggle
} from '../components/SettingsControls';
import { parseClockTime, formatClockTime } from '@/lib/time';
import { STORAGE_KEY_FONT_SIZE } from '@/lib/config';
import { MdLaptop, MdDarkMode, MdLightMode, MdTextFields, MdAccessTime } from 'react-icons/md';

/**
 * Appearance tab content - theme, colors, font size
 */
export function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const { timezone, setTimezone, use24Hour, toggle24Hour, dayStartTime, setDayStartTime } = useCalendarStore();

  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_FONT_SIZE);
    return saved !== null ? parseInt(saved) : 14;
  });

  const [timezoneInput, setTimezoneInput] = useState(timezone.toString());
  const [dayStartInput, setDayStartInput] = useState(() =>
    formatClockTime(dayStartTime, use24Hour)
  );

  // Update input when timezone changes externally
  useEffect(() => {
    setTimezoneInput(timezone.toString());
  }, [timezone]);

  // Update day start input when settings change
  useEffect(() => {
    setDayStartInput(formatClockTime(dayStartTime, use24Hour));
  }, [dayStartTime, use24Hour]);

  // Apply global font size
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(e.target.value);
    setFontSize(newSize);
    localStorage.setItem(STORAGE_KEY_FONT_SIZE, newSize.toString());
  };

  const handleTimezoneSubmit = () => {
    const input = timezoneInput.trim();
    const match = input.match(/^([+-]?\d{1,2})$/);
    if (match) {
      const value = parseInt(match[0], 10);
      if (value >= -12 && value <= 14) {
        setTimezone(value);
        return;
      }
    }
    // Reset if invalid
    setTimezoneInput(timezone.toString());
  };

  const handleDayStartSubmit = () => {
    const parsed = parseClockTime(dayStartInput);
    if (parsed) {
      const minutes = parsed.hours * 60 + parsed.minutes;
      setDayStartTime(minutes);
    } else {
      // Reset if invalid
      setDayStartInput(formatClockTime(dayStartTime, use24Hour));
    }
  };

  return (
    <div className="max-w-3xl pb-10">
      {/* Theme Section */}
      <SettingsSectionHeader>Theme</SettingsSectionHeader>

      <SettingsItem
        title="Color mode"
        description="Choose your preferred color appearance"
      >
        <div className="w-64">
          <SegmentedControl
            options={[
              { value: 'system', label: 'System', icon: <MdLaptop className="w-[18px] h-[18px]" /> },
              { value: 'light', label: 'Light', icon: <MdLightMode className="w-[18px] h-[18px]" /> },
              { value: 'dark', label: 'Dark', icon: <MdDarkMode className="w-[18px] h-[18px]" /> },
            ]}
            value={theme || 'system'}
            onChange={setTheme}
          />
        </div>
      </SettingsItem>

      {/* Editor Section */}
      <SettingsSectionHeader>Editor</SettingsSectionHeader>

      <SettingsItem
        title="Font Size"
        description="Adjust the base font size for the application"
      >
        <div className="flex items-center gap-4">
          <MdTextFields className="w-[18px] h-[18px] text-zinc-400" />
          <input
            type="range"
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

      {/* Date & Time Section */}
      <SettingsSectionHeader>Date & Time</SettingsSectionHeader>

      <SettingsItem
        title="24-Hour Time"
        description="Use 24-hour format (e.g., 14:00) instead of 12-hour (2:00 PM)"
      >
        <SettingsToggle
          checked={use24Hour}
          onChange={toggle24Hour}
        />
      </SettingsItem>

      <SettingsItem
        title="Timezone (GMT)"
        description="Set your time offset from GMT (e.g., +8 for China)"
      >
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
            <span className="text-zinc-500 text-sm font-medium">GMT</span>
          </div>
          <input
            type="text"
            value={timezoneInput}
            onChange={(e) => setTimezoneInput(e.target.value)}
            onBlur={handleTimezoneSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleTimezoneSubmit()}
            className="w-20 pl-10 pr-3 py-1.5 text-sm font-medium bg-[#F4F4F5] dark:bg-[#2A2A2A] border border-transparent dark:border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1E96EB]/20 focus:border-[#1E96EB] transition-all text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
            placeholder="+0"
          />
        </div>
      </SettingsItem>

      <SettingsItem
        title="Day Start Time"
        description="When does your day start? (for calendar view)"
      >
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
            <MdAccessTime className="w-[18px] h-[18px] text-zinc-400" />
          </div>
          <input
            type="text"
            value={dayStartInput}
            onChange={(e) => setDayStartInput(e.target.value)}
            onBlur={handleDayStartSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleDayStartSubmit()}
            className="w-28 pl-9 pr-3 py-1.5 text-sm font-medium bg-[#F4F4F5] dark:bg-[#2A2A2A] border border-transparent dark:border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1E96EB]/20 focus:border-[#1E96EB] transition-all text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            placeholder="05:00"
          />
        </div>
      </SettingsItem>
    </div>
  );
}