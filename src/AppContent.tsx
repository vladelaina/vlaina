import { AppContentShell } from './AppContentShell';
import { useAppContentRuntimeEffects } from './useAppContentRuntimeEffects';
import { useAppContentViewLifecycle } from './useAppContentViewLifecycle';
import { useAppSettingsController } from './useAppSettingsController';
import { useAppStartupViewMode } from './useAppStartupViewMode';

export function AppContent() {
  const {
    appViewMode,
    effectiveAppViewMode,
    hasLaunchViewMode,
    initialUnifiedAppViewMode,
    shouldWaitForInitialUnifiedView,
    unifiedLoaded,
  } = useAppStartupViewMode();
  const {
    closeSettings,
    communitySettings,
    hasOpenedSettings,
    settingsOpen,
    settingsRequestedTab,
  } = useAppSettingsController();
  const {
    handleActiveViewReady,
    handlePrimaryContentReady,
    handleStartupFallbackReady,
    mountedAppViews,
    renderedSidebarAppViews,
    shouldRenderCenterChrome,
    shouldRenderDeferredChrome,
  } = useAppContentViewLifecycle({
    appViewMode,
    effectiveAppViewMode,
    hasLaunchViewMode,
    initialUnifiedAppViewMode,
    shouldWaitForInitialUnifiedView,
  });

  useAppContentRuntimeEffects({
    effectiveAppViewMode,
    unifiedLoaded,
  });

  return (
    <AppContentShell
      communitySettings={communitySettings}
      effectiveAppViewMode={effectiveAppViewMode}
      hasOpenedSettings={hasOpenedSettings}
      mountedAppViews={mountedAppViews}
      onActiveViewReady={handleActiveViewReady}
      onPrimaryContentReady={handlePrimaryContentReady}
      onSettingsClose={closeSettings}
      onStartupFallbackReady={handleStartupFallbackReady}
      renderedSidebarAppViews={renderedSidebarAppViews}
      settingsOpen={settingsOpen}
      settingsRequestedTab={settingsRequestedTab}
      shouldRenderCenterChrome={shouldRenderCenterChrome}
      shouldRenderDeferredChrome={shouldRenderDeferredChrome}
      shouldWaitForInitialUnifiedView={shouldWaitForInitialUnifiedView}
    />
  );
}
