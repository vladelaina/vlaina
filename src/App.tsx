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
import { ChatView } from '@/components/Chat/ChatView';
import { LabView } from '@/components/Lab/LabView';

import { CalendarSidebarWrapper } from '@/components/Calendar/features/Sidebar/CalendarSidebarWrapper';
import { TodoSidebar } from '@/components/Todo/TodoSidebar';
import { NotesSidebarWrapper } from '@/components/Notes/features/Sidebar/NotesSidebarWrapper';
import { ChatSidebar } from '@/components/Chat/ChatSidebar';

import { CalendarHeaderControl } from '@/components/Calendar/features/Grid/CalendarHeaderControl';
import { NotesTabRow } from '@/components/Notes/features/Tabs/NotesTabRow';

import { useCalendarEventsStore } from '@/stores/calendarEventsSlice';
import { useUIStore } from '@/stores/uiSlice';
import { useVaultStore } from '@/stores/useVaultStore';
import { useShortcuts } from '@/hooks/useShortcuts';
import { useSyncInit } from '@/hooks/useSyncInit';

function AppContent() {
  const {
    appViewMode,
    sidebarCollapsed,
    sidebarWidth,
    setSidebarWidth,
    toggleSidebar,
    setSidebarPeeking,
    setAppViewMode
  } = useUIStore();
  const { currentVault, initialize } = useVaultStore();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const toggleSettings = useCallback(() => setSettingsOpen(prev => !prev), []);

  useEffect(() => {
    const handleOpenSettings = () => setSettingsOpen(prev => !prev)
    const handleOpenLab = () => setAppViewMode('lab') // Switch view to Lab
    
    window.addEventListener('open-settings', handleOpenSettings)
    window.addEventListener('open-lab', handleOpenLab)
    
    return () => {
        window.removeEventListener('open-settings', handleOpenSettings)
        window.removeEventListener('open-lab', handleOpenLab)
    }
  }, [setAppViewMode])

  useShortcuts();

  useSyncInit();
  const loadCalendarEvents = useCalendarEventsStore(state => state.load);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    loadCalendarEvents();
  }, [loadCalendarEvents]);

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
  } else if (appViewMode === 'chat') {
    sidebarContent = <ChatSidebar isPeeking={false} />;
    sidebarPeekContent = <ChatSidebar isPeeking={true} />;
  } else if (appViewMode === 'notes' && currentVault) {
    sidebarContent = <NotesSidebarWrapper isPeeking={false} />;
    sidebarPeekContent = <NotesSidebarWrapper isPeeking={true} />;
  }
  // Lab Mode: No sidebar content by default

  let centerSlot = null;
  let rightSlot = null;

  if (appViewMode === 'calendar') {
    centerSlot = <CalendarHeaderControl />;
  } else if (appViewMode === 'todo') {
  } else if (appViewMode === 'notes' && currentVault) {
    centerSlot = <NotesTabRow />;
  }

  let mainContent = null;
  if (appViewMode === 'calendar') {
    mainContent = <CalendarView />;
  } else if (appViewMode === 'todo') {
    mainContent = <TodoView />;
  } else if (appViewMode === 'chat') {
    mainContent = <ChatView />;
  } else if (appViewMode === 'lab') {
    mainContent = <LabView />;
  } else {
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