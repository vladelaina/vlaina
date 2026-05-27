import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { useUIStore } from '@/stores/uiSlice';
import { useToastStore } from '@/stores/useToastStore';
import { ResizablePanel } from '@/components/layout/ResizablePanel';
import { ModuleShortcutsDialog } from '@/components/common/ModuleShortcutsDialog';
import { readWindowLaunchContext } from '@/lib/desktop/launchContext';
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
import { useI18n } from '@/lib/i18n';
import { clearRemoteImageMemoryCache } from './features/Editor/plugins/image-block/utils/remoteImageMemoryCache';
import { preloadMarkdownEditor } from './features/Editor/preloadMarkdownEditor';
import { shouldAutoCreateBlankDraft } from './autoCreateBlankDraftPolicy';

const EmbeddedChatView = lazy(async () => {
  const mod = await import('@/components/Chat/ChatView');
  return { default: mod.ChatView };
});

const MarkdownEditor = lazy(async () => {
  const mod = await preloadMarkdownEditor();
  return { default: mod.MarkdownEditor };
});

function scheduleSidebarScroll(path: string): void {
  void import('./features/common/sidebarScrollIntoView')
    .then((mod) => {
      mod.scheduleSidebarItemIntoView(path, 2);
    });
}

export function NotesView({
  active = true,
  onStartupReady,
  onPrimaryContentReady,
}: {
  active?: boolean;
  onStartupReady?: () => void;
  onPrimaryContentReady?: () => void;
}) {
  const { t } = useI18n();
  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const loadFileTree = useNotesStore(s => s.loadFileTree);
  const openTabs = useNotesStore(s => s.openTabs);
  const closeTab = useNotesStore(s => s.closeTab);
  const reopenClosedTab = useNotesStore(s => s.reopenClosedTab);
  const openNote = useNotesStore(s => s.openNote);
  const loadStarred = useNotesStore(s => s.loadStarred);
  const deleteNote = useNotesStore(s => s.deleteNote);
  const loadAssets = useNotesStore(s => s.loadAssets);
  const saveNote = useNotesStore(s => s.saveNote);
  const cleanupAssetTempFiles = useNotesStore(s => s.cleanupAssetTempFiles);
  const clearAssetUrlCache = useNotesStore(s => s.clearAssetUrlCache);
  const cancelNoteContentScan = useNotesStore(s => s.cancelNoteContentScan);
  const revealFolder = useNotesStore(s => s.revealFolder);
  const isDirty = useNotesStore(s => s.isDirty);
  const pendingStarredNavigation = useNotesStore(s => s.pendingStarredNavigation);
  const setPendingStarredNavigation = useNotesStore(s => s.setPendingStarredNavigation);
  const notesPath = useNotesStore(s => s.notesPath);
  const rootFolder = useNotesStore(s => s.rootFolder);
  const rootFolderPath = useNotesStore(s => s.rootFolderPath);
  const isLoading = useNotesStore(s => s.isLoading);
  const draftNotes = useNotesStore(s => s.draftNotes);
  const noteMetadata = useNotesStore(s => s.noteMetadata);
  const openNoteByAbsolutePath = useNotesStore(s => s.openNoteByAbsolutePath);
  const adoptAbsoluteNoteIntoVault = useNotesStore(s => s.adoptAbsoluteNoteIntoVault);
  const pendingDraftDiscardPath = useNotesStore(s => s.pendingDraftDiscardPath);
  const cancelPendingDraftDiscard = useNotesStore(s => s.cancelPendingDraftDiscard);
  const confirmPendingDraftDiscard = useNotesStore(s => s.confirmPendingDraftDiscard);
  const getDisplayName = useNotesStore(s => s.getDisplayName);
  const notesError = useNotesStore(s => s.error);
  const addToast = useToastStore(s => s.addToast);
  const blankDropDraftContent = useNotesStore(
    useCallback((state) => {
      if (!currentNotePath || !isDraftNotePath(currentNotePath)) {
        return '';
      }
      if (openTabs.length !== 1 || openTabs[0]?.path !== currentNotePath) {
        return '';
      }
      return state.currentNote?.path === currentNotePath ? state.currentNote.content : '';
    }, [currentNotePath, openTabs])
  );

  const currentVault = useVaultStore((state) => state.currentVault);
  const openVault = useVaultStore((state) => state.openVault);
  const vaultStoreHasInitialized = useVaultStore((state) => state.hasInitialized);
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
  const lastPresentedNotesErrorRef = useRef<string | null>(null);
  const autoCreateVaultPathRef = useRef<string | null>(currentVault?.path ?? null);
  const vaultInitializingRef = useRef(false);
  const consumedPendingStarredNavigationKeyRef = useRef<string | null>(null);
  const [canLoadMarkdownEditor, setCanLoadMarkdownEditor] = useState(false);
  const toggleShortcutsDialog = useCallback(() => setIsShortcutsOpen((prev) => !prev), []);
  const handleVaultInitializingChange = useCallback((initializing: boolean) => {
    vaultInitializingRef.current = initializing;
    setIsVaultInitializing(initializing);
  }, []);
  const handleChatPanelDragStateChange = useCallback((dragging: boolean) => {
    setLayoutPanelDragging(dragging);
  }, [setLayoutPanelDragging]);
  const notePathsInTreeOrder = useMemo(() => (
    rootFolder && rootFolderPath === notesPath ? collectNotePathsInTreeOrder(rootFolder.children) : []
  ), [notesPath, rootFolder, rootFolderPath]);

  const focusSidebarPath = useCallback((path: string) => {
    revealFolder(path);
    scheduleSidebarScroll(path);
  }, [revealFolder]);

  const focusNotesChatComposer = useNotesChatComposerFocus(setChatPanelCollapsed);

  useEffect(() => {
    onStartupReady?.();
  }, [currentNotePath, currentVault, isLoading, onStartupReady, openTabs.length]);

  const reportNotesPrimaryContentReady = useCallback(() => {
    onPrimaryContentReady?.();
  }, [onPrimaryContentReady]);

  useEffect(() => {
    if (!currentNotePath) {
      setCanLoadMarkdownEditor(false);
      return;
    }

    setCanLoadMarkdownEditor(true);
  }, [currentNotePath, openTabs.length]);

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

  useEffect(() => {
    if (!notesError) {
      lastPresentedNotesErrorRef.current = null;
      return;
    }

    if (!active || lastPresentedNotesErrorRef.current === notesError) {
      return;
    }

    lastPresentedNotesErrorRef.current = notesError;
    addToast(notesError, 'error', 4500);
  }, [active, addToast, notesError]);

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
    clearRemoteImageMemoryCache,
    cancelNoteContentScan,
    onInitializingChange: handleVaultInitializingChange,
  });

  useEffect(() => {
    if (hasHandledLaunchNoteRef.current) return;

    const { folderPath: launchFolderPath, notePath: launchNotePath } = launchContextRef.current;
    if ((!launchFolderPath && !launchNotePath) || !currentVault || notesPath !== currentVault.path) return;

    hasHandledLaunchNoteRef.current = true;
    if (launchFolderPath) {
      focusSidebarPath(launchFolderPath);
      return;
    }

    if (!launchNotePath) return;

    void openStoredNotePath(launchNotePath, {
      openNote,
      openNoteByAbsolutePath,
    })
      .catch((_error) => {
      });
  }, [currentVault, focusSidebarPath, notesPath, openNote, openNoteByAbsolutePath]);

  useEffect(() => {
    if (!currentVault || !pendingStarredNavigation) return;
    if (pendingStarredNavigation.vaultPath !== currentVault.path) return;
    if (notesPath !== currentVault.path || !rootFolder || rootFolderPath !== currentVault.path) return;
    const pendingNavigationKey = [
      pendingStarredNavigation.vaultPath,
      pendingStarredNavigation.kind,
      pendingStarredNavigation.relativePath,
      pendingStarredNavigation.openInNewTab ? 'new-tab' : 'same-tab',
    ].join('\n');
    if (consumedPendingStarredNavigationKeyRef.current === pendingNavigationKey) {
      return;
    }
    consumedPendingStarredNavigationKeyRef.current = pendingNavigationKey;

    const navigateToStarredTarget = async () => {
      setPendingStarredNavigation(null);
      if (pendingStarredNavigation.kind === 'folder') {
        revealFolder(pendingStarredNavigation.relativePath);
        scheduleSidebarScroll(pendingStarredNavigation.relativePath);
      } else {
        revealFolder(pendingStarredNavigation.relativePath);
        await openNote(
          pendingStarredNavigation.relativePath,
          pendingStarredNavigation.openInNewTab ?? false
        );
        scheduleSidebarScroll(pendingStarredNavigation.relativePath);
      }
    };

    void navigateToStarredTarget();
  }, [
    currentVault,
    pendingStarredNavigation,
    notesPath,
    rootFolder,
    rootFolderPath,
    revealFolder,
    openNote,
    setPendingStarredNavigation,
  ]);

  useEffect(() => {
    if (pendingStarredNavigation) {
      return;
    }
    consumedPendingStarredNavigationKeyRef.current = null;
  }, [pendingStarredNavigation]);

  const acceptsBlankWorkspaceDrop = (() => {
    if (!currentNotePath) {
      return openTabs.length === 0;
    }

    if (!isDraftNotePath(currentNotePath)) {
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
      content: blankDropDraftContent,
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
      hasPresentedNoteRef.current = true;
    }
  }, [currentNotePath, openTabs.length]);

  useEffect(() => {
    const vaultPath = currentVault?.path ?? null;
    if (autoCreateVaultPathRef.current === vaultPath) {
      return;
    }

    autoCreateVaultPathRef.current = vaultPath;
    hasPresentedNoteRef.current = false;
    autoCreateBlankNoteRef.current = false;
  }, [currentVault?.path]);

  useEffect(() => {
    const launchNoteBlocked = Boolean(launchContextRef.current.notePath && !hasHandledLaunchNoteRef.current);
    const policy = shouldAutoCreateBlankDraft({
      active,
      currentNotePath,
      openTabCount: openTabs.length,
      hasPresentedNote: hasPresentedNoteRef.current,
      notesLoading: isLoading,
      vaultStoreHasInitialized,
      vaultInitializing: isVaultInitializing || vaultInitializingRef.current,
      openTargetBusy: isOpenTargetBusy,
      hasPendingStarredNavigation: Boolean(pendingStarredNavigation),
      autoCreateInFlight: autoCreateBlankNoteRef.current,
      hasPendingLaunchNote: launchNoteBlocked,
      currentVaultPath: currentVault?.path ?? null,
      notesPath,
      rootFolder,
      rootFolderPath,
    });

    if (!policy.shouldCreate) {
      return;
    }

    autoCreateBlankNoteRef.current = true;

    const timeoutId = window.setTimeout(() => {
      const state = useNotesStore.getState();
      const timerRootFolderCurrent = Boolean(
        currentVault &&
        state.rootFolder &&
        state.rootFolderPath === currentVault.path &&
        state.notesPath === currentVault.path
      );
      if (state.currentNote || state.openTabs.length > 0) {
        autoCreateBlankNoteRef.current = false;
        return;
      }
      if (currentVault && !timerRootFolderCurrent) {
        autoCreateBlankNoteRef.current = false;
        return;
      }
      if (currentVault && timerRootFolderCurrent && state.rootFolder && state.rootFolder.children.length > 0) {
        autoCreateBlankNoteRef.current = false;
        return;
      }

      void state.createNote(undefined, { asDraft: true })
        .catch((_error) => {
          autoCreateBlankNoteRef.current = false;
        });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      autoCreateBlankNoteRef.current = false;
    };
  }, [
    active,
    currentNotePath,
    currentVault,
    isLoading,
    vaultStoreHasInitialized,
    isVaultInitializing,
    isOpenTargetBusy,
    openTabs.length,
    pendingStarredNavigation,
    rootFolder,
    rootFolderPath,
    notesPath,
  ]);

  useNotesSidebarExternalDropImport({
    enabled: active && !acceptsBlankWorkspaceDrop && Boolean(
      currentVault?.path &&
      rootFolder &&
      rootFolderPath === currentVault.path &&
      notesPath === currentVault.path
    ),
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
    chatPanelCollapsed,
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
          {canLoadMarkdownEditor ? (
            <Suspense fallback={null}>
              <MarkdownEditor
                active={active}
                peekOffset={sidebarWidth}
                onEditorViewReady={reportNotesPrimaryContentReady}
              />
            </Suspense>
          ) : null}
        </div>

        {active && !chatPanelCollapsed && (
          <ResizablePanel
            defaultWidth={320}
            minWidth={320}
            maxWidth={760}
            storageKey="vlaina_notes_chat_panel_width_v2"
            onDragStateChange={handleChatPanelDragStateChange}
            className="h-full border-l border-[#eff3f4] bg-[var(--vlaina-bg-primary)]"
          >
            <div data-notes-chat-panel="true" className="h-full min-h-0 relative">
              <Suspense fallback={null}>
                <EmbeddedChatView
                  mode="embedded"
                  active={active}
                  onCloseEmbeddedPanel={() => setChatPanelCollapsed(true)}
                />
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
        title={t('notes.discardDraftTitle')}
        description={t('notes.discardDraftDescription')}
        confirmText={t('notes.discard')}
        cancelText={t('common.cancel')}
        variant="danger"
      />

      <ModuleShortcutsDialog module="notes" open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen} />
    </>
  );}
