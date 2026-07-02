import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { AppContent } from '@/AppContent';
import { DiagnosticsPanel } from '@/components/common/DiagnosticsPanel';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { MarkdownThemeDirectorySync } from '@/components/markdown-theme/MarkdownThemeDirectorySync';
import { MarkdownThemeLoader } from '@/components/markdown-theme/MarkdownThemeLoader';
import { useImportedMarkdownThemePlatform } from '@/components/markdown-theme/useImportedMarkdownThemePlatform';
import { ThemeProvider } from '@/components/theme-provider';
import { useBillingReturnRefresh } from '@/hooks/useBillingReturnRefresh';
import { useElectronCloseGuard } from '@/hooks/useElectronCloseGuard';
import { useNativeCaretOverlay } from '@/hooks/useNativeCaretOverlay';
import { useAccountSessionStore } from '@/stores/accountSession';
import { selectMarkdownImportedThemeId } from '@/stores/unified/settings/markdownSettings';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useToastStore } from '@/stores/useToastStore';
import { getElectronBridge } from '@/lib/electron/bridge';
import { useDocumentLanguage, useI18n } from '@/lib/i18n';
import {
  resolveImportedMarkdownThemeColorModePreference,
} from '@/lib/markdown/theme-compatibility/colorScheme';
import {
  normalizeColorModePreference,
  suppressDocumentThemeTransitions,
  syncDocumentColorModeClass,
} from '@/lib/theme/colorModeSync';

const ConfirmDialog = lazy(async () => {
  const mod = await import('@/components/common/ConfirmDialog');
  return { default: mod.ConfirmDialog };
});

const ToastContainer = lazy(async () => {
  const mod = await import('@/components/ui/Toast');
  return { default: mod.ToastContainer };
});

const ACCOUNT_FOCUS_REFRESH_THROTTLE_MS = 1500;

function AppThemeSync() {
  const { setTheme } = useTheme();
  const colorMode = useUnifiedStore((state) => state.data.settings.ui?.colorMode);
  const importedThemeId = useUnifiedStore(selectMarkdownImportedThemeId);
  const importedThemePlatform = useImportedMarkdownThemePlatform(importedThemeId);

  useLayoutEffect(() => {
    const normalizedColorMode = normalizeColorModePreference(colorMode);
    const effectiveColorMode = resolveImportedMarkdownThemeColorModePreference({
      importedThemeId,
      importedThemePlatform,
      appPreference: normalizedColorMode,
    });

    const releaseThemeTransitions = suppressDocumentThemeTransitions();
    const cleanupColorModeSync = syncDocumentColorModeClass(effectiveColorMode);
    setTheme(effectiveColorMode);
    releaseThemeTransitions();

    return cleanupColorModeSync;
  }, [colorMode, importedThemeId, importedThemePlatform, setTheme]);

  return null;
}

function App() {
  const { language, t } = useI18n();
  const [hasToasts, setHasToasts] = useState(() =>
    Boolean(useToastStore.getState().toasts?.length)
  );
  const {
    isCloseDraftConfirmOpen,
    isCloseFailureConfirmOpen,
    setIsCloseDraftConfirmOpen,
    setIsCloseFailureConfirmOpen,
    continueWindowClose,
    forceWindowClose,
  } = useElectronCloseGuard();
  useDocumentLanguage(language);
  useBillingReturnRefresh();
  useNativeCaretOverlay();

  useEffect(() => {
    void getElectronBridge()?.app?.setLanguage?.(language);
  }, [language]);

  useEffect(() => {
    if (typeof useToastStore.subscribe !== 'function') {
      return;
    }

    return useToastStore.subscribe((state) => {
      setHasToasts(state.toasts.length > 0);
    });
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  useEffect(() => {
    let lastRefreshAt = 0;

    const refreshAccountStatus = () => {
      const now = Date.now();
      if (now - lastRefreshAt < ACCOUNT_FOCUS_REFRESH_THROTTLE_MS) {
        return;
      }
      lastRefreshAt = now;
      void useAccountSessionStore.getState().checkStatus();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAccountStatus();
      }
    };

    window.addEventListener('focus', refreshAccountStatus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    refreshAccountStatus();

    return () => {
      window.removeEventListener('focus', refreshAccountStatus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const billingResult = url.searchParams.get('billing');

    if (billingResult !== 'success' && billingResult !== 'cancel') return;

    url.searchParams.delete('billing');
    window.history.replaceState({}, document.title, url.toString());

    const addToast = useToastStore.getState().addToast;
    if (billingResult === 'success') {
      addToast(t('app.checkoutCompleted'), 'success', 5000);
      void useAccountSessionStore.getState().checkStatus({ force: true, refreshBudget: 'force' });

      const timer = window.setTimeout(() => {
        void useAccountSessionStore.getState().checkStatus({ force: true, refreshBudget: 'force' });
      }, 4000);

      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [t]);

  return (
    <ThemeProvider>
      <AppThemeSync />
      <MarkdownThemeDirectorySync />
      <MarkdownThemeLoader />
      <ErrorBoundary>
        <AppContent />
        <Suspense fallback={null}>
          {isCloseDraftConfirmOpen ? (
            <ConfirmDialog
              isOpen={isCloseDraftConfirmOpen}
              onClose={() => setIsCloseDraftConfirmOpen(false)}
              onConfirm={() => {
                setIsCloseDraftConfirmOpen(false);
                void continueWindowClose({ skipDraftConfirm: true }).catch(() => undefined);
              }}
              onCancelAction={async () => {
                setIsCloseDraftConfirmOpen(false);
                await continueWindowClose({
                  skipDraftConfirm: true,
                  saveDrafts: true,
                });
              }}
              title={t('app.unsavedDraftsTitle')}
              description={t('app.unsavedDraftsDescription')}
              confirmText={t('app.unsavedDraftsConfirm')}
              cancelText={t('app.unsavedDraftsCancel')}
              variant="danger"
              initialFocus="cancel"
            />
          ) : null}
          {isCloseFailureConfirmOpen ? (
            <ConfirmDialog
              isOpen={isCloseFailureConfirmOpen}
              onClose={() => setIsCloseFailureConfirmOpen(false)}
              onConfirm={() => {
                void forceWindowClose();
              }}
              onCancelAction={async () => {
                setIsCloseFailureConfirmOpen(false);
                await continueWindowClose();
              }}
              title={t('app.closeSaveFailedTitle')}
              description={t('app.closeSaveFailedDescription')}
              confirmText={t('app.unsavedDraftsConfirm')}
              cancelText={t('common.retry')}
              variant="danger"
              initialFocus="cancel"
            />
          ) : null}
        </Suspense>
        {hasToasts ? (
          <Suspense fallback={null}>
            <ToastContainer />
          </Suspense>
        ) : null}
        {import.meta.env.DEV ? <DiagnosticsPanel /> : null}
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
