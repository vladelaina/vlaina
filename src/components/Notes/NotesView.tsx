import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { windowCommands } from '@/lib/tauri/invoke';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { useUIStore } from '@/stores/uiSlice';
import { matchesShortcutBinding } from '@/lib/shortcuts';
import { ResizablePanel } from '@/components/layout/ResizablePanel';
import { ResizeDividerVisual, RESIZE_HANDLE_HIT_WIDTH } from '@/components/layout/shell/ResizeDividerVisual';
import { ModuleShortcutsDialog } from '@/components/common/ModuleShortcutsDialog';
import { MarkdownEditor } from './features/Editor';
import { VaultWelcome } from '@/components/VaultWelcome';
import { useModuleShortcutsDialog } from '@/hooks/useModuleShortcutsDialog';

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
  const cleanupAssetTempFiles = useNotesStore(s => s.cleanupAssetTempFiles);
  const clearAssetUrlCache = useNotesStore(s => s.clearAssetUrlCache);
  const revealFolder = useNotesStore(s => s.revealFolder);
  const pendingStarredNavigation = useNotesStore(s => s.pendingStarredNavigation);
  const setPendingStarredNavigation = useNotesStore(s => s.setPendingStarredNavigation);
  const notesPath = useNotesStore(s => s.notesPath);
  const rootFolder = useNotesStore(s => s.rootFolder);

  const { currentVault } = useVaultStore();
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const chatPanelCollapsed = useUIStore((s) => s.notesChatPanelCollapsed);
  const setChatPanelCollapsed = useUIStore((s) => s.setNotesChatPanelCollapsed);
  const toggleChatPanel = useUIStore((s) => s.toggleNotesChatPanel);
  const setLayoutPanelDragging = useUIStore((s) => s.setLayoutPanelDragging);

  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const toggleShortcutsDialog = useCallback(() => setIsShortcutsOpen((prev) => !prev), []);
  const handleChatPanelDragStateChange = useCallback((dragging: boolean) => {
    setLayoutPanelDragging(dragging);
  }, [setLayoutPanelDragging]);

  useModuleShortcutsDialog({ onToggle: toggleShortcutsDialog });

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesShortcutBinding(e, 'toggleEmbeddedChat')) {
        e.preventDefault();
        toggleChatPanel();
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
  }, [openTabs, currentNotePath, openNote, closeTab]);

  if (!currentVault && !currentNotePath) {
    return (
      <div className="h-full bg-[var(--neko-bg-primary)] relative flex flex-col">
        <VaultWelcome />
      </div>
    );
  }

  return (
    <>
      <div className="h-full w-full relative flex min-w-0">
        <div className="flex-1 min-w-0">
          {currentNotePath ? (
            <MarkdownEditor peekOffset={sidebarWidth} />
          ) : (
            <div className="flex-1 h-full" />
          )}
        </div>

        {!chatPanelCollapsed && (
          <ResizablePanel
            defaultWidth={420}
            minWidth={320}
            maxWidth={760}
            storageKey="nekotick_notes_chat_panel_width"
            onDragStateChange={handleChatPanelDragStateChange}
            className="h-full border-l border-[#eff3f4] bg-[var(--neko-bg-primary)]"
          >
            <div data-notes-chat-panel="true" className="h-full min-h-0 relative">
              <Suspense fallback={null}>
                <EmbeddedChatView mode="embedded" />
              </Suspense>
            </div>
          </ResizablePanel>
        )}

        {chatPanelCollapsed && (
          <button
            type="button"
            aria-label="Toggle chat sidebar"
            onClick={() => setChatPanelCollapsed(false)}
            className="absolute inset-y-0 right-0 z-20 cursor-col-resize bg-transparent group flex items-center justify-center"
            style={{ width: RESIZE_HANDLE_HIT_WIDTH }}
          >
            <ResizeDividerVisual
              isVisible={false}
              className="pointer-events-none absolute inset-y-0 left-0"
            />
          </button>
        )}
      </div>
      
      <ModuleShortcutsDialog module="notes" open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen} />
    </>
  );
}
