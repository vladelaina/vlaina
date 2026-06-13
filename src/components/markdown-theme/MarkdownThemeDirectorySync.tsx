import { useEffect } from 'react';
import { watchDesktopPath } from '@/lib/desktop/watch';
import { isElectronRuntime } from '@/lib/electron/bridge';
import {
  syncImportedMarkdownThemesFromDirectory,
  type ImportedMarkdownThemesDirectorySyncResult,
} from '@/lib/markdown/theme-compatibility/importedThemeStorage';
import {
  selectMarkdownImportedThemeId,
} from '@/stores/unified/settings/markdownSettings';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';

const THEME_DIRECTORY_SYNC_DEBOUNCE_MS = 120;

function applySyncedMarkdownTheme(
  result: ImportedMarkdownThemesDirectorySyncResult,
  setMarkdownImportedThemeId: (importedThemeId: string | null) => void
): void {
  const currentThemeId = selectMarkdownImportedThemeId(useUnifiedStore.getState());
  const syncedThemeIds = new Set(result.themes.map((theme) => theme.id));
  const nextThemeId = currentThemeId && !syncedThemeIds.has(currentThemeId)
    ? result.activeThemeId
    : currentThemeId;

  if (currentThemeId !== nextThemeId) {
    setMarkdownImportedThemeId(nextThemeId);
  }
}

export function MarkdownThemeDirectorySync() {
  const loaded = useUnifiedStore((state) => state.loaded);
  const setMarkdownImportedThemeId = useUnifiedStore((state) => state.setMarkdownImportedThemeId);

  useEffect(() => {
    if (!loaded) return;

    let cancelled = false;
    let syncTimer: number | null = null;
    let unwatch: (() => Promise<void>) | null = null;
    let syncRunning = false;
    let syncQueued = false;

    const runSync = async (): Promise<ImportedMarkdownThemesDirectorySyncResult | null> => {
      if (syncRunning) {
        syncQueued = true;
        return null;
      }

      syncRunning = true;

      try {
        const result = await syncImportedMarkdownThemesFromDirectory();
        if (!cancelled) {
          applySyncedMarkdownTheme(result, setMarkdownImportedThemeId);
        }
        return result;
      } catch {
        return null;
      } finally {
        syncRunning = false;
        if (syncQueued && !cancelled) {
          syncQueued = false;
          scheduleSync();
        }
      }
    };

    const scheduleSync = () => {
      if (syncTimer !== null) {
        window.clearTimeout(syncTimer);
      }

      syncTimer = window.setTimeout(() => {
        syncTimer = null;
        void runSync().catch(() => undefined);
      }, THEME_DIRECTORY_SYNC_DEBOUNCE_MS);
    };

    void runSync().then((result) => {
      if (cancelled || !result || !isElectronRuntime()) {
        return;
      }

      void watchDesktopPath(result.directoryPath, scheduleSync).then((cleanup) => {
        if (cancelled) {
          void cleanup().catch(() => undefined);
          return;
        }
        unwatch = cleanup;
      }).catch(() => undefined);
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      if (syncTimer !== null) {
        window.clearTimeout(syncTimer);
      }
      void unwatch?.().catch(() => undefined);
    };
  }, [loaded, setMarkdownImportedThemeId]);

  return null;
}
