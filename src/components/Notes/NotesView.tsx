import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { useUIStore } from '@/stores/uiSlice';
import { ResizablePanel } from '@/components/layout/ResizablePanel';
import { ModuleShortcutsDialog } from '@/components/common/ModuleShortcutsDialog';
import { readWindowLaunchContext } from '@/lib/desktop/launchContext';
import { MarkdownEditor } from './features/Editor';
import { useNotesViewShortcuts } from './hooks/useNotesViewShortcuts';
import { useModuleShortcutsDialog } from '@/hooks/useModuleShortcutsDialog';
import { useCurrentVaultExternalPathSync } from './hooks/useCurrentVaultExternalPathSync';
import { useCurrentVaultInitialization } from './hooks/useCurrentVaultInitialization';
import { useNotesChatComposerFocus } from './hooks/useNotesChatComposerFocus';
import { useAbsoluteNoteExternalRenameSync } from './hooks/useAbsoluteNoteExternalRenameSync';
import { useNotesExternalSync } from './hooks/useNotesExternalSync';
import { useNotesOpenMarkdownTarget } from './hooks/useNotesOpenMarkdownTarget';
import { openStoredNotePath } from '@/stores/notes/openNotePath';
import { hasDraftUnsavedChanges, isDraftNotePath } from '@/stores/notes/draftNote';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { BlurBackdrop } from '@/components/common/BlurBackdrop';
import { TreeItemDeleteDialog } from '@/components/Notes/features/FileTree/components/TreeItemDeleteDialog';
import { subscribeDeleteCurrentNoteEvent } from '@/components/Notes/noteDeleteEvents';
import { useBlankWorkspaceDropOpen } from './hooks/useBlankWorkspaceDropOpen';
import { useNotesSidebarExternalDropImport } from './hooks/useNotesSidebarExternalDropImport';
import { collectNotePathsInTreeOrder } from './features/common/noteTreeNavigation';
import { scheduleSidebarItemIntoView } from './features/common/sidebarScrollIntoView';
import { logNotesDebug } from '@/stores/notes/lineBreakDebugLog';

const EmbeddedChatView = lazy(async () => {
  const mod = await import('@/components/Chat/ChatView');
  return { default: mod.ChatView };
});

