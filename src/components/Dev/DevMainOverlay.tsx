import { useCallback, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon, type IconName } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import { useUIStore, type AppViewMode } from '@/stores/uiSlice';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import {
  selectMarkdownImportedThemeId,
} from '@/stores/unified/settings/markdownSettings';

const DEV_OVERLAY_BUTTON_CLASS =
  'pointer-events-auto flex h-8 w-8 items-center justify-center rounded-md border border-[var(--vlaina-border)] bg-[var(--vlaina-color-setting-field)] shadow-[var(--vlaina-shadow-sm)] backdrop-blur-[var(--vlaina-backdrop-blur-sm)] transition-colors hover:bg-[var(--vlaina-hover)] disabled:opacity-[var(--vlaina-opacity-50)]';

function getNextDevMarkdownThemeId(currentThemeId: string | null, themeIds: string[]): string | null {
  const uniqueThemeIds = [...new Set(themeIds)];
  if (uniqueThemeIds.length === 0) return null;
  if (!currentThemeId) return uniqueThemeIds[0] ?? null;

  const currentIndex = uniqueThemeIds.indexOf(currentThemeId);
  if (currentIndex < 0) return uniqueThemeIds[0] ?? null;
  return currentIndex < uniqueThemeIds.length - 1
    ? uniqueThemeIds[currentIndex + 1] ?? null
    : null;
}

function DevOverlayButton({
  disabled = false,
  iconName,
  label,
  onClick,
}: {
  disabled?: boolean;
  iconName: IconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip delayDuration={700}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={cn(DEV_OVERLAY_BUTTON_CLASS, iconButtonStyles)}
        >
          <Icon name={iconName} size="md" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={8}>
        <span className="text-[var(--vlaina-font-xs)]">{label}</span>
      </TooltipContent>
    </Tooltip>
  );
}

export function DevMainOverlay({ effectiveAppViewMode }: { effectiveAppViewMode: AppViewMode }) {
  const setAppViewMode = useUIStore((state) => state.setAppViewMode);
  const colorMode = useUnifiedStore((state) => state.data.settings.ui?.colorMode);
  const setColorMode = useUnifiedStore((state) => state.setColorMode);
  const importedMarkdownThemeId = useUnifiedStore(selectMarkdownImportedThemeId);
  const setMarkdownImportedThemeId = useUnifiedStore((state) => state.setMarkdownImportedThemeId);
  const [isThemeSwitching, setIsThemeSwitching] = useState(false);

  const handleMarkdownThemeCycle = useCallback(async () => {
    if (isThemeSwitching) return;

    setIsThemeSwitching(true);
    try {
      const {
        listImportedMarkdownThemesFromDirectory,
        syncImportedMarkdownThemesFromDirectory,
      } = await import('@/lib/markdown/theme-compatibility/importedThemeStorage');
      const listedThemes = await listImportedMarkdownThemesFromDirectory();
      const themes = listedThemes.length > 0
        ? listedThemes
        : (await syncImportedMarkdownThemesFromDirectory()).themes;

      setMarkdownImportedThemeId(getNextDevMarkdownThemeId(
        importedMarkdownThemeId,
        themes.map((theme) => theme.id),
      ));
    } catch {
      // Dev-only helper; failures should not affect the app.
    } finally {
      setIsThemeSwitching(false);
    }
  }, [importedMarkdownThemeId, isThemeSwitching, setMarkdownImportedThemeId]);

  const isDarkModeSelected = colorMode === 'dark';
  const colorModeSwitchLabel = isDarkModeSelected ? 'Switch to light mode' : 'Switch to dark mode';
  const markdownThemeSwitchLabel = importedMarkdownThemeId
    ? `Switch Markdown theme (${importedMarkdownThemeId})`
    : 'Switch Markdown theme (default)';

  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-[var(--vlaina-z-30)] flex flex-col items-end gap-2">
      <DevOverlayButton
        disabled={isThemeSwitching}
        iconName="theme.palette"
        label={markdownThemeSwitchLabel}
        onClick={() => void handleMarkdownThemeCycle()}
      />
      <DevOverlayButton
        iconName={isDarkModeSelected ? 'theme.light' : 'theme.dark'}
        label={colorModeSwitchLabel}
        onClick={() => setColorMode(isDarkModeSelected ? 'light' : 'dark')}
      />
      {effectiveAppViewMode !== 'lab' ? (
        <DevOverlayButton
          iconName="misc.lab"
          label="Open Design Lab"
          onClick={() => setAppViewMode('lab')}
        />
      ) : null}
    </div>
  );
}
