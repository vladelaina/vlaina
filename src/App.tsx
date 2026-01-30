import { useEffect, useState, useCallback, useMemo } from 'react';
import { DndContext, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { windowCommands } from '@/lib/tauri/invoke';
import { isTauri } from '@/lib/storage/adapter';

import { AppShell } from '@/components/layout/shell/AppShell';
import { SidebarUserHeader } from '@/components/layout/SidebarUserHeader';
import { SettingsModal } from '@/components/Settings';
import { ThemeProvider } from '@/components/theme-provider';
import { ToastContainer } from '@/components/ui/Toast';

import { CalendarView } from '@/components/Calendar/CalendarView';
import { NotesView } from '@/components/Notes/NotesView';
import { TodoView } from '@/components/Todo/TodoView';

import { CalendarSidebarWrapper } from '@/components/Calendar/features/Sidebar/CalendarSidebarWrapper';
import { TodoSidebar } from '@/components/Todo/TodoSidebar';
import { NotesSidebarWrapper } from '@/components/Notes/features/Sidebar/NotesSidebarWrapper';

import { CalendarHeaderControl } from '@/components/Calendar/features/Grid/CalendarHeaderControl';
import { NotesTabRow } from '@/components/Notes/features/Tabs/NotesTabRow';

import { useCalendarEventsStore } from '@/stores/calendarEventsSlice';
import { useUIStore } from '@/stores/uiSlice';
import { useVaultStore } from '@/stores/useVaultStore';
import { useVimShortcuts } from '@/hooks/useVimShortcuts';
import { useShortcuts } from '@/hooks/useShortcuts';
import { useSyncInit } from '@/hooks/useSyncInit';

function AppContent() {
  const {
    appViewMode,
    sidebarCollapsed,
    sidebarWidth,
    setSidebarWidth,
    toggleSidebar,
    setSidebarPeeking
  } = useUIStore();
  const { currentVault, initialize } = useVaultStore();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const toggleSettings = useCallback(() => setSettingsOpen(prev => !prev), []);

  const shortcutHandlers = useMemo(() => ({
    'open-settings': toggleSettings,
  }), [toggleSettings]);
  useShortcuts({ handlers: shortcutHandlers });
  useVimShortcuts();

  useSyncInit();
  const loadCalendarEvents = useCalendarEventsStore(state => state.load);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    loadCalendarEvents();
  }, [loadCalendarEvents]);

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

  useEffect(() => {
    if (!isTauri()) return;
    const unlockWindow = async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const { LogicalSize } = await import('@tauri-apps/api/dpi');
      const appWindow = getCurrentWindow();
      await appWindow.setResizable(true);
      await appWindow.setMaximizable(true);
      await appWindow.setMinSize(new LogicalSize(800, 600));
      const size = await appWindow.outerSize();
      if (size.width < 800) {
        await appWindow.setSize(new LogicalSize(1024, 768));
        await appWindow.center();
      }
    };
    unlockWindow();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  let sidebarContent = null;
  let sidebarPeekContent = null;

  if (appViewMode === 'calendar') {
    sidebarContent = <CalendarSidebarWrapper />;
  } else if (appViewMode === 'todo') {
    sidebarContent = <TodoSidebar />;
  } else if (appViewMode === 'notes' && currentVault) {
    sidebarContent = <NotesSidebarWrapper isPeeking={false} />;
    sidebarPeekContent = <NotesSidebarWrapper isPeeking={true} />;
  }

  let centerSlot = null;
  let rightSlot = null;

  if (appViewMode === 'calendar') {
    centerSlot = <CalendarHeaderControl />;
  } else if (appViewMode === 'todo') {
    // No center slot for Todo view
  } else if (appViewMode === 'notes' && currentVault) {
    centerSlot = <NotesTabRow />;
  }

  let mainContent = null;
  if (appViewMode === 'calendar') {
    mainContent = <CalendarView />;
  } else if (appViewMode === 'todo') {
    mainContent = <TodoView />;
  } else {
    // Notes view handles "No Vault" internally
    mainContent = <NotesView />;
  }

  return (
    <DndContext sensors={sensors}>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <AppShell
        sidebarWidth={sidebarWidth}
        sidebarCollapsed={sidebarCollapsed}
        onSidebarWidthChange={setSidebarWidth}
        onSidebarToggle={toggleSidebar}
        onPeekChange={setSidebarPeeking}

        sidebarContent={sidebarContent}
        sidebarPeekContent={sidebarPeekContent || sidebarContent}

        titleBarLeft={
          (appViewMode !== 'notes' || currentVault) ? (
            <SidebarUserHeader
              onOpenSettings={() => setSettingsOpen(true)}
              toggleSidebar={toggleSidebar}
            />
          ) : null
        }
        titleBarCenter={centerSlot}
        titleBarRight={rightSlot}

        backgroundColor="var(--neko-bg-primary)"
      >
        {mainContent}
      </AppShell>
    </DndContext>
  );
}

function App() {
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

  return (
    <ThemeProvider>
      <AppContent />
      <ToastContainer />
    </ThemeProvider>
  );
}

export default App;