export function NotesView({ active = true }: { active?: boolean }) {
  const currentNote = useNotesStore(s => s.currentNote);
  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const loadFileTree = useNotesStore(s => s.loadFileTree);
  const openTabs = useNotesStore(s => s.openTabs);
  const recentlyClosedTabs = useNotesStore(s => s.recentlyClosedTabs);
  const closeTab = useNotesStore(s => s.closeTab);
  const reopenClosedTab = useNotesStore(s => s.reopenClosedTab);
  const openNote = useNotesStore(s => s.openNote);
  const loadStarred = useNotesStore(s => s.loadStarred);
  const deleteNote = useNotesStore(s => s.deleteNote);
  const loadAssets = useNotesStore(s => s.loadAssets);
  const saveNote = useNotesStore(s => s.saveNote);
  const cleanupAssetTempFiles = useNotesStore(s => s.cleanupAssetTempFiles);
  const clearAssetUrlCache = useNotesStore(s => s.clearAssetUrlCache);
  const revealFolder = useNotesStore(s => s.revealFolder);
  const isDirty = useNotesStore(s => s.isDirty);
  const pendingStarredNavigation = useNotesStore(s => s.pendingStarredNavigation);
  const setPendingStarredNavigation = useNotesStore(s => s.setPendingStarredNavigation);
  const notesPath = useNotesStore(s => s.notesPath);
  const rootFolder = useNotesStore(s => s.rootFolder);
  const isLoading = useNotesStore(s => s.isLoading);
  const draftNotes = useNotesStore(s => s.draftNotes);
  const noteMetadata = useNotesStore(s => s.noteMetadata);
  const openNoteByAbsolutePath = useNotesStore(s => s.openNoteByAbsolutePath);
  const adoptAbsoluteNoteIntoVault = useNotesStore(s => s.adoptAbsoluteNoteIntoVault);
  const pendingDraftDiscardPath = useNotesStore(s => s.pendingDraftDiscardPath);
  const cancelPendingDraftDiscard = useNotesStore(s => s.cancelPendingDraftDiscard);
  const confirmPendingDraftDiscard = useNotesStore(s => s.confirmPendingDraftDiscard);
  const getDisplayName = useNotesStore(s => s.getDisplayName);

  const currentVault = useVaultStore((state) => state.currentVault);
  const openVault = useVaultStore((state) => state.openVault);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const chatPanelCollapsed = useUIStore((s) => s.notesChatPanelCollapsed);
  const setChatPanelCollapsed = useUIStore((s) => s.setNotesChatPanelCollapsed);
  const toggleChatPanel = useUIStore((s) => s.toggleNotesChatPanel);
  const setLayoutPanelDragging = useUIStore((s) => s.setLayoutPanelDragging);

  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [pendingDeleteCurrentNotePath, setPendingDeleteCurrentNotePath] = useState<string | null>(null);
  const [isVaultInitializing, setIsVaultInitializing] = useState(false);
  const launchContextRef = useRef(readWindowLaunchContext());
  const hasHandledLaunchNoteRef = useRef(false);
  const autoCreateBlankNoteRef = useRef(false);
  const hasPresentedNoteRef = useRef(false);
  const autoCreateVaultPathRef = useRef<string | null>(currentVault?.path ?? null);
  const vaultInitializingRef = useRef(false);
  const toggleShortcutsDialog = useCallback(() => setIsShortcutsOpen((prev) => !prev), []);
  const handleVaultInitializingChange = useCallback((initializing: boolean) => {
    vaultInitializingRef.current = initializing;
    setIsVaultInitializing(initializing);
  }, []);
  const handleChatPanelDragStateChange = useCallback((dragging: boolean) => {
    setLayoutPanelDragging(dragging);
  }, [setLayoutPanelDragging]);
  const notePathsInTreeOrder = useMemo(() => (
    rootFolder ? collectNotePathsInTreeOrder(rootFolder.children) : []
  ), [rootFolder]);
  const draftNotesLength = useMemo(() => Object.keys(draftNotes).length, [draftNotes]);

  const focusSidebarPath = useCallback((path: string) => {
    revealFolder(path);
    scheduleSidebarItemIntoView(path, 2);
  }, [revealFolder]);

  const focusNotesChatComposer = useNotesChatComposerFocus(setChatPanelCollapsed);

  const {
    isOpenTargetBusy,
    openMarkdownTarget,
    pendingOpenMarkdownTargetVaultPath,
  } = useNotesOpenMarkdownTarget({
    active,
    currentVaultPath: currentVault?.path ?? null,
    notesPath,
    currentNotePath,
    isDirty,
    saveNote,
    openNote,
    openNoteByAbsolutePath,
    adoptAbsoluteNoteIntoVault,
    openVault,
  });

  useModuleShortcutsDialog({ enabled: active, onToggle: toggleShortcutsDialog });
  const activeVaultPath = active ? currentVault?.path ?? null : null;
  useCurrentVaultExternalPathSync(activeVaultPath);
  useNotesExternalSync(activeVaultPath, active ? notesPath : '');
  useAbsoluteNoteExternalRenameSync(active ? currentNotePath : undefined);
  useCurrentVaultInitialization({
    currentVaultPath: currentVault?.path ?? null,
    launchNotePath: launchContextRef.current.notePath,
    pendingStarredNavigation,
    pendingOpenMarkdownTargetVaultPath,
    loadStarred,
    loadAssets,
    loadFileTree,
    cleanupAssetTempFiles,
    clearAssetUrlCache,
    onInitializingChange: handleVaultInitializingChange,
  });

  useEffect(() => {
    if (hasHandledLaunchNoteRef.current) return;

    const launchNotePath = launchContextRef.current.notePath;
    if (!launchNotePath || !currentVault || notesPath !== currentVault.path) return;

    hasHandledLaunchNoteRef.current = true;
    void openStoredNotePath(launchNotePath, {
      openNote,
      openNoteByAbsolutePath,
    });
  }, [currentVault, notesPath, openNote, openNoteByAbsolutePath]);

  useEffect(() => {
    if (!currentVault || !pendingStarredNavigation) return;
    if (pendingStarredNavigation.vaultPath !== currentVault.path) return;
    if (notesPath !== currentVault.path || !rootFolder) return;

    let cancelled = false;

    const navigateToStarredTarget = async () => {
      if (pendingStarredNavigation.kind === 'folder') {
        revealFolder(pendingStarredNavigation.relativePath);
        scheduleSidebarItemIntoView(pendingStarredNavigation.relativePath, 2);
      } else {
        await openNote(
          pendingStarredNavigation.relativePath,
          pendingStarredNavigation.openInNewTab ?? false
        );
        scheduleSidebarItemIntoView(pendingStarredNavigation.relativePath, 2);
      }

      if (!cancelled) {
        setPendingStarredNavigation(null);
      }
    };

    void navigateToStarredTarget();

    return () => {
      cancelled = true;
    };
  }, [
    currentVault,
    pendingStarredNavigation,
    notesPath,
    rootFolder,
    revealFolder,
    openNote,
    setPendingStarredNavigation,
  ]);

  const acceptsBlankWorkspaceDrop = (() => {
    if (!currentNotePath) {
      return openTabs.length === 0;
    }

    if (!currentNote || !isDraftNotePath(currentNotePath)) {
      return false;
    }

    if (openTabs.length !== 1 || openTabs[0]?.path !== currentNotePath) {
      return false;
    }

    const draftEntry = draftNotes[currentNotePath];
    if (!draftEntry) {
      return false;
    }

    return !hasDraftUnsavedChanges({
      draftName: draftEntry.name,
      content: currentNote.content,
      metadata: noteMetadata?.notes[currentNotePath],
    });
  })();

  const blankWorkspaceDropEnabled = active && acceptsBlankWorkspaceDrop && !isOpenTargetBusy;

  const isBlankWorkspaceDropActive = useBlankWorkspaceDropOpen({
    enabled: blankWorkspaceDropEnabled,
    openMarkdownTarget,
    openVault,
  });

  useEffect(() => {
    if (currentNotePath || openTabs.length > 0) {
      if (!hasPresentedNoteRef.current) {
        logNotesDebug('NotesAutoDraft', 'presented-note-marked', {
          currentNotePath: currentNotePath ?? null,
          openTabsLength: openTabs.length,
        });
      }
      hasPresentedNoteRef.current = true;
    }
  }, [currentNotePath, openTabs.length]);

  useEffect(() => {
    const vaultPath = currentVault?.path ?? null;
    if (autoCreateVaultPathRef.current === vaultPath) {
      return;
    }

    const previousVaultPath = autoCreateVaultPathRef.current;
    autoCreateVaultPathRef.current = vaultPath;
    hasPresentedNoteRef.current = false;
    autoCreateBlankNoteRef.current = false;
    logNotesDebug('NotesAutoDraft', 'vault-changed', {
      previousVaultPath,
      nextVaultPath: vaultPath,
      currentNotePath: currentNotePath ?? null,
      openTabsLength: openTabs.length,
      rootFolderLoaded: Boolean(rootFolder),
    });
  }, [currentNotePath, currentVault?.path, openTabs.length, rootFolder]);

  useEffect(() => {
    const blockedReasons = [
      !active ? 'inactive' : null,
      currentNotePath ? 'has-current-note' : null,
      openTabs.length > 0 ? 'has-open-tabs' : null,
      hasPresentedNoteRef.current ? 'already-presented-note' : null,
      isLoading ? 'loading' : null,
      (isVaultInitializing || vaultInitializingRef.current) ? 'vault-initializing' : null,
      isOpenTargetBusy ? 'open-target-busy' : null,
      pendingStarredNavigation ? 'pending-starred-navigation' : null,
      autoCreateBlankNoteRef.current ? 'auto-create-in-flight' : null,
    ].filter(Boolean);

    const launchNoteBlocked = Boolean(launchContextRef.current.notePath && !hasHandledLaunchNoteRef.current);
    const rootFolderBlocked = Boolean(currentVault && !rootFolder);
    if (launchNoteBlocked) blockedReasons.push('pending-launch-note');
    if (rootFolderBlocked) blockedReasons.push('vault-root-not-loaded');

    logNotesDebug('NotesAutoDraft', 'evaluate', {
      active,
      currentVaultPath: currentVault?.path ?? null,
      notesPath,
      currentNotePath: currentNotePath ?? null,
      openTabsLength: openTabs.length,
      recentlyClosedTabsLength: recentlyClosedTabs.length,
      draftNotesLength,
      hasPresentedNote: hasPresentedNoteRef.current,
      isLoading,
      isVaultInitializing,
      vaultInitializingRef: vaultInitializingRef.current,
      isOpenTargetBusy,
      pendingStarredNavigation: Boolean(pendingStarredNavigation),
      autoCreateInFlight: autoCreateBlankNoteRef.current,
      launchNotePath: launchContextRef.current.notePath ?? null,
      hasHandledLaunchNote: hasHandledLaunchNoteRef.current,
      rootFolderLoaded: Boolean(rootFolder),
      rootChildrenLength: rootFolder?.children.length ?? null,
      blockedReasons,
    });

    if (blockedReasons.length > 0) {
      return;
    }

    autoCreateBlankNoteRef.current = true;
    logNotesDebug('NotesAutoDraft', 'schedule-create', {
      currentVaultPath: currentVault?.path ?? null,
      notesPath,
      rootChildrenLength: rootFolder?.children.length ?? null,
    });

    const timeoutId = window.setTimeout(() => {
      const state = useNotesStore.getState();
      logNotesDebug('NotesAutoDraft', 'timer-fired', {
        currentVaultPath: currentVault?.path ?? null,
        notesPathAtRender: notesPath,
        notesPathAtTimer: state.notesPath,
        currentNotePathAtTimer: state.currentNote?.path ?? null,
        openTabsLengthAtTimer: state.openTabs.length,
        recentlyClosedTabsLengthAtTimer: state.recentlyClosedTabs.length,
        draftNotesLengthAtTimer: Object.keys(state.draftNotes).length,
      });
      if (state.currentNote || state.openTabs.length > 0) {
        autoCreateBlankNoteRef.current = false;
        logNotesDebug('NotesAutoDraft', 'timer-aborted', {
          reason: state.currentNote ? 'has-current-note' : 'has-open-tabs',
          currentNotePathAtTimer: state.currentNote?.path ?? null,
          openTabsLengthAtTimer: state.openTabs.length,
        });
        return;
      }

      void state.createNote(undefined, { asDraft: true })
        .then((draftPath) => {
          logNotesDebug('NotesAutoDraft', 'create-resolved', {
            draftPath,
            currentNotePathAfterCreate: useNotesStore.getState().currentNote?.path ?? null,
            openTabsLengthAfterCreate: useNotesStore.getState().openTabs.length,
          });
        })
        .catch((error) => {
          console.error('[NotesView] Failed to create blank draft note:', error);
          logNotesDebug('NotesAutoDraft', 'create-failed', {
            message: error instanceof Error ? error.message : String(error),
          });
          autoCreateBlankNoteRef.current = false;
        });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      autoCreateBlankNoteRef.current = false;
      logNotesDebug('NotesAutoDraft', 'cleanup', {
        currentVaultPath: currentVault?.path ?? null,
        notesPath,
      });
    };
  }, [
    active,
    currentNotePath,
    currentVault,
    draftNotesLength,
    isLoading,
    isVaultInitializing,
    isOpenTargetBusy,
    openTabs.length,
    pendingStarredNavigation,
    recentlyClosedTabs.length,
    rootFolder,
    notesPath,
  ]);

  useNotesSidebarExternalDropImport({
    enabled: active && !acceptsBlankWorkspaceDrop && Boolean(currentVault?.path && rootFolder),
    vaultPath: currentVault?.path ?? '',
    loadFileTree,
    revealFolder,
  });

  useEffect(() => {
    return subscribeDeleteCurrentNoteEvent(() => {
      if (!currentNotePath) {
        return;
      }
      setPendingDeleteCurrentNotePath(currentNotePath);
    });
  }, [currentNotePath]);

  useNotesViewShortcuts({
    active,
    currentNotePath,
    openTabs,
    notePathsInTreeOrder,
    openNote,
    closeTab,
    reopenClosedTab,
    toggleChatPanel,
    focusNotesChatComposer,
    focusSidebarPath,
  });

  return (
    <>
      <AnimatePresence>
        {isBlankWorkspaceDropActive && (
          <BlurBackdrop
            className="pointer-events-none"
            overlayClassName="bg-white/20 dark:bg-white/5"
            zIndex={70}
            blurPx={6}
            duration={0.18}
            data-testid="blank-workspace-drop-overlay"
          />
        )}
      </AnimatePresence>

      <div data-notes-view-mode="true" className="h-full w-full relative flex min-w-0">
        <div className="flex-1 min-w-0">
          {currentNotePath ? (
            <MarkdownEditor peekOffset={sidebarWidth} />
          ) : (
            <div className="h-full w-full" />
          )}
        </div>

        {active && !chatPanelCollapsed && (
          <ResizablePanel
            defaultWidth={420}
            minWidth={320}
            maxWidth={760}
            storageKey="vlaina_notes_chat_panel_width"
            onDragStateChange={handleChatPanelDragStateChange}
            className="h-full border-l border-[#eff3f4] bg-[var(--vlaina-bg-primary)]"
          >
            <div data-notes-chat-panel="true" className="h-full min-h-0 relative">
              <Suspense fallback={null}>
                <EmbeddedChatView mode="embedded" active={active} />
              </Suspense>
            </div>
          </ResizablePanel>
        )}

      </div>

      <TreeItemDeleteDialog
        open={Boolean(pendingDeleteCurrentNotePath)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteCurrentNotePath(null);
          }
        }}
        itemLabel={pendingDeleteCurrentNotePath ? getDisplayName(pendingDeleteCurrentNotePath) : ''}
        itemType="Note"
        onConfirm={() => {
          const path = pendingDeleteCurrentNotePath;
          setPendingDeleteCurrentNotePath(null);
          if (path) {
            void deleteNote(path);
          }
        }}
      />
      
      <ConfirmDialog
        isOpen={Boolean(pendingDraftDiscardPath)}
        onClose={cancelPendingDraftDiscard}
        onConfirm={confirmPendingDraftDiscard}
        title="Discard Draft"
        description="Are you sure you want to discard this unsaved draft? Any content that was not saved with Ctrl+S will be lost."
        confirmText="Discard"
        cancelText="Cancel"
        variant="danger"
      />

      <ModuleShortcutsDialog module="notes" open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen} />
    </>
  );}
