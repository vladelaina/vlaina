import { useEffect } from 'react';
import { AppContent } from '@/AppContent';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ThemeProvider } from '@/components/theme-provider';
import { ToastContainer } from '@/components/ui/Toast';
import { useElectronCloseGuard } from '@/hooks/useElectronCloseGuard';
import { useManagedAIStore } from '@/stores/useManagedAIStore';
import { useAccountSessionStore } from '@/stores/accountSession';
import { useToastStore } from '@/stores/useToastStore';
import { useDocumentLanguage, useI18n } from '@/lib/i18n';

function App() {
  const { language, t } = useI18n();
  const {
    isCloseDraftConfirmOpen,
    setIsCloseDraftConfirmOpen,
    continueWindowClose,
  } = useElectronCloseGuard();
  useDocumentLanguage(language);

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
      void useManagedAIStore.getState().refreshBudget();

      const timer = window.setTimeout(() => {
        void useAccountSessionStore.getState().checkStatus();
        void useManagedAIStore.getState().refreshBudget();
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
      </ErrorBoundary>
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
      <ToastContainer />
    </ThemeProvider>
  );
}

export default App;
