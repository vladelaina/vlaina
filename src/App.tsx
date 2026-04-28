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

function App() {
  const {
    isCloseDraftConfirmOpen,
    setIsCloseDraftConfirmOpen,
    continueWindowClose,
  } = useElectronCloseGuard();

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
      addToast('Checkout completed. Membership will refresh shortly.', 'success', 5000);
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

    addToast('Checkout was canceled.', 'info', 3500);
  }, []);

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
      <ConfirmDialog
        isOpen={isCloseDraftConfirmOpen}
        onClose={() => setIsCloseDraftConfirmOpen(false)}
        onConfirm={() => void continueWindowClose({ skipDraftConfirm: true })}
        onCancelAction={async () => {
          setIsCloseDraftConfirmOpen(false);
          await continueWindowClose({
            skipDraftConfirm: true,
            saveDrafts: true,
          });
        }}
        title="Unsaved Drafts"
        description="Close vlaina and discard all unsaved drafts? Drafts are only saved when you press Ctrl+S."
        confirmText="Discard and Close"
        cancelText="Save"
        variant="danger"
        initialFocus="cancel"
      />
      <ToastContainer />
    </ThemeProvider>
  );
}

export default App;
