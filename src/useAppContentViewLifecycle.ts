import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppViewMode } from '@/stores/uiSlice';
import { getElectronBridge } from '@/lib/electron/bridge';
import {
  preloadChatSidebarModule,
  preloadChatViewModule,
  preloadGitTitleBarActionModule,
  preloadAIStoreModule,
  preloadModelSelectorModule,
  preloadNotesSidebarModule,
  preloadNotesTabRowModule,
  preloadNotesViewModule,
  preloadTemporaryChatToggleModule,
  preloadWhiteboardViewModule,
} from './AppContentModules';

const CENTER_CHROME_RENDER_DELAY_MS = 0;
const VISIBLE_SIDEBAR_RENDER_DELAY_MS = import.meta.env.DEV ? 750 : 120;
export const INITIAL_UNIFIED_VIEW_WAIT_TIMEOUT_MS = import.meta.env.DEV ? null : 3000;

type ReadyAppViewMode = Extract<AppViewMode, 'notes' | 'chat' | 'whiteboard'>;
const PREWARMED_APP_VIEW_MODES = [
  'notes',
  'chat',
  'whiteboard',
] satisfies readonly ReadyAppViewMode[];

interface UseAppContentViewLifecycleOptions {
  appViewMode: AppViewMode;
  effectiveAppViewMode: AppViewMode;
  hasLaunchViewMode: boolean;
  initialUnifiedAppViewMode: AppViewMode | null;
  shouldWaitForInitialUnifiedView: boolean;
}

function isPrewarmedAppViewMode(viewMode: AppViewMode): viewMode is ReadyAppViewMode {
  return PREWARMED_APP_VIEW_MODES.includes(viewMode as ReadyAppViewMode);
}

function addPrewarmedAppViews(views: Set<AppViewMode>) {
  if (PREWARMED_APP_VIEW_MODES.every((viewMode) => views.has(viewMode))) return views;
  return new Set([...views, ...PREWARMED_APP_VIEW_MODES]);
}

function preloadActiveViewModule(viewMode: AppViewMode) {
  if (viewMode === 'notes') {
    void preloadNotesViewModule();
    return;
  }

  if (viewMode === 'chat') {
    void preloadChatViewModule();
    return;
  }

  if (viewMode === 'whiteboard') {
    void preloadWhiteboardViewModule();
  }
}

function preloadPrewarmedViewModules() {
  void preloadNotesViewModule();
  void preloadChatViewModule();
  void preloadWhiteboardViewModule();
}

