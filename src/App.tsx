import { lazy, Suspense, useEffect, useState } from 'react';
import { DndContext, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { isTauri } from '@/lib/storage/adapter';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalSize } from '@tauri-apps/api/dpi';

import { AppShell } from '@/components/layout/shell/AppShell';
import { SidebarUserHeader } from '@/components/layout/SidebarUserHeader';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import { ThemeProvider } from '@/components/theme-provider';
import { ToastContainer } from '@/components/ui/Toast';
import { useAIStore } from '@/stores/useAIStore';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { useVaultStore } from '@/stores/useVaultStore';
import { useShortcuts } from '@/hooks/useShortcuts';
import { useSyncInit } from '@/hooks/useSyncInit';
import { useTemporaryTogglePresentation } from '@/components/Chat/features/Temporary/useTemporaryTogglePresentation';
import { flushPendingSave } from '@/lib/storage/unifiedStorage';
import { flushPendingSessionJsonSaves } from '@/lib/storage/chatStorage';

const SettingsModal = lazy(async () => {
  const mod = await import('@/components/Settings');
  return { default: mod.SettingsModal };
});

const NotesView = lazy(async () => {
  const mod = await import('@/components/Notes/NotesView');
  return { default: mod.NotesView };
});

const ChatView = lazy(async () => {
  const mod = await import('@/components/Chat/ChatView');
  return { default: mod.ChatView };
});

const LabView = lazy(async () => {
  const mod = await import('@/components/Lab/LabView');
  return { default: mod.LabView };
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

const NotesTabRow = lazy(async () => {
  const mod = await import('@/components/Notes/features/Tabs/NotesTabRow');
  return { default: mod.NotesTabRow };
});

function AppContent() {
  useAIStore();

  const {
    appViewMode,
    sidebarCollapsed,
    sidebarWidth,
    notesChatPanelCollapsed,
    setSidebarWidth,
    toggleSidebar,
    setAppViewMode
  } = useUIStore();
  const { currentVault, initialize } = useVaultStore();
  const { showInTitleBar } = useTemporaryTogglePresentation();
  const shouldShowTemporaryToggleInTitleBar =
    showInTitleBar &&
    (
      appViewMode === 'chat' ||
      (appViewMode === 'notes' && currentVault && !notesChatPanelCollapsed)
    );

  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const handleOpenSettings = () => setSettingsOpen(prev => !prev)

    window.addEventListener('open-settings', handleOpenSettings)

    return () => {
        window.removeEventListener('open-settings', handleOpenSettings)
    }
  }, [])

  useShortcuts();

  useSyncInit();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (appViewMode === 'chat' || typeof document === 'undefined') {
      return;
    }
    document.body.removeAttribute('data-chat-selection-lock');
    document.body.removeAttribute('data-chat-selection-freeze');
  }, [appViewMode]);

  useEffect(() => {
    if (!isTauri()) return;
    const unlockWindow = async () => {
      const appWindow = getCurrentWindow();
      await appWindow.setResizable(true);
      await appWindow.setMaximizable(true);
      await appWindow.setMinSize(new LogicalSize(800, 600));
      const size = await appWindow.outerSize();
      if (size.width < 980 || size.height < 640) {
        await appWindow.setSize(new LogicalSize(980, 640));
        await appWindow.center();
      }
    };
    unlockWindow();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const shouldRenderSidebar = appViewMode === 'chat' || appViewMode === 'notes';

  const sidebarContent = shouldRenderSidebar ? (
    <div className="h-full">
      <div className={cn('h-full', appViewMode !== 'chat' && 'hidden')}>
        <Suspense fallback={null}>
          <ChatSidebar isPeeking={false} />
        </Suspense>
      </div>
      <div className={cn('h-full', appViewMode !== 'notes' && 'hidden')}>
        <Suspense fallback={null}>
          <NotesSidebarWrapper isPeeking={false} />
        </Suspense>
      </div>
    </div>
  ) : null;

  let centerSlot = null;
  let rightSlot = null;

  if (appViewMode === 'notes' && currentVault) {
    centerSlot = (
      <Suspense fallback={null}>
        <NotesTabRow />
      </Suspense>
    );
  }

  if (shouldShowTemporaryToggleInTitleBar) {
    rightSlot = (
      <Suspense fallback={null}>
        <TemporaryChatToggle mode="promote" />
      </Suspense>
    );
  }

  let mainContent = null;
  if (appViewMode === 'chat') {
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

  const showLabEntry = import.meta.env.DEV && appViewMode !== 'lab';
  const mainOverlay = showLabEntry ? (
    <div className="pointer-events-none absolute bottom-3 left-2 z-30">
      <Tooltip delayDuration={700}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setAppViewMode('lab')}
            aria-label="Open Design Lab"
            className={cn(
              "pointer-events-auto flex h-8 w-8 items-center justify-center rounded-md border border-[#eff3f4] bg-white/92 shadow-sm backdrop-blur-sm transition-colors hover:bg-[#f5f5f5]",
              iconButtonStyles
            )}
          >
            <Icon name="misc.lab" size="md" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <span className="text-xs">Open Design Lab</span>
        </TooltipContent>
      </Tooltip>
    </div>
  ) : null;

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
        sidebarContent={sidebarContent}

        titleBarLeft={
          <SidebarUserHeader
            onOpenSettings={() => setSettingsOpen(true)}
            toggleSidebar={toggleSidebar}
          />
        }
        titleBarCenter={centerSlot}
        titleBarRight={rightSlot}
        mainOverlay={mainOverlay}

        backgroundColor="var(--vlaina-sidebar-bg)"
      >
        {mainContent}
      </AppShell>
    </DndContext>
  );
}

function App() {
  useEffect(() => {
    let isFlushing = false;

    const flushAllPendingWrites = () => {
      if (isFlushing) return;
      isFlushing = true;

      const tasks: Array<{ name: string; task: Promise<unknown> }> = [
        { name: 'unified storage', task: flushPendingSave() },
        { name: 'chat session storage', task: flushPendingSessionJsonSaves() },
      ];

      const notesState = useNotesStore.getState();
      if (notesState.isDirty) {
        tasks.push({
          name: 'notes storage',
          task: notesState.saveNote().then(() => {
            if (useNotesStore.getState().isDirty) {
              throw new Error('Notes still dirty after save attempt');
            }
          }),
        });
      }

      void Promise.allSettled(tasks.map((entry) => entry.task))
        .then((results) => {
          results.forEach((result, index) => {
            if (result.status === 'rejected') {
              console.error(`[App] Failed to flush ${tasks[index].name}:`, result.reason);
            }
          });
        })
        .finally(() => {
          isFlushing = false;
        });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushAllPendingWrites();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushAllPendingWrites);
    window.addEventListener('beforeunload', flushAllPendingWrites);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushAllPendingWrites);
      window.removeEventListener('beforeunload', flushAllPendingWrites);
    };
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

  return (
    <ThemeProvider>
      <AppContent />
      <ToastContainer />
    </ThemeProvider>
  );
}

export default App;
