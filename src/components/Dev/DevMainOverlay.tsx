import { useCallback, useEffect, useState } from 'react';
import { useUIStore, type AppViewMode } from '@/stores/uiSlice';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import {
  selectMarkdownImportedThemeId,
} from '@/stores/unified/settings/markdownSettings';
import { applyManagedQuotaExhaustedSnapshot, useManagedAIStore } from '@/stores/useManagedAIStore';
import { isManagedBudgetExhausted } from '@/lib/ai/managedQuota';
import {
  clearCachedDesktopUpdateInfo,
  createSimulatedDesktopUpdateInfo,
  readCachedDesktopUpdateInfo,
  UPDATE_INFO_CHANGED_EVENT,
  writeCachedDesktopUpdateInfo,
} from '@/lib/desktop/updateStatus';
import { DevOverlayButton } from './DevOverlayButton';

function DevErrorScreenPreviewCrash(): never {
  throw new Error('vlaina dev error screen preview');
}

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

export function DevMainOverlay({
  effectiveAppViewMode,
}: {
  effectiveAppViewMode: AppViewMode;
}) {
  const setAppViewMode = useUIStore((state) => state.setAppViewMode);
  const devPlatformPreview = useUIStore((state) => state.devPlatformPreview);
  const toggleDevPlatformPreview = useUIStore((state) => state.toggleDevPlatformPreview);
  const colorMode = useUnifiedStore((state) => state.data.settings.ui?.colorMode);
  const setColorMode = useUnifiedStore((state) => state.setColorMode);
  const importedMarkdownThemeId = useUnifiedStore(selectMarkdownImportedThemeId);
  const setMarkdownImportedThemeId = useUnifiedStore((state) => state.setMarkdownImportedThemeId);
  const managedBudget = useManagedAIStore((state) => state.budget);
  const clearManagedBudget = useManagedAIStore((state) => state.clearBudget);
  const [isThemeSwitching, setIsThemeSwitching] = useState(false);
  const [isSimulatedUpdateActive, setIsSimulatedUpdateActive] = useState(() =>
    readCachedDesktopUpdateInfo()?.simulated === true
  );
  const [shouldPreviewErrorScreen, setShouldPreviewErrorScreen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-vlaina-dev-platform-preview', devPlatformPreview);
    return () => {
      document.documentElement.removeAttribute('data-vlaina-dev-platform-preview');
    };
  }, [devPlatformPreview]);

  useEffect(() => {
    const syncSimulatedUpdateState = () => {
      setIsSimulatedUpdateActive(readCachedDesktopUpdateInfo()?.simulated === true);
    };

    window.addEventListener(UPDATE_INFO_CHANGED_EVENT, syncSimulatedUpdateState);
    return () => {
      window.removeEventListener(UPDATE_INFO_CHANGED_EVENT, syncSimulatedUpdateState);
    };
  }, []);

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
  const isMacOSPreviewSelected = devPlatformPreview === 'macos';
  const isManagedQuotaExhausted = isManagedBudgetExhausted(managedBudget);
  const platformPreviewSwitchLabel = isMacOSPreviewSelected
    ? 'Use system platform preview'
    : 'Preview macOS titlebar';
  const colorModeSwitchLabel = isDarkModeSelected ? 'Switch to light mode' : 'Switch to dark mode';
  const markdownThemeSwitchLabel = importedMarkdownThemeId
    ? `Switch Markdown theme (${importedMarkdownThemeId})`
    : 'Switch Markdown theme (default)';
  const managedQuotaSwitchLabel = isManagedQuotaExhausted
    ? 'Clear managed quota exhaustion'
    : 'Simulate managed quota exhaustion';
  const updateSimulationSwitchLabel = isSimulatedUpdateActive
    ? 'Clear simulated update'
    : 'Simulate update available';

  if (shouldPreviewErrorScreen) {
    return <DevErrorScreenPreviewCrash />;
  }

  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-[var(--vlaina-z-30)] flex translate-x-[var(--vlaina-window-resize-compensation-x)] flex-col items-end gap-2">
      <DevOverlayButton
        iconName={isSimulatedUpdateActive ? 'common.checkCircle' : 'common.download'}
        label={updateSimulationSwitchLabel}
        onClick={() => {
          if (isSimulatedUpdateActive) {
            clearCachedDesktopUpdateInfo();
            return;
          }
          writeCachedDesktopUpdateInfo(createSimulatedDesktopUpdateInfo());
        }}
      />
      <DevOverlayButton
        iconName="common.error"
        label="Preview error screen"
        onClick={() => setShouldPreviewErrorScreen(true)}
      />
      <DevOverlayButton
        disabled={isThemeSwitching}
        iconName="theme.palette"
        label={markdownThemeSwitchLabel}
        onClick={() => void handleMarkdownThemeCycle()}
      />
      <DevOverlayButton
        iconName={isManagedQuotaExhausted ? 'common.blocked' : 'common.warning'}
        label={managedQuotaSwitchLabel}
        onClick={() => {
          if (isManagedQuotaExhausted) {
            clearManagedBudget();
            return;
          }
          applyManagedQuotaExhaustedSnapshot();
        }}
      />
      <DevOverlayButton
        iconName={isDarkModeSelected ? 'theme.light' : 'theme.dark'}
        label={colorModeSwitchLabel}
        onClick={() => setColorMode(isDarkModeSelected ? 'light' : 'dark')}
      />
      <DevOverlayButton
        iconName="theme.system"
        label={platformPreviewSwitchLabel}
        onClick={toggleDevPlatformPreview}
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
