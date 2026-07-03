import { useEffect, useRef, useState } from 'react';
import { readWindowLaunchContext } from '@/lib/desktop/launchContext';
import { useUIStore, type AppViewMode } from '@/stores/uiSlice';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { INITIAL_UNIFIED_VIEW_WAIT_TIMEOUT_MS } from './useAppContentViewLifecycle';

export function useAppStartupViewMode() {
  const appViewMode = useUIStore((state) => state.appViewMode);
  const restoreLastAppViewMode = useUIStore((state) => state.restoreLastAppViewMode);
  const restoreNotesChatFloatingSize = useUIStore((state) => state.restoreNotesChatFloatingSize);
  const unifiedLoaded = useUnifiedStore((state) => state.loaded);
  const lastConfiguredAppViewMode = useUnifiedStore((state) => state.data.settings.ui?.lastAppViewMode);
  const configuredNotesChatFloatingSize = useUnifiedStore((state) => state.data.settings.ui?.notesChatFloatingSize);
  const launchViewModeRef = useRef(readWindowLaunchContext().viewMode);
  const [initialUnifiedViewWaitDone, setInitialUnifiedViewWaitDone] = useState(Boolean(launchViewModeRef.current));
  const shouldWaitForInitialUnifiedView = !initialUnifiedViewWaitDone && !unifiedLoaded;
  const initialUnifiedAppViewMode: AppViewMode | null =
    !launchViewModeRef.current &&
    unifiedLoaded &&
    (appViewMode === 'notes' || appViewMode === 'chat') &&
    (lastConfiguredAppViewMode === 'notes' || lastConfiguredAppViewMode === 'chat') &&
    appViewMode !== lastConfiguredAppViewMode
      ? lastConfiguredAppViewMode
      : null;
  const effectiveAppViewMode = initialUnifiedAppViewMode ?? appViewMode;

  useEffect(() => {
    if (!shouldWaitForInitialUnifiedView) return;
    if (INITIAL_UNIFIED_VIEW_WAIT_TIMEOUT_MS === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setInitialUnifiedViewWaitDone(true);
    }, INITIAL_UNIFIED_VIEW_WAIT_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [appViewMode, shouldWaitForInitialUnifiedView]);

  useEffect(() => {
    if (!unifiedLoaded) return;
    setInitialUnifiedViewWaitDone(true);
  }, [unifiedLoaded]);

  useEffect(() => {
    const store = useUnifiedStore.getState();
    if (store.loaded) return;

    void store.load()
      .catch((_error) => {
        setInitialUnifiedViewWaitDone(true);
      });
  }, []);

  useEffect(() => {
    if (!unifiedLoaded) return;
    if (launchViewModeRef.current) return;
    if (lastConfiguredAppViewMode !== 'notes' && lastConfiguredAppViewMode !== 'chat') return;
    restoreLastAppViewMode(lastConfiguredAppViewMode);
  }, [lastConfiguredAppViewMode, restoreLastAppViewMode, unifiedLoaded]);

  useEffect(() => {
    if (!unifiedLoaded || !configuredNotesChatFloatingSize) return;
    restoreNotesChatFloatingSize(configuredNotesChatFloatingSize);
  }, [configuredNotesChatFloatingSize, restoreNotesChatFloatingSize, unifiedLoaded]);

  return {
    appViewMode,
    effectiveAppViewMode,
    hasLaunchViewMode: Boolean(launchViewModeRef.current),
    initialUnifiedAppViewMode,
    shouldWaitForInitialUnifiedView,
    unifiedLoaded,
  };
}
