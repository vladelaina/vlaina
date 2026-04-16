import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
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
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { useAIStore } from '@/stores/useAIStore';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { useVaultStore } from '@/stores/useVaultStore';
import { useShortcuts } from '@/hooks/useShortcuts';
import { useSyncInit } from '@/hooks/useSyncInit';
import { useUnifiedExternalSync } from '@/hooks/useUnifiedExternalSync';
import { useTemporaryTogglePresentation } from '@/components/Chat/features/Temporary/useTemporaryTogglePresentation';
import { flushPendingSave } from '@/lib/storage/unifiedStorage';
import { flushPendingSessionJsonSaves } from '@/lib/storage/chatStorage';
import { hasDraftUnsavedChanges, isDraftNotePath } from '@/stores/notes/draftNote';
import { openStoredNotePath } from '@/stores/notes/openNotePath';

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
  useUnifiedExternalSync();

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

  if (appViewMode === 'notes') {
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
  const [isCloseDraftConfirmOpen, setIsCloseDraftConfirmOpen] = useState(false);
  const allowNextWindowCloseRef = useRef(false);
  const runFlushAllPendingWritesRef = useRef<() => Promise<boolean>>(async () => true);

  const getDiscardableDraftPaths = useCallback(() => {
    const notesState = useNotesStore.getState();

    return notesState.openTabs.flatMap((tab) => {
      if (!isDraftNotePath(tab.path)) {
        return [];
      }

      const draftEntry = notesState.draftNotes[tab.path];
      const hasDraftTitle = Boolean(draftEntry?.name.trim());
      const draftContent = notesState.noteContentsCache.get(tab.path)?.content ?? '';
      const draftMetadata = notesState.noteMetadata?.notes[tab.path];

      return hasDraftUnsavedChanges({
        draftName: hasDraftTitle ? draftEntry?.name : draftEntry?.name,
        content: draftContent,
        metadata: draftMetadata,
      }) ? [tab.path] : [];
    });
  }, []);

  const restorePathAfterCloseInterruption = useCallback(async (path: string | null) => {
    if (!path) {
      return;
    }

    const notesState = useNotesStore.getState();
    if (!notesState.openTabs.some((tab) => tab.path === path) && notesState.currentNote?.path !== path) {
      return;
    }

    await openStoredNotePath(path, {
      openNote: notesState.openNote,
      openNoteByAbsolutePath: notesState.openNoteByAbsolutePath,
    });
  }, []);

  const hasDiscardableDrafts = useCallback(() => {
    return getDiscardableDraftPaths().length > 0;
  }, [getDiscardableDraftPaths]);

  const saveDraftsBeforeClose = useCallback(async () => {
    const draftPaths = getDiscardableDraftPaths();
    if (draftPaths.length === 0) {
      return {
        saved: true,
        restorePath: useNotesStore.getState().currentNote?.path ?? null,
      };
    }

    let restorePath = useNotesStore.getState().currentNote?.path ?? null;

    for (const draftPath of draftPaths) {
      const latestState = useNotesStore.getState();
      if (latestState.currentNote?.path === draftPath) {
      } else {
        await latestState.openNote(draftPath);
      }

      const currentState = useNotesStore.getState();
      if (currentState.currentNote?.path !== draftPath || !currentState.draftNotes[draftPath]) {
        await restorePathAfterCloseInterruption(restorePath);
        return {
          saved: false,
          restorePath,
        };
      }

      await currentState.saveNote({ explicit: true, suppressOpenTarget: true });

      const afterSaveState = useNotesStore.getState();
      if (restorePath === draftPath) {
        restorePath = afterSaveState.currentNote?.path ?? restorePath;
      }

      if (afterSaveState.draftNotes[draftPath]) {
        await restorePathAfterCloseInterruption(restorePath);
        return {
          saved: false,
          restorePath,
        };
      }
    }

    return {
      saved: true,
      restorePath,
    };
  }, [getDiscardableDraftPaths, restorePathAfterCloseInterruption]);

  const continueWindowClose = useCallback(async (
    options?: {
      skipDraftConfirm?: boolean;
      saveDrafts?: boolean;
    }
  ) => {
    const skipDraftConfirm = options?.skipDraftConfirm ?? false;
    const saveDrafts = options?.saveDrafts ?? false;
    const hasUnsavedDrafts = hasDiscardableDrafts();
    let restorePath: string | null = null;

    if (hasUnsavedDrafts && !skipDraftConfirm) {
      setIsCloseDraftConfirmOpen(true);
      return;
    }

    if (saveDrafts) {
      const saveResult = await saveDraftsBeforeClose();
      restorePath = saveResult.restorePath;
      if (!saveResult.saved) {
        return;
      }
    }

    const latestNotesState = useNotesStore.getState();
    if (latestNotesState.isDirty && !isDraftNotePath(latestNotesState.currentNote?.path)) {
      const flushed = await runFlushAllPendingWritesRef.current();
      if (!flushed) {
        await restorePathAfterCloseInterruption(restorePath);
        return;
      }
    }

    if (!isTauri()) {
      await restorePathAfterCloseInterruption(restorePath);
      return;
    }

    try {
      allowNextWindowCloseRef.current = true;
      await getCurrentWindow().close();
    } catch {
      allowNextWindowCloseRef.current = false;
      await restorePathAfterCloseInterruption(restorePath);
    }
  }, [hasDiscardableDrafts, restorePathAfterCloseInterruption, saveDraftsBeforeClose]);

  useEffect(() => {
    let activeFlush: Promise<boolean> | null = null;
    let unlistenCloseRequested: (() => void) | null = null;

    const runFlushAllPendingWrites = async (): Promise<boolean> => {
      if (activeFlush) {
        return activeFlush;
      }

      activeFlush = (async () => {
        const tasks: Array<{ name: string; task: Promise<unknown> }> = [
          { name: 'unified storage', task: flushPendingSave() },
          { name: 'chat session storage', task: flushPendingSessionJsonSaves() },
        ];

        const notesState = useNotesStore.getState();
        if (notesState.isDirty && !isDraftNotePath(notesState.currentNote?.path)) {
          tasks.push({
            name: 'notes storage',
            task: notesState.saveNote().then(() => {
              if (useNotesStore.getState().isDirty) {
                throw new Error('Notes still dirty after save attempt');
              }
            }),
          });
        }

        const results = await Promise.allSettled(tasks.map((entry) => entry.task));
        let hasFailure = false;

        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            hasFailure = true;
            console.error(`[App] Failed to flush ${tasks[index].name}:`, result.reason);
          }
        });

        return !hasFailure && !useNotesStore.getState().isDirty;
      })().finally(() => {
        activeFlush = null;
      });

      return activeFlush;
    };

    const flushAllPendingWrites = () => {
      void runFlushAllPendingWrites();
    };

    runFlushAllPendingWritesRef.current = runFlushAllPendingWrites;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushAllPendingWrites();
      }
    };

    if (isTauri()) {
      void getCurrentWindow().onCloseRequested(async (event) => {
        if (allowNextWindowCloseRef.current) {
          allowNextWindowCloseRef.current = false;
          return;
        }

        const notesState = useNotesStore.getState();
        const hasUnsavedDrafts = hasDiscardableDrafts();

        if (!notesState.isDirty && !hasUnsavedDrafts) {
          return;
        }

        event.preventDefault();
        await continueWindowClose();
      }).then((unlisten) => {
        unlistenCloseRequested = unlisten;
      });
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushAllPendingWrites);
    window.addEventListener('beforeunload', flushAllPendingWrites);

    return () => {
      unlistenCloseRequested?.();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushAllPendingWrites);
      window.removeEventListener('beforeunload', flushAllPendingWrites);
      runFlushAllPendingWritesRef.current = async () => true;
    };
  }, [continueWindowClose, hasDiscardableDrafts]);

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
