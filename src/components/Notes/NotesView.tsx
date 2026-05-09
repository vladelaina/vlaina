import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { useUIStore } from '@/stores/uiSlice';
import { useToastStore } from '@/stores/useToastStore';
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

const EmbeddedChatView = lazy(async () => {
  const mod = await import('@/components/Chat/ChatView');
  return { default: mod.ChatView };
});

export function NotesView({ active = true }: { active?: boolean }) {
  const currentNote = useNotesStore(s => s.currentNote);
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
  const lastPresentedNotesErrorRef = useRef<string | null>(null);
  const autoCreateVaultPathRef = useRef<string | null>(currentVault?.path ?? null);
  const vaultInitializingRef = useRef(false);
  const consumedPendingStarredNavigationKeyRef = useRef<string | null>(null);
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
        scheduleSidebarItemIntoView(pendingStarredNavigation.relativePath, 2);
      } else {
        revealFolder(pendingStarredNavigation.relativePath);
        await openNote(
          pendingStarredNavigation.relativePath,
          pendingStarredNavigation.openInNewTab ?? false
        );
        scheduleSidebarItemIntoView(pendingStarredNavigation.relativePath, 2);
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
    const vaultPathMismatchBlocked = Boolean(currentVault && notesPath !== currentVault.path);
    const rootFolderCurrent = Boolean(
      currentVault &&
      rootFolder &&
      rootFolderPath === currentVault.path &&
      notesPath === currentVault.path
    );
    const rootFolderBlocked = Boolean(currentVault && !rootFolderCurrent);
    const vaultHasEntriesBlocked = Boolean(rootFolderCurrent && rootFolder && rootFolder.children.length > 0);
    if (launchNoteBlocked) blockedReasons.push('pending-launch-note');
    if (vaultPathMismatchBlocked) blockedReasons.push('vault-path-mismatch');
    if (rootFolderBlocked) blockedReasons.push('vault-root-not-loaded');
    if (vaultHasEntriesBlocked) blockedReasons.push('vault-has-entries');

    if (blockedReasons.length > 0) {
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
        .catch((error) => {
          console.error('[NotesView] Failed to create blank draft note:', error);
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
          <MarkdownEditor active={Boolean(currentNotePath)} peekOffset={sidebarWidth} />
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
        title="Discard Draft"
        description="Are you sure you want to discard this unsaved draft? Any content that was not saved with Ctrl+S will be lost."
        confirmText="Discard"
        cancelText="Cancel"
        variant="danger"
      />

      <ModuleShortcutsDialog module="notes" open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen} />
    </>
  );}
