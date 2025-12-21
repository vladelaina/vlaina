import { useEffect, useState } from 'react';
import { SettingsModal } from '@/components/common/Settings';
import { CalendarPage, CalendarToolbar, CalendarTaskPanel } from '@/components/Calendar';
import { Layout } from '@/components/layout';
import { ThemeProvider } from '@/components/theme-provider';
import { ToastContainer } from '@/components/ui/Toast';
import { useGroupStore } from '@/stores/useGroupStore';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useVimShortcuts } from '@/hooks/useVimShortcuts';
import { useShortcuts } from '@/hooks/useShortcuts';
import { getShortcutKeys } from '@/lib/shortcuts';

function AppContent() {
  // Enable shortcuts
  useShortcuts();
  const { loadData } = useGroupStore();
  const { showContextPanel } = useCalendarStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Enable VIM-style keyboard navigation
  useVimShortcuts();

  // Load data on app startup
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open/close settings shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Settings shortcut
      const keys = getShortcutKeys('open-settings');
      if (!keys || keys.length === 0) return;

      const matchesShortcut = keys.every((key: string) => {
        if (key === 'Ctrl') return e.ctrlKey;
        if (key === 'Shift') return e.shiftKey;
        if (key === 'Alt') return e.altKey;
        if (key === 'Meta') return e.metaKey;
        return e.key.toUpperCase() === key.toUpperCase();
      });

      if (matchesShortcut) {
        e.preventDefault();
        setSettingsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      {/* Settings Modal - Global */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Calendar Page */}
      <Layout 
        onOpenSettings={() => setSettingsOpen(true)} 
        toolbar={<CalendarToolbar />}
        rightPanel={<CalendarTaskPanel />}
        showRightPanel={showContextPanel}
      >
        <CalendarPage />
      </Layout>
    </>
  );
}

function App() {
  // Prevent default browser zoom behavior on Ctrl+scroll
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <ThemeProvider>
      <AppContent />
      <ToastContainer />
    </ThemeProvider>
  );
}

export default App;
