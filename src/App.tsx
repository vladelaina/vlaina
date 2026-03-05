import { lazy, Suspense, useEffect, useState } from 'react';
import { DndContext, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { isTauri } from '@/lib/storage/adapter';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalSize } from '@tauri-apps/api/dpi';

import { AppShell } from '@/components/layout/shell/AppShell';
import { SidebarUserHeader } from '@/components/layout/SidebarUserHeader';
import { ThemeProvider } from '@/components/theme-provider';
import { ToastContainer } from '@/components/ui/Toast';
import { useCalendarEventsStore } from '@/stores/calendarEventsSlice';
import { useUIStore } from '@/stores/uiSlice';
import { useVaultStore } from '@/stores/useVaultStore';
import { useShortcuts } from '@/hooks/useShortcuts';
import { useSyncInit } from '@/hooks/useSyncInit';
import { useTemporaryTogglePresentation } from '@/components/Chat/features/Temporary/useTemporaryTogglePresentation';

const SettingsModal = lazy(async () => {
  const mod = await import('@/components/Settings');
  return { default: mod.SettingsModal };
});

const CalendarView = lazy(async () => {
  const mod = await import('@/components/Calendar/CalendarView');
  return { default: mod.CalendarView };
});

const NotesView = lazy(async () => {
  const mod = await import('@/components/Notes/NotesView');
  return { default: mod.NotesView };
});

const TodoView = lazy(async () => {
  const mod = await import('@/components/Todo/TodoView');
  return { default: mod.TodoView };
});

const ChatView = lazy(async () => {
  const mod = await import('@/components/Chat/ChatView');
  return { default: mod.ChatView };
});

const LabView = lazy(async () => {
  const mod = await import('@/components/Lab/LabView');
  return { default: mod.LabView };
});

const CalendarSidebarWrapper = lazy(async () => {
  const mod = await import('@/components/Calendar/features/Sidebar/CalendarSidebarWrapper');
  return { default: mod.CalendarSidebarWrapper };
});

const TodoSidebar = lazy(async () => {
  const mod = await import('@/components/Todo/TodoSidebar');
  return { default: mod.TodoSidebar };
});

const NotesSidebarWrapper = lazy(async () => {
  const mod = await import('@/components/Notes/features/Sidebar/NotesSidebarWrapper');
  return { default: mod.NotesSidebarWrapper };
});

const ChatSidebar = lazy(async () => {
  const mod = await import('@/components/Chat/features/Sidebar/ChatSidebar');
  return { default: mod.ChatSidebar };
});

const TemporaryChatToggle = lazy(async () => {
  const mod = await import('@/components/Chat/features/Temporary/TemporaryChatToggle');
  return { default: mod.TemporaryChatToggle };
});

const CalendarHeaderControl = lazy(async () => {
  const mod = await import('@/components/Calendar/features/Grid/CalendarHeaderControl');
  return { default: mod.CalendarHeaderControl };
});

const NotesTabRow = lazy(async () => {
  const mod = await import('@/components/Notes/features/Tabs/NotesTabRow');
  return { default: mod.NotesTabRow };
});

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
  const { showInTitleBar } = useTemporaryTogglePresentation();
  const shouldShowTemporaryToggleInTitleBar = appViewMode === 'chat' && showInTitleBar;

  const [settingsOpen, setSettingsOpen] = useState(false);

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
    sidebarContent = (
      <Suspense fallback={null}>
        <CalendarSidebarWrapper />
      </Suspense>
    );
  } else if (appViewMode === 'todo') {
    sidebarContent = (
      <Suspense fallback={null}>
        <TodoSidebar />
      </Suspense>
    );
  } else if (appViewMode === 'chat') {
    sidebarContent = (
      <Suspense fallback={null}>
        <ChatSidebar isPeeking={false} />
      </Suspense>
    );
    sidebarPeekContent = (
      <Suspense fallback={null}>
        <ChatSidebar isPeeking={true} />
      </Suspense>
    );
  } else if (appViewMode === 'notes' && currentVault) {
    sidebarContent = (
      <Suspense fallback={null}>
        <NotesSidebarWrapper isPeeking={false} />
      </Suspense>
    );
    sidebarPeekContent = (
      <Suspense fallback={null}>
        <NotesSidebarWrapper isPeeking={true} />
      </Suspense>
    );
  }
  // Lab Mode: No sidebar content by default

  let centerSlot = null;
  let rightSlot = null;

  if (appViewMode === 'calendar') {
    centerSlot = (
      <Suspense fallback={null}>
        <CalendarHeaderControl />
      </Suspense>
    );
  } else if (appViewMode === 'todo') {
  } else if (appViewMode === 'notes' && currentVault) {
    centerSlot = (
      <Suspense fallback={null}>
        <NotesTabRow />
      </Suspense>
    );
  } else if (shouldShowTemporaryToggleInTitleBar) {
    rightSlot = (
      <Suspense fallback={null}>
        <TemporaryChatToggle mode="promote" />
      </Suspense>
    );
  }

  let mainContent = null;
  if (appViewMode === 'calendar') {
    mainContent = (
      <Suspense fallback={null}>
        <CalendarView />
      </Suspense>
    );
  } else if (appViewMode === 'todo') {
    mainContent = (
      <Suspense fallback={null}>
        <TodoView />
      </Suspense>
    );
  } else if (appViewMode === 'chat') {
    mainContent = (
      <Suspense fallback={null}>
        <ChatView />
      </Suspense>
    );
  } else if (appViewMode === 'lab') {
    mainContent = (
      <Suspense fallback={null}>
        <LabView />
      </Suspense>
    );
  } else {
    mainContent = (
      <Suspense fallback={null}>
        <NotesView />
      </Suspense>
    );
  }

  return (
    <DndContext sensors={sensors}>
      <Suspense fallback={null}>
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </Suspense>

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
