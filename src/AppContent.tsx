import { lazy, Suspense, useEffect, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { AppShell } from '@/components/layout/shell/AppShell';
import { SidebarUserHeader } from '@/components/layout/SidebarUserHeader';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import { useAIStoreRuntimeEffects } from '@/stores/useAIStore';
import { useUIStore } from '@/stores/uiSlice';
import { useVaultStore } from '@/stores/useVaultStore';
import { useShortcuts } from '@/hooks/useShortcuts';
import { useSyncInit } from '@/hooks/useSyncInit';
import { useUnifiedExternalSync } from '@/hooks/useUnifiedExternalSync';
import { useTemporaryTogglePresentation } from '@/components/Chat/features/Temporary/useTemporaryTogglePresentation';
import { desktopWindow } from '@/lib/desktop/window';
import { isElectronRuntime } from '@/lib/electron/bridge';

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

export function AppContent() {
  useAIStoreRuntimeEffects();

  const {
    appViewMode,
    sidebarCollapsed,
    sidebarWidth,
    notesChatPanelCollapsed,
    setSidebarWidth,
    toggleSidebar,
    setAppViewMode,
  } = useUIStore();
  const { currentVault, initialize } = useVaultStore();
  const { showInTitleBar } = useTemporaryTogglePresentation();
  const shouldShowTemporaryToggleInTitleBar =
    showInTitleBar &&
    (appViewMode === 'chat' || (appViewMode === 'notes' && currentVault && !notesChatPanelCollapsed));

  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const handleOpenSettings = () => setSettingsOpen(true);
    window.addEventListener('open-settings', handleOpenSettings);
    return () => {
      window.removeEventListener('open-settings', handleOpenSettings);
    };
  }, []);

  useShortcuts();
  useSyncInit();
  useUnifiedExternalSync();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (appViewMode === 'chat' || typeof document === 'undefined') return;
    document.body.removeAttribute('data-chat-selection-lock');
    document.body.removeAttribute('data-chat-selection-freeze');
  }, [appViewMode]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('spellcheck', 'false');
    document.body.setAttribute('spellcheck', 'false');
  }, []);

  useEffect(() => {
    if (!isElectronRuntime()) return;

    const unlockWindow = async () => {
      await desktopWindow.setResizable(true);
      await desktopWindow.setMaximizable(true);
      await desktopWindow.setMinSize({ width: 800, height: 600 });
      const size = await desktopWindow.getSize();
      if (size.width < 980 || size.height < 640) {
        await desktopWindow.setSize({ width: 980, height: 640 });
        await desktopWindow.center();
      }
    };
    void unlockWindow();
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
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

  const centerSlot = appViewMode === 'notes' ? (
    <Suspense fallback={null}>
      <NotesTabRow />
    </Suspense>
  ) : null;

  const rightSlot = shouldShowTemporaryToggleInTitleBar ? (
    <Suspense fallback={null}>
      <TemporaryChatToggle mode="promote" />
    </Suspense>
  ) : null;

  const mainContent = appViewMode === 'lab' ? (
    <Suspense fallback={null}>
      <LabView />
    </Suspense>
  ) : (
    <>
      <div className={cn('h-full', appViewMode !== 'notes' && 'hidden')} aria-hidden={appViewMode !== 'notes'}>
        <Suspense fallback={null}>
          <NotesView active={appViewMode === 'notes'} />
        </Suspense>
      </div>
      <div className={cn('h-full', appViewMode !== 'chat' && 'hidden')} aria-hidden={appViewMode !== 'chat'}>
        <Suspense fallback={null}>
          <ChatView active={appViewMode === 'chat'} />
        </Suspense>
      </div>
    </>
  );

  const showLabEntry = import.meta.env.DEV && appViewMode !== 'lab';
  const mainOverlay = showLabEntry ? (
    <div className="pointer-events-none absolute bottom-3 right-3 z-30">
      <Tooltip delayDuration={700}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setAppViewMode('lab')}
            aria-label="Open Design Lab"
            className={cn(
              'pointer-events-auto flex h-8 w-8 items-center justify-center rounded-md border border-[#eff3f4] bg-white/92 shadow-sm backdrop-blur-sm transition-colors hover:bg-[#f5f5f5]',
              iconButtonStyles
            )}
          >
            <Icon name="misc.lab" size="md" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={8}>
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
        titleBarLeft={<SidebarUserHeader toggleSidebar={toggleSidebar} />}
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
