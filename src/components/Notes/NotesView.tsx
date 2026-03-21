import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { windowCommands } from '@/lib/tauri/invoke';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { useUIStore } from '@/stores/uiSlice';
import { ResizablePanel } from '@/components/layout/ResizablePanel';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';
import { ResizeDividerVisual, RESIZE_HANDLE_HIT_WIDTH } from '@/components/layout/shell/ResizeDividerVisual';
import { ModuleShortcutsDialog } from '@/components/common/ModuleShortcutsDialog';
import { MarkdownEditor } from './features/Editor';
import { NoteSearch } from './features/Search';
import { VaultWelcome } from '@/components/VaultWelcome';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
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

  const [showSearch, setShowSearch] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const toggleShortcutsDialog = useCallback(() => setIsShortcutsOpen((prev) => !prev), []);

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
        await openNote(pendingStarredNavigation.relativePath);
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
      const hasPrimaryModifier = (e.ctrlKey || e.metaKey) && !e.altKey;
      if (hasPrimaryModifier && !e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        toggleChatPanel();
        return;
      }

      const target = e.target;
      if (target instanceof Element && target.closest('[data-notes-chat-panel="true"]')) {
        return;
      }

      if (e.key === 'Tab' && hasPrimaryModifier && openTabs.length > 1) {
        e.preventDefault();
        const currentIndex = openTabs.findIndex(t => t.path === currentNotePath);
        if (currentIndex === -1) return;

        let nextIndex: number;
        if (e.shiftKey) {
          nextIndex = currentIndex === 0 ? openTabs.length - 1 : currentIndex - 1;
        } else {
          nextIndex = currentIndex === openTabs.length - 1 ? 0 : currentIndex + 1;
        }
        openNote(openTabs[nextIndex].path);
      }

      if (e.key.toLowerCase() === 'w' && hasPrimaryModifier && !e.shiftKey && currentNotePath) {
        e.preventDefault();
        closeTab(currentNotePath);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openTabs, currentNotePath, openNote, closeTab]);

  useGlobalSearch(() => setShowSearch(prev => !prev));


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
            className="h-full border-l border-[#eff3f4] bg-[var(--neko-bg-primary)]"
            shortcutKeys={['Ctrl', 'L']}
          >
            <div data-notes-chat-panel="true" className="h-full min-h-0 relative">
              <Suspense fallback={null}>
                <EmbeddedChatView mode="embedded" />
              </Suspense>
            </div>
          </ResizablePanel>
        )}

        {chatPanelCollapsed && (
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
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
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={5} className="flex items-center gap-1.5 text-xs">
              <span>Toggle chat panel</span>
              <ShortcutKeys keys={['Ctrl', 'L']} />
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      
      <NoteSearch isOpen={showSearch} onClose={() => setShowSearch(false)} />
      <ModuleShortcutsDialog module="notes" open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen} />
    </>
  );
}
