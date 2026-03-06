import { lazy, Suspense, useEffect, useState } from 'react';
import { windowCommands } from '@/lib/tauri/invoke';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { useUIStore } from '@/stores/uiSlice';
import { ResizablePanel } from '@/components/layout/ResizablePanel';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ShortcutKeys } from '@/components/ui/shortcut-keys';
import { ResizeDividerVisual, RESIZE_HANDLE_HIT_WIDTH } from '@/components/layout/shell/ResizeDividerVisual';
import { MarkdownEditor } from './features/Editor';
import { NoteSearch } from './features/Search';
import { VaultWelcome } from '@/components/VaultWelcome';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';

const EmbeddedChatView = lazy(async () => {
  const mod = await import('@/components/Chat/ChatView');
  return { default: mod.ChatView };
});

const CHAT_PANEL_COLLAPSED_KEY = 'nekotick_notes_chat_panel_collapsed';

function loadChatPanelCollapsed(): boolean {
  try {
    return localStorage.getItem(CHAT_PANEL_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function NotesView() {
  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const loadFileTree = useNotesStore(s => s.loadFileTree);
  const openTabs = useNotesStore(s => s.openTabs);
  const closeTab = useNotesStore(s => s.closeTab);
  const openNote = useNotesStore(s => s.openNote);
  const loadFavorites = useNotesStore(s => s.loadFavorites);
  const loadMetadata = useNotesStore(s => s.loadMetadata);
  const loadAssets = useNotesStore(s => s.loadAssets);
  const cleanupAssetTempFiles = useNotesStore(s => s.cleanupAssetTempFiles);
  const clearAssetUrlCache = useNotesStore(s => s.clearAssetUrlCache);

  const { currentVault } = useVaultStore();
  const { sidebarWidth, sidebarPeeking } = useUIStore(); // unified store

  const [showSearch, setShowSearch] = useState(false);
  const [chatPanelCollapsed, setChatPanelCollapsed] = useState(loadChatPanelCollapsed);

  useEffect(() => {
    if (!currentVault) return;
    loadFavorites(currentVault.path);
    loadMetadata(currentVault.path);
    loadAssets(currentVault.path);
    loadFileTree();
    cleanupAssetTempFiles();

    const unlockWindow = async () => {
      try {
        await windowCommands.setResizable(true);
      } catch (e) {
        console.error('Failed to unlock window:', e);
      }
    };
    unlockWindow();

    return () => {
      clearAssetUrlCache();
    };
  }, [currentVault, loadFavorites, loadMetadata, loadAssets, loadFileTree, cleanupAssetTempFiles, clearAssetUrlCache]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const hasPrimaryModifier = (e.ctrlKey || e.metaKey) && !e.altKey;
      if (hasPrimaryModifier && !e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setChatPanelCollapsed((prev) => !prev);
        return;
      }

      const target = e.target;
      if (target instanceof Element && target.closest('[data-notes-chat-panel="true"]')) {
        return;
      }

      if (e.key === 'Tab' && e.ctrlKey && openTabs.length > 1) {
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

      if (e.key === 'w' && e.ctrlKey && !e.shiftKey && !e.altKey && currentNotePath) {
        e.preventDefault();
        closeTab(currentNotePath);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openTabs, currentNotePath, openNote, closeTab]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_PANEL_COLLAPSED_KEY, String(chatPanelCollapsed));
    } catch {
      // ignore storage failures
    }
  }, [chatPanelCollapsed]);

  
  useGlobalSearch(() => setShowSearch(prev => !prev));


  if (!currentVault) {
    return (
      <div className="h-full bg-[var(--neko-bg-primary)] relative flex flex-col">
        {/* Minimal TitleBar for dragging - Only needed if AppShell is hidden, but if AppShell is visible, this might be double */}
        {/* We will handle the "No Vault" case in App.tsx to hide sidebar/titlebar if desired, or show them empty */}
        <VaultWelcome />
      </div>
    );
  }

  return (
    <>
      <div className="h-full w-full relative flex min-w-0">
        <div className="flex-1 min-w-0">
          {currentNotePath ? (
            <MarkdownEditor
              peekOffset={sidebarWidth}
              isPeeking={sidebarPeeking}
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
            storageKey="nekotick_notes_chat_panel_width"
            className="h-full bg-[var(--neko-bg-primary)] border-l-0"
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
              <span>Toggle Sidebar</span>
              <ShortcutKeys keys={['Ctrl', 'L']} />
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      
      <NoteSearch isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </>
  );
}
