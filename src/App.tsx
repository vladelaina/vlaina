import { lazy, Suspense, useEffect, useState } from 'react';
import { AppContent } from '@/AppContent';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ThemeProvider } from '@/components/theme-provider';
import { useBillingReturnRefresh } from '@/hooks/useBillingReturnRefresh';
import { useElectronCloseGuard } from '@/hooks/useElectronCloseGuard';
import { useAccountSessionStore } from '@/stores/accountSession';
import { useToastStore } from '@/stores/useToastStore';
import { getElectronBridge } from '@/lib/electron/bridge';
import { useDocumentLanguage, useI18n } from '@/lib/i18n';

const ConfirmDialog = lazy(async () => {
  const mod = await import('@/components/common/ConfirmDialog');
  return { default: mod.ConfirmDialog };
});

const ToastContainer = lazy(async () => {
  const mod = await import('@/components/ui/Toast');
  return { default: mod.ToastContainer };
});

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
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
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
      void useAccountSessionStore.getState().checkStatus();

      const timer = window.setTimeout(() => {
        void useAccountSessionStore.getState().checkStatus();
      }, 4000);

      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [t]);

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AppContent />
        <Suspense fallback={null}>
          {isCloseDraftConfirmOpen ? (
            <ConfirmDialog
              isOpen={isCloseDraftConfirmOpen}
              onClose={() => setIsCloseDraftConfirmOpen(false)}
              onConfirm={() => {
                setIsCloseDraftConfirmOpen(false);
                void continueWindowClose({ skipDraftConfirm: true });
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
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
