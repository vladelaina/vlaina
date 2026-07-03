import { useEffect, useLayoutEffect } from 'react';
import { useShortcuts } from '@/hooks/useShortcuts';
import { useSyncInit } from '@/hooks/useSyncInit';
import { useUnifiedExternalSync } from '@/hooks/useUnifiedExternalSync';
import { desktopWindow } from '@/lib/desktop/window';
import { isElectronRuntime } from '@/lib/electron/bridge';
import { applyMarkdownFontSize } from '@/lib/markdown/markdownFontSize';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import { useUIStore, type AppViewMode } from '@/stores/uiSlice';
import { preloadAIStoreModule, preloadSettingsModule } from './AppContentModules';
import { useDesktopUpdateRuntime } from './useDesktopUpdateRuntime';

const E2E_LOCAL_STORAGE_KEY = 'vlaina:e2e:enabled';

interface AppContentRuntimeEffectsOptions {
  effectiveAppViewMode: AppViewMode;
  unifiedLoaded: boolean;
}

export function useAppContentRuntimeEffects({
  effectiveAppViewMode,
  unifiedLoaded,
}: AppContentRuntimeEffectsOptions) {
  const fontSize = useUIStore((state) => state.fontSize);
  const initialize = useNotesRootStore((state) => state.initialize);

  useSyncE2EBridgeInstaller();
  useAppModulePreloads(unifiedLoaded);

  useShortcuts();
  useSyncInit();
  useUnifiedExternalSync();

  useEffect(() => {
    void Promise.resolve(initialize())
      .catch((_error) => {
      });
  }, [initialize]);

  useDesktopUpdateRuntime();
  useChatSelectionLockReset(effectiveAppViewMode);
  useDocumentSpellcheckDisabled();
  useMarkdownFontSize(fontSize);
  useDesktopWindowUnlock();
}

function useSyncE2EBridgeInstaller() {
  useEffect(() => {
    if (!shouldInstallSyncE2EBridge()) return;

    void import('@/lib/e2e/syncE2EBridge')
      .then((mod) => {
        mod.installSyncE2EBridge();
      })
      .catch(() => {
      });
  }, []);
}

function useAppModulePreloads(unifiedLoaded: boolean) {
  useEffect(() => {
    if (!unifiedLoaded) return;

    void preloadSettingsModule().catch((_error) => {
    });
  }, [unifiedLoaded]);

  useEffect(() => {
    if (!unifiedLoaded) return;

    let cancelled = false;
    void preloadAIStoreModule()
      .then((mod) => {
        if (cancelled) return;
        mod.startAIStoreRuntimeEffects?.();
      })
      .catch((_error) => {
      });

    return () => {
      cancelled = true;
    };
  }, [unifiedLoaded]);
}

function useChatSelectionLockReset(effectiveAppViewMode: AppViewMode) {
  useEffect(() => {
    if (effectiveAppViewMode === 'chat' || typeof document === 'undefined') return;
    document.body.removeAttribute('data-chat-selection-lock');
  }, [effectiveAppViewMode]);
}

function useDocumentSpellcheckDisabled() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('spellcheck', 'false');
    document.body.setAttribute('spellcheck', 'false');
  }, []);
}

function useMarkdownFontSize(fontSize: number) {
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.removeProperty('font-size');
    applyMarkdownFontSize(fontSize);
  }, [fontSize]);
}

function useDesktopWindowUnlock() {
  useEffect(() => {
    if (!isElectronRuntime()) return;

    const unlockWindow = async () => {
      await desktopWindow.setResizable(true);
      await desktopWindow.setMaximizable(true);
      await desktopWindow.setMinSize({ width: 800, height: 600 });
      const size = await desktopWindow.getSize();
      if (size.width < 800 || size.height < 600) {
        await desktopWindow.setSize({
          width: Math.max(800, size.width),
          height: Math.max(600, size.height),
        });
        await desktopWindow.center();
      }
    };
    void unlockWindow();
  }, []);
}

function shouldInstallSyncE2EBridge() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('e2e') === '1' || window.localStorage.getItem(E2E_LOCAL_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