export function useAppContentViewLifecycle({
  appViewMode,
  effectiveAppViewMode,
  hasLaunchViewMode,
  initialUnifiedAppViewMode,
  shouldWaitForInitialUnifiedView,
}: UseAppContentViewLifecycleOptions) {
  const [mountedAppViews, setMountedAppViews] = useState<Set<AppViewMode>>(() =>
    hasLaunchViewMode ? new Set([appViewMode]) : new Set()
  );
  const [activeViewReady, setActiveViewReady] = useState(false);
  const [primaryContentReady, setPrimaryContentReady] = useState(false);
  const [shouldRenderDeferredChrome, setShouldRenderDeferredChrome] = useState(false);
  const [shouldRenderCenterChrome, setShouldRenderCenterChrome] = useState(false);
  const [renderedSidebarAppViews, setRenderedSidebarAppViews] = useState<Set<AppViewMode>>(() => new Set());
  const readyAppViewsRef = useRef<Set<AppViewMode>>(new Set());
  const primaryContentReadyAppViewsRef = useRef<Set<AppViewMode>>(new Set());
  const didReportStartupReadyRef = useRef(false);
  const didEnableCenterChromeRef = useRef(false);
  const didEnableDeferredChromeRef = useRef(false);
  const didPrewarmManagedModelsRef = useRef(false);
  const centerChromeTimerRef = useRef<number | null>(null);
  const deferredChromeTimerRef = useRef<number | null>(null);
  const preloadedPrimaryViewRef = useRef<AppViewMode | null>(null);
  const effectiveAppViewModeRef = useRef(effectiveAppViewMode);

  useEffect(() => {
    effectiveAppViewModeRef.current = effectiveAppViewMode;
  }, [effectiveAppViewMode]);

  const reportStartupReady = useCallback(() => {
    if (didReportStartupReadyRef.current) return;
    didReportStartupReadyRef.current = true;
    getElectronBridge()?.app?.reportStartupReady?.();
  }, []);

  const handleStartupFallbackReady = useCallback(() => {
    reportStartupReady();
  }, [reportStartupReady]);

  const handleActiveViewReady = useCallback((viewMode: ReadyAppViewMode) => {
    readyAppViewsRef.current.add(viewMode);
    if (effectiveAppViewModeRef.current === viewMode) {
      setActiveViewReady(true);
    }
    reportStartupReady();
  }, [reportStartupReady]);

  const handlePrimaryContentReady = useCallback((viewMode: ReadyAppViewMode) => {
    primaryContentReadyAppViewsRef.current.add(viewMode);
    if (effectiveAppViewModeRef.current === viewMode) {
      setPrimaryContentReady(true);
    }
  }, []);

  useEffect(() => {
    if (shouldWaitForInitialUnifiedView) {
      return;
    }
    const nextActiveViewReady = readyAppViewsRef.current.has(effectiveAppViewMode);
    const nextPrimaryContentReady = primaryContentReadyAppViewsRef.current.has(effectiveAppViewMode);
    const nextShouldRenderCenterChrome =
      nextActiveViewReady && (effectiveAppViewMode !== 'notes' || nextPrimaryContentReady);
    setMountedAppViews((views) => {
      if (views.has(effectiveAppViewMode)) return views;
      return new Set([...views, effectiveAppViewMode]);
    });
    setActiveViewReady(nextActiveViewReady);
    setPrimaryContentReady(nextPrimaryContentReady);
    setShouldRenderCenterChrome(nextShouldRenderCenterChrome);
    setShouldRenderDeferredChrome(false);
    didEnableCenterChromeRef.current = nextShouldRenderCenterChrome;
    didEnableDeferredChromeRef.current = false;
    if (centerChromeTimerRef.current !== null) {
      window.clearTimeout(centerChromeTimerRef.current);
      centerChromeTimerRef.current = null;
    }
    if (deferredChromeTimerRef.current !== null) {
      window.clearTimeout(deferredChromeTimerRef.current);
      deferredChromeTimerRef.current = null;
    }
  }, [appViewMode, effectiveAppViewMode, initialUnifiedAppViewMode, shouldWaitForInitialUnifiedView]);

  useEffect(() => {
    if (shouldWaitForInitialUnifiedView) return;
    if (preloadedPrimaryViewRef.current === effectiveAppViewMode) return;
    preloadedPrimaryViewRef.current = effectiveAppViewMode;

    preloadActiveViewModule(effectiveAppViewMode);
  }, [effectiveAppViewMode, shouldWaitForInitialUnifiedView]);

  useEffect(() => {
    if (!activeViewReady) return;

    const enableCenterChrome = () => {
      if (effectiveAppViewMode === 'notes' && !primaryContentReady) return;
      if (didEnableCenterChromeRef.current) return;
      didEnableCenterChromeRef.current = true;
      setShouldRenderCenterChrome(true);
    };

    const enableDeferredChrome = () => {
      if (didEnableDeferredChromeRef.current) return;
      didEnableDeferredChromeRef.current = true;
      setShouldRenderDeferredChrome(true);
    };

    if (!didEnableCenterChromeRef.current) {
      centerChromeTimerRef.current = window.setTimeout(() => {
        centerChromeTimerRef.current = null;
        enableCenterChrome();
      }, CENTER_CHROME_RENDER_DELAY_MS);
    }

    if (!didEnableDeferredChromeRef.current) {
      deferredChromeTimerRef.current = window.setTimeout(() => {
        deferredChromeTimerRef.current = null;
        enableDeferredChrome();
      }, VISIBLE_SIDEBAR_RENDER_DELAY_MS);
    }

    return () => {
      if (centerChromeTimerRef.current !== null) {
        window.clearTimeout(centerChromeTimerRef.current);
        centerChromeTimerRef.current = null;
      }
      if (deferredChromeTimerRef.current !== null) {
        window.clearTimeout(deferredChromeTimerRef.current);
        deferredChromeTimerRef.current = null;
      }
    };
  }, [activeViewReady, effectiveAppViewMode, primaryContentReady]);

  useEffect(() => {
    if (!shouldRenderDeferredChrome) return;
    if (!isPrewarmedAppViewMode(effectiveAppViewMode)) return;

    setRenderedSidebarAppViews((views) => {
      if (views.has(effectiveAppViewMode)) return views;
      return new Set([...views, effectiveAppViewMode]);
    });
  }, [effectiveAppViewMode, shouldRenderDeferredChrome]);

  useEffect(() => {
    if (!activeViewReady || !primaryContentReady) return;
    if (!isPrewarmedAppViewMode(effectiveAppViewMode)) return;

    preloadPrewarmedViewModules();
    void preloadNotesSidebarModule();
    void preloadChatSidebarModule();
    void preloadNotesTabRowModule();
    void preloadModelSelectorModule();
    void preloadTemporaryChatToggleModule();
    void preloadGitTitleBarActionModule();
    if (!didPrewarmManagedModelsRef.current) {
      didPrewarmManagedModelsRef.current = true;
      void preloadAIStoreModule()
        .then((mod) => {
          mod.actions.refreshManagedProviderInBackground();
        })
        .catch(() => {
        });
    }

    setMountedAppViews(addPrewarmedAppViews);
    setRenderedSidebarAppViews(addPrewarmedAppViews);
  }, [activeViewReady, effectiveAppViewMode, primaryContentReady]);

  return {
    handleActiveViewReady,
    handlePrimaryContentReady,
    handleStartupFallbackReady,
    mountedAppViews,
    renderedSidebarAppViews,
    shouldRenderCenterChrome,
    shouldRenderDeferredChrome,
  };
}
