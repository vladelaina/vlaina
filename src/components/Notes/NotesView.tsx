import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { windowCommands } from '@/lib/tauri/invoke';
import { openDialog, messageDialog } from '@/lib/storage/dialog';
import { OPEN_MARKDOWN_FILE_ACTION } from '@/lib/notes/openMarkdownFileText';
import { getSingleOpenSelection, isSupportedMarkdownSelection, resolveOpenNoteTarget } from './features/OpenTarget/openTargetSelection';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { useUIStore } from '@/stores/uiSlice';
import { matchesShortcutBinding } from '@/lib/shortcuts';
import { focusComposerInput } from '@/lib/ui/composerFocusRegistry';
import { ResizablePanel } from '@/components/layout/ResizablePanel';
import { ModuleShortcutsDialog } from '@/components/common/ModuleShortcutsDialog';
import { MarkdownEditor } from './features/Editor';
import { useModuleShortcutsDialog } from '@/hooks/useModuleShortcutsDialog';
import {
  runOpenNewChatShortcut,
  runTemporaryChatWelcomeShortcut,
} from '@/components/Chat/features/Temporary/temporaryChatCommands';
import { useCurrentVaultExternalPathSync } from './hooks/useCurrentVaultExternalPathSync';
import { useNotesExternalSync } from './hooks/useNotesExternalSync';

const EmbeddedChatView = lazy(async () => {
  const mod = await import('@/components/Chat/ChatView');
  return { default: mod.ChatView };
});

export function NotesView() {
  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const loadFileTree = useNotesStore(s => s.loadFileTree);
  const openTabs = useNotesStore(s => s.openTabs);
  const closeTab = useNotesStore(s => s.closeTab);
  const openNote = useNotesStore(s => s.openNote);
  const loadStarred = useNotesStore(s => s.loadStarred);
  const loadMetadata = useNotesStore(s => s.loadMetadata);
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
  const openNoteByAbsolutePath = useNotesStore(s => s.openNoteByAbsolutePath);

  const { currentVault, openVault } = useVaultStore();
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const chatPanelCollapsed = useUIStore((s) => s.notesChatPanelCollapsed);
  const setChatPanelCollapsed = useUIStore((s) => s.setNotesChatPanelCollapsed);
  const toggleChatPanel = useUIStore((s) => s.toggleNotesChatPanel);
  const setLayoutPanelDragging = useUIStore((s) => s.setLayoutPanelDragging);

  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isOpenTargetBusy, setIsOpenTargetBusy] = useState(false);
  const [pendingShortcutNoteTarget, setPendingShortcutNoteTarget] = useState<{
    vaultPath: string;
    notePath: string;
    absolutePath: string;
  } | null>(null);
  const chatComposerFocusFrameRef = useRef<number | null>(null);
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

  useModuleShortcutsDialog({ onToggle: toggleShortcutsDialog });
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
        loadMetadata(currentVault.path),
        loadAssets(currentVault.path),
        loadFileTree(),
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
  }, [currentVault, loadStarred, loadMetadata, loadAssets, loadFileTree, cleanupAssetTempFiles, clearAssetUrlCache]);

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

  const openShortcutNoteTarget = useCallback(async (target: { notePath: string; absolutePath: string }) => {
    await openNote(target.notePath);
    if (useNotesStore.getState().currentNote?.path === target.notePath) {
      return true;
    }

    await openNoteByAbsolutePath(target.absolutePath);
    return useNotesStore.getState().currentNote?.path === target.absolutePath;
  }, [openNote, openNoteByAbsolutePath]);

  useEffect(() => {
    if (!pendingShortcutNoteTarget || !currentVault) return;
    if (currentVault.path !== pendingShortcutNoteTarget.vaultPath) return;
    if (notesPath !== pendingShortcutNoteTarget.vaultPath || !rootFolder) return;

    let cancelled = false;

    const openPendingShortcutNote = async () => {
      let opened = false;

      try {
        opened = await openShortcutNoteTarget(pendingShortcutNoteTarget);
      } finally {
        if (!cancelled) {
          setPendingShortcutNoteTarget(null);
        }
      }

      if (!cancelled && !opened) {
        await messageDialog('Failed to open the selected Markdown file.', {
          title: 'Open Failed',
          kind: 'error',
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
    await saveNote();
    return !useNotesStore.getState().isDirty;
  }, [isDirty, saveNote]);

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

    setIsOpenTargetBusy(true);
    try {
      const canContinue = await saveCurrentNoteIfNeeded();
      if (!canContinue) return;

      const target = resolveOpenNoteTarget(selected);

      if (currentVault?.path === target.vaultPath && notesPath === target.vaultPath && rootFolder) {
        const opened = await openShortcutNoteTarget({
          notePath: target.notePath,
          absolutePath: selected,
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
        vaultPath: target.vaultPath,
        notePath: target.notePath,
        absolutePath: selected,
      });

      if (currentVault?.path === target.vaultPath) {
        return;
      }

      const openedVault = await openVault(target.vaultPath);
      if (!openedVault) {
        setPendingShortcutNoteTarget(null);
        await messageDialog('Failed to open the selected vault.', {
          title: 'Open Failed',
          kind: 'error',
        });
      }
    } catch (error) {
      setPendingShortcutNoteTarget(null);
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

  useEffect(() => {
    const handleOpenMarkdownFile = () => {
      void handleOpenSelectedFile();
    };

    window.addEventListener('vlaina-open-markdown-file', handleOpenMarkdownFile);
    return () => window.removeEventListener('vlaina-open-markdown-file', handleOpenMarkdownFile);
  }, [handleOpenSelectedFile]);

  useEffect(() => {
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
  }, [closeTab, currentNotePath, focusNotesChatComposer, openNote, openTabs, toggleChatPanel]);

  return (
    <>
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

        {!chatPanelCollapsed && (
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
                <EmbeddedChatView mode="embedded" />
              </Suspense>
            </div>
          </ResizablePanel>
        )}

      </div>
      
      <ModuleShortcutsDialog module="notes" open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen} />
    </>
  );
}
