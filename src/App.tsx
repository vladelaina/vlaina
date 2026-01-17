import { useEffect, useState, useCallback, useMemo } from 'react';
import { DndContext, useSensor, useSensors, PointerSensor, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { windowCommands } from '@/lib/tauri/invoke';
import { isTauri } from '@/lib/storage/adapter';
import { SettingsModal } from '@/components/Settings';
import { CalendarPage, CalendarToolbar, CalendarSidebar, CalendarDetailPanel } from '@/components/Calendar';
import { CalendarHeaderControl } from '@/components/Calendar/features/Grid/CalendarHeaderControl';
// CalendarContextPanel removed, using CalendarTaskPanel via '@/components/Calendar'
import { NotesPage } from '@/components/Notes/NotesPage';
import { TodoPage } from '@/components/Todo/TodoPage';
import { TodoSidebar } from '@/components/Todo/TodoSidebar';
import { Layout } from '@/components/layout';
import { ThemeProvider } from '@/components/theme-provider';
import { ToastContainer } from '@/components/ui/Toast';
import { useGroupStore } from '@/stores/useGroupStore';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useCalendarEventsStore } from '@/stores/calendarEventsSlice';
import { useUIStore } from '@/stores/uiSlice';
import { useVimShortcuts } from '@/hooks/useVimShortcuts';
import { useShortcuts } from '@/hooks/useShortcuts';
import { useSyncInit } from '@/hooks/useSyncInit';




function AppContent() {
  const { loadData } = useGroupStore();
  const { showContextPanel, selectedDate, hourHeight, viewMode, dayCount } = useCalendarStore();
  const { appViewMode, showSidebar } = useUIStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const toggleSettings = useCallback(() => setSettingsOpen(prev => !prev), []);

  const shortcutHandlers = useMemo(() => ({
    'open-settings': toggleSettings,
  }), [toggleSettings]);

  useShortcuts({ handlers: shortcutHandlers });

  // Ctrl+Shift+N: Open new window (registered once at app level)
  useEffect(() => {
    const handleNewWindow = async (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        e.stopPropagation();
        await windowCommands.createNewWindow();
      }
    };

    window.addEventListener('keydown', handleNewWindow);
    return () => window.removeEventListener('keydown', handleNewWindow);
  }, []);

  // Enable VIM-style keyboard navigation
  useVimShortcuts();

  // Initialize sync status (check connection, refresh tokens if needed)
  useSyncInit();

  // Load data on app startup
  const loadCalendarEvents = useCalendarEventsStore(state => state.load);
  useEffect(() => {
    loadData();
    loadCalendarEvents();
  }, [loadData, loadCalendarEvents]);

  // Window Unlocker: When we reach the main app, unlock the window!
  useEffect(() => {
    if (!isTauri()) return;

    const unlockWindow = async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const { LogicalSize } = await import('@tauri-apps/api/dpi');
      const appWindow = getCurrentWindow();

      await appWindow.setResizable(true);
      await appWindow.setMaximizable(true);

      // Optional: Enforce a minimum specific size for the app
      await appWindow.setMinSize(new LogicalSize(800, 600));

      // If coming from welcome screen (which is small), resize to workspace size
      const size = await appWindow.outerSize();
      if (size.width < 800) {
        await appWindow.setSize(new LogicalSize(1024, 768));
        await appWindow.center();
      }
    };
    unlockWindow();
  }, []);

  // DnD sensors for cross-panel dragging
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (_event: DragStartEvent) => {
    // Global drag tracking if needed
  };

  const handleDragEnd = (_event: DragEndEvent) => {
    // Global drag handling if needed
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Settings Modal - Global */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Conditional View Rendering */}
      {appViewMode === 'calendar' ? (
        /* Calendar Page */
        <Layout
          onOpenSettings={() => setSettingsOpen(true)}
          toolbar={<CalendarToolbar />}
          content={<CalendarHeaderControl />}
          leftPanel={<CalendarSidebar />}
          showLeftPanel={showSidebar}
          leftPanelResizable={false}
          rightPanel={<CalendarDetailPanel />}
          showRightPanel={showContextPanel}
        >
          <CalendarPage />
        </Layout>
      ) : appViewMode === 'todo' ? (
        /* Todo Page */
        <Layout
          onOpenSettings={() => setSettingsOpen(true)}
          leftPanel={<TodoSidebar />}
          showLeftPanel={showSidebar}
          leftPanelResizable={false}
          rightPanel={<CalendarDetailPanel />}
          showRightPanel={showContextPanel}
        >
          <TodoPage />
        </Layout>
      ) : (
        /* Notes Page */
        <Layout
          onOpenSettings={() => setSettingsOpen(true)}
        >
          <NotesPage onOpenSettings={() => setSettingsOpen(true)} />
        </Layout>
      )}
    </DndContext>
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

  // Disable browser context menu (right-click menu) - only in production
  useEffect(() => {
    // Allow context menu in development for debugging
    if (import.meta.env.DEV) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  return (
    <ThemeProvider>
      <AppContent />
      <ToastContainer />
    </ThemeProvider>
  );
}

export default App;
