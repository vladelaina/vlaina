import type { ChangeEvent } from 'react';
import { Icon } from '@/components/ui/icons';
import { SettingsItem } from '../components/SettingsControls';
import { useUIStore } from '@/stores/uiSlice';

export function AppearanceTab() {
  const fontSize = useUIStore((state) => state.fontSize);
  const setFontSize = useUIStore((state) => state.setFontSize);
  const resetFontSize = useUIStore((state) => state.resetFontSize);

  const handleFontSizeChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFontSize(parseInt(e.target.value));
  };

  return (
    <div className="max-w-3xl pb-10">
      <div className="mb-4 flex items-center justify-between px-2">
        <span className="text-[13px] font-medium text-[var(--notes-sidebar-text-soft)]">
          Font Size
        </span>
      </div>

      <SettingsItem
        title="Base font size"
        description="Adjust the base font size for the application"
      >
        <div className="flex items-center gap-4">
          <Icon size="md" name="editor.type" className="text-[var(--notes-sidebar-text-soft)]" />
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
          <span className="w-8 text-sm font-medium text-right tabular-nums text-[var(--notes-sidebar-text)]">
            {fontSize}px
          </span>
          <button
            type="button"
            onClick={resetFontSize}
            disabled={fontSize === 16}
            className="rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--sidebar-row-selected-text)] transition-colors hover:bg-[var(--sidebar-row-selected-bg)] disabled:pointer-events-none disabled:text-[var(--notes-sidebar-text-soft)] disabled:opacity-45 dark:hover:bg-[rgba(65,168,234,0.14)]"
          >
            Reset
          </button>
        </div>
      </SettingsItem>
    </div>
  );
}
