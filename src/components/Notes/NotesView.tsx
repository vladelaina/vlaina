import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { windowCommands } from '@/lib/tauri/invoke';
import { openDialog, messageDialog } from '@/lib/storage/dialog';
import { OPEN_MARKDOWN_FILE_ACTION } from '@/lib/notes/openMarkdownFileText';
import { getSingleOpenSelection, isSupportedMarkdownSelection, resolveOpenNoteTarget } from './features/OpenTarget/openTargetSelection';
import { subscribeOpenMarkdownTargetEvent } from './features/OpenTarget/openTargetEvents';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { useUIStore } from '@/stores/uiSlice';
import { matchesShortcutBinding } from '@/lib/shortcuts';
import { focusComposerInput } from '@/lib/ui/composerFocusRegistry';
import { ResizablePanel } from '@/components/layout/ResizablePanel';
import { ModuleShortcutsDialog } from '@/components/common/ModuleShortcutsDialog';
import { readWindowLaunchContext } from '@/lib/tauri/windowLaunchContext';
import { MarkdownEditor } from './features/Editor';
import { useModuleShortcutsDialog } from '@/hooks/useModuleShortcutsDialog';
import {
  runOpenNewChatShortcut,
  runTemporaryChatWelcomeShortcut,
} from '@/components/Chat/features/Temporary/temporaryChatCommands';
import { useCurrentVaultExternalPathSync } from './hooks/useCurrentVaultExternalPathSync';
import { useNotesExternalSync } from './hooks/useNotesExternalSync';
import { openStoredNotePath } from '@/stores/notes/openNotePath';
import { hasDraftUnsavedChanges, isDraftNotePath } from '@/stores/notes/draftNote';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { BlurBackdrop } from '@/components/common/BlurBackdrop';
import { TreeItemDeleteDialog } from '@/components/Notes/features/FileTree/components/TreeItemDeleteDialog';
import { normalizeVaultPath } from '@/stores/vaultConfig';
import { subscribeDeleteCurrentNoteEvent } from '@/components/Notes/noteDeleteEvents';
import { useBlankWorkspaceDropOpen } from './hooks/useBlankWorkspaceDropOpen';
import { useNotesSidebarExternalDropImport } from './hooks/useNotesSidebarExternalDropImport';

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
  const draftNotes = useNotesStore(s => s.draftNotes);
  const noteMetadata = useNotesStore(s => s.noteMetadata);
  const openNoteByAbsolutePath = useNotesStore(s => s.openNoteByAbsolutePath);
  const adoptAbsoluteNoteIntoVault = useNotesStore(s => s.adoptAbsoluteNoteIntoVault);
  const pendingDraftDiscardPath = useNotesStore(s => s.pendingDraftDiscardPath);
  const cancelPendingDraftDiscard = useNotesStore(s => s.cancelPendingDraftDiscard);
  const confirmPendingDraftDiscard = useNotesStore(s => s.confirmPendingDraftDiscard);
  const getDisplayName = useNotesStore(s => s.getDisplayName);

  const { currentVault, openVault } = useVaultStore();
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const chatPanelCollapsed = useUIStore((s) => s.notesChatPanelCollapsed);
  const setChatPanelCollapsed = useUIStore((s) => s.setNotesChatPanelCollapsed);
  const toggleChatPanel = useUIStore((s) => s.toggleNotesChatPanel);
  const setLayoutPanelDragging = useUIStore((s) => s.setLayoutPanelDragging);

  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [pendingDeleteCurrentNotePath, setPendingDeleteCurrentNotePath] = useState<string | null>(null);
  const [isOpenTargetBusy, setIsOpenTargetBusy] = useState(false);
  const [pendingShortcutNoteTarget, setPendingShortcutNoteTarget] = useState<{
    vaultPath: string;
    notePath: string;
    absolutePath: string;
    startedAt: number;
  } | null>(null);
  const chatComposerFocusFrameRef = useRef<number | null>(null);
  const launchContextRef = useRef(readWindowLaunchContext());
  const hasHandledLaunchNoteRef = useRef(false);
  const toggleShortcutsDialog = useCallback(() => setIsShortcutsOpen((prev) => !prev), []);
  const handleChatPanelDragStateChange = useCallback((dragging: boolean) => {
    setLayoutPanelDragging(dragging);
  }, [setLayoutPanelDragging]);
  const focusNotesChatComposer = useCallback(() => {
    if (chatComposerFocusFrameRef.current !== null) {
      cancelAnimationFrame(chatComposerFocusFrameRef.current);
      chatComposerFocusFrameRef.current = null;
    }

    setChatPanelCollapsed(false);

    let attempts = 0;
    const tryFocus = () => {
      if (focusComposerInput()) {
        chatComposerFocusFrameRef.current = null;
        return;
      }

      attempts += 1;
      if (attempts >= 24) {
        chatComposerFocusFrameRef.current = null;
        return;
      }

      chatComposerFocusFrameRef.current = requestAnimationFrame(tryFocus);
    };

    chatComposerFocusFrameRef.current = requestAnimationFrame(tryFocus);
  }, [setChatPanelCollapsed]);

  useModuleShortcutsDialog({ enabled: active, onToggle: toggleShortcutsDialog });
  useCurrentVaultExternalPathSync(currentVault?.path ?? null);
  useNotesExternalSync(currentVault?.path ?? null, notesPath);

  useEffect(() => {
    return () => {
      if (chatComposerFocusFrameRef.current !== null) {
        cancelAnimationFrame(chatComposerFocusFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!currentVault) return;
    let cancelled = false;

    const unlockWindow = async () => {
      try {
        await windowCommands.setResizable(true);
      } catch (e) {
        console.error('Failed to unlock window:', e);
      }
    };

    const initializeVault = async () => {
      await loadStarred(currentVault.path);
      await Promise.all([
        loadAssets(currentVault.path),
        loadFileTree(Boolean(launchContextRef.current.notePath)),
        cleanupAssetTempFiles(),
      ]);

      if (!cancelled) {
        await unlockWindow();
      }
    };

    void initializeVault();

    return () => {
      cancelled = true;
      clearAssetUrlCache();
    };
  }, [currentVault, loadStarred, loadAssets, loadFileTree, cleanupAssetTempFiles, clearAssetUrlCache]);

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
      } else {
        await openNote(
          pendingStarredNavigation.relativePath,
          pendingStarredNavigation.openInNewTab ?? false
        );
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

  const openShortcutNoteTarget = useCallback(async (target: {
    vaultPath: string;
    notePath: string;
    absolutePath: string;
  }) => {
    const store = useNotesStore.getState();
    const activeNotesPath = store.notesPath;
    const currentPath = store.currentNote?.path;

    if (activeNotesPath === target.vaultPath && currentPath === target.absolutePath) {
      const adopted = adoptAbsoluteNoteIntoVault(target.absolutePath, target.notePath);
      console.info('[NotesOpenTarget] adopt-current:done', {
        absolutePath: target.absolutePath,
        notePath: target.notePath,
        adopted,
      });
      if (adopted) {
        return true;
      }
    }

    if (activeNotesPath === target.vaultPath) {
      await openNote(target.notePath);
      const openedPath = useNotesStore.getState().currentNote?.path;
      if (openedPath === target.notePath) {
        return true;
      }
    }

    await openNoteByAbsolutePath(target.absolutePath);
    const openedPath = useNotesStore.getState().currentNote?.path;
    return openedPath === target.absolutePath || openedPath === target.notePath;
  }, [adoptAbsoluteNoteIntoVault, openNote, openNoteByAbsolutePath]);

  useEffect(() => {
    if (!pendingShortcutNoteTarget || !currentVault) return;
    if (currentVault.path !== pendingShortcutNoteTarget.vaultPath) return;

    let cancelled = false;

    const openPendingShortcutNote = async () => {
      let opened = false;
      console.info('[NotesOpenTarget] pending-open:start', {
        absolutePath: pendingShortcutNoteTarget.absolutePath,
        vaultPath: pendingShortcutNoteTarget.vaultPath,
        notesPath,
        rootFolderReady: Boolean(rootFolder),
        elapsedMs: Math.round(performance.now() - pendingShortcutNoteTarget.startedAt),
      });

      try {
        opened = await openShortcutNoteTarget(pendingShortcutNoteTarget);
      } finally {
        if (!cancelled) {
          setPendingShortcutNoteTarget(null);
        }
      }

      if (!cancelled && !opened) {
        console.info('[NotesOpenTarget] pending-open:failed', {
          absolutePath: pendingShortcutNoteTarget.absolutePath,
          elapsedMs: Math.round(performance.now() - pendingShortcutNoteTarget.startedAt),
        });
        await messageDialog('Failed to open the selected Markdown file.', {
          title: 'Open Failed',
          kind: 'error',
        });
        return;
      }

      if (!cancelled) {
        console.info('[NotesOpenTarget] pending-open:done', {
          absolutePath: pendingShortcutNoteTarget.absolutePath,
          elapsedMs: Math.round(performance.now() - pendingShortcutNoteTarget.startedAt),
          notesPath: useNotesStore.getState().notesPath,
        });
      }
    };

    void openPendingShortcutNote();

    return () => {
      cancelled = true;
    };
  }, [currentVault, notesPath, openShortcutNoteTarget, pendingShortcutNoteTarget, rootFolder]);

  const saveCurrentNoteIfNeeded = useCallback(async () => {
    if (!isDirty) return true;
    if (isDraftNotePath(currentNotePath)) return true;
    await saveNote();
    return !useNotesStore.getState().isDirty;
  }, [currentNotePath, isDirty, saveNote]);

  const openMarkdownTarget = useCallback(async (selected: string) => {
    const startedAt = performance.now();
    console.info('[NotesOpenTarget] start', {
      absolutePath: selected,
      currentVaultPath: currentVault?.path ?? null,
      notesPath,
    });
    setIsOpenTargetBusy(true);
    try {
      const canContinue = await saveCurrentNoteIfNeeded();
      if (!canContinue) return;
      console.info('[NotesOpenTarget] after-save-check', {
        absolutePath: selected,
        elapsedMs: Math.round(performance.now() - startedAt),
      });

      const target = resolveOpenNoteTarget(selected);
      const normalizedTargetVaultPath = normalizeVaultPath(target.vaultPath);
      console.info('[NotesOpenTarget] target-resolved', {
        absolutePath: selected,
        targetVaultPath: normalizedTargetVaultPath,
        notePath: target.notePath,
        elapsedMs: Math.round(performance.now() - startedAt),
      });

      if (currentVault?.path === normalizedTargetVaultPath && notesPath === normalizedTargetVaultPath) {
        const opened = await openShortcutNoteTarget({
          vaultPath: normalizedTargetVaultPath,
          notePath: target.notePath,
          absolutePath: selected,
        });
        console.info('[NotesOpenTarget] same-vault:done', {
          absolutePath: selected,
          opened,
          elapsedMs: Math.round(performance.now() - startedAt),
        });
        if (!opened) {
          await messageDialog('Failed to open the selected Markdown file.', {
            title: 'Open Failed',
            kind: 'error',
          });
        }
        return;
      }

      setPendingShortcutNoteTarget({
        vaultPath: normalizedTargetVaultPath,
        notePath: target.notePath,
        absolutePath: selected,
        startedAt,
      });
      console.info('[NotesOpenTarget] pending-open:queued', {
        absolutePath: selected,
        targetVaultPath: normalizedTargetVaultPath,
        elapsedMs: Math.round(performance.now() - startedAt),
      });

      if (currentVault?.path === normalizedTargetVaultPath) {
        return;
      }

      const openedVault = await openVault(normalizedTargetVaultPath);
      console.info('[NotesOpenTarget] open-vault:done', {
        absolutePath: selected,
        targetVaultPath: normalizedTargetVaultPath,
        openedVault,
        elapsedMs: Math.round(performance.now() - startedAt),
      });
      if (!openedVault) {
        setPendingShortcutNoteTarget(null);
        await messageDialog('Failed to open the selected vault.', {
          title: 'Open Failed',
          kind: 'error',
        });
      }
    } catch (error) {
      setPendingShortcutNoteTarget(null);
      console.info('[NotesOpenTarget] failed', {
        absolutePath: selected,
        elapsedMs: Math.round(performance.now() - startedAt),
      });
      await messageDialog(
        error instanceof Error ? error.message : 'Failed to open the selected Markdown file.',
        {
          title: 'Open Failed',
          kind: 'error',
        }
      );
    } finally {
      setIsOpenTargetBusy(false);
    }
  }, [currentVault?.path, isOpenTargetBusy, notesPath, openShortcutNoteTarget, openVault, rootFolder, saveCurrentNoteIfNeeded]);

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

  const isBlankWorkspaceDropActive = useBlankWorkspaceDropOpen({
    enabled: active && acceptsBlankWorkspaceDrop && !isOpenTargetBusy,
    openMarkdownTarget,
    openVault,
  });

  useNotesSidebarExternalDropImport({
    enabled: active && !acceptsBlankWorkspaceDrop && Boolean(currentVault?.path && rootFolder),
    vaultPath: currentVault?.path ?? '',
    loadFileTree,
    revealFolder,
  });

  const handleOpenSelectedFile = useCallback(async () => {
    if (isOpenTargetBusy) return;

    const selected = getSingleOpenSelection(await openDialog({
      title: OPEN_MARKDOWN_FILE_ACTION,
      defaultPath: currentVault?.path,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }],
    }));
    if (!selected) return;

    if (!isSupportedMarkdownSelection(selected)) {
      await messageDialog('Please select a Markdown file.', {
        title: 'Unsupported File',
        kind: 'warning',
      });
      return;
    }

    await openMarkdownTarget(selected);
  }, [currentVault?.path, isOpenTargetBusy, openMarkdownTarget]);

  useEffect(() => {
    const handleOpenMarkdownFile = () => {
      void handleOpenSelectedFile();
    };

    window.addEventListener('vlaina-open-markdown-file', handleOpenMarkdownFile);
    return () => window.removeEventListener('vlaina-open-markdown-file', handleOpenMarkdownFile);
  }, [handleOpenSelectedFile]);

  useEffect(() => {
    return subscribeOpenMarkdownTargetEvent((absolutePath) => {
      void openMarkdownTarget(absolutePath);
    });
  }, [openMarkdownTarget]);

  useEffect(() => {
    return subscribeDeleteCurrentNoteEvent(() => {
      if (!currentNotePath) {
        return;
      }
      setPendingDeleteCurrentNotePath(currentNotePath);
    });
  }, [currentNotePath]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesShortcutBinding(e, 'toggleEmbeddedChat')) {
        e.preventDefault();
        toggleChatPanel();
        return;
      }

      if (matchesShortcutBinding(e, 'openNewChat')) {
        e.preventDefault();
        runOpenNewChatShortcut();
        focusNotesChatComposer();
        return;
      }

      if (matchesShortcutBinding(e, 'toggleTemporaryChatWelcome')) {
        e.preventDefault();
        runTemporaryChatWelcomeShortcut();
        focusNotesChatComposer();
        return;
      }

      const target = e.target;
      if (target instanceof Element && target.closest('[data-notes-chat-panel="true"]')) {
        return;
      }

      if (matchesShortcutBinding(e, 'nextNoteTab') && openTabs.length > 1) {
        e.preventDefault();
        const currentIndex = openTabs.findIndex(t => t.path === currentNotePath);
        if (currentIndex === -1) return;
        const nextIndex = currentIndex === openTabs.length - 1 ? 0 : currentIndex + 1;
        openNote(openTabs[nextIndex].path);
        return;
      }

      if (matchesShortcutBinding(e, 'previousNoteTab') && openTabs.length > 1) {
        e.preventDefault();
        const currentIndex = openTabs.findIndex(t => t.path === currentNotePath);
        if (currentIndex === -1) return;
        const nextIndex = currentIndex === 0 ? openTabs.length - 1 : currentIndex - 1;
        openNote(openTabs[nextIndex].path);
        return;
      }

      if (matchesShortcutBinding(e, 'closeCurrentTab') && currentNotePath) {
        e.preventDefault();
        closeTab(currentNotePath);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, closeTab, currentNotePath, focusNotesChatComposer, openNote, openTabs, toggleChatPanel]);

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
            <MarkdownEditor
              peekOffset={sidebarWidth}
            />
          ) : (
            <div className="flex-1 h-full" />
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
