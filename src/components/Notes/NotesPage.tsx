// NotesPage - Main notes view container

import { useEffect, useState } from 'react';
import { windowCommands } from '@/lib/tauri/invoke';
import { Search } from 'lucide-react';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { useUIStore } from '@/stores/uiSlice';
import { MarkdownEditor } from './features/Editor';
import { NoteSearch } from './features/Search';
import { VaultWelcome } from '@/components/VaultWelcome';
import { FavoritesSection } from './features/Sidebar/FavoritesSection';
import { GitHubSection } from './features/Sidebar/GitHubSection';
import { WorkspaceSection } from './features/Sidebar/WorkspaceSection';
import { useNotesSidebarResize } from '@/hooks/useSidebarResize';
import './features/BlockEditor/styles.css';
import { cn, NOTES_COLORS } from '@/lib/utils';

interface NotesPageProps {
  onOpenSettings?: () => void;
}

export function NotesPage({ onOpenSettings: _onOpenSettings }: NotesPageProps) {
  const {
    rootFolder,
    currentNote,
    isLoading,
    loadFileTree,
    createNote,
    createFolder,
    openNote,
    openTabs,
    closeTab,
    loadFavorites,
    loadMetadata,
  } = useNotesStore();

  const { currentVault } = useVaultStore();

  const {
    notesSidebarCollapsed: sidebarCollapsed,
    setSidebarHeaderHovered,
  } = useUIStore();

  const { sidebarWidth, isDragging, handleDragStart } = useNotesSidebarResize();

  const [showSearch, setShowSearch] = useState(false);

  // Load assets and cleanup temp files when vault is present
  const { loadAssets, cleanupAssetTempFiles } = useNotesStore();

  // Unlock main window resizable when vault is present
  useEffect(() => {
    if (!currentVault) return;
    loadFavorites(currentVault.path);
    loadMetadata(currentVault.path);
    loadAssets(currentVault.path);
    loadFileTree();

    // Cleanup orphaned temp files on startup
    cleanupAssetTempFiles();

    const unlockWindow = async () => {
      try {
        await windowCommands.setResizable(true);
      } catch (e) {
        console.error('Failed to unlock window:', e);
      }
    };

    unlockWindow();
  }, [currentVault, loadFavorites, loadMetadata, loadAssets, loadFileTree, cleanupAssetTempFiles]);



  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && e.ctrlKey && openTabs.length > 1) {
        e.preventDefault();
        const currentIndex = openTabs.findIndex(t => t.path === currentNote?.path);
        if (currentIndex === -1) return;

        let nextIndex: number;
        if (e.shiftKey) {
          nextIndex = currentIndex === 0 ? openTabs.length - 1 : currentIndex - 1;
        } else {
          nextIndex = currentIndex === openTabs.length - 1 ? 0 : currentIndex + 1;
        }

        openNote(openTabs[nextIndex].path);
      }

      if (e.key === 'w' && e.ctrlKey && !e.shiftKey && !e.altKey && currentNote) {
        e.preventDefault();
        closeTab(currentNote.path);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openTabs, currentNote, openNote, closeTab]);

  // Show vault welcome if no vault selected
  if (!currentVault) {
    return (
      <div className="h-full bg-[var(--neko-bg-primary)]">
        <VaultWelcome />
      </div>
    );
  }

  return (
    <div className={cn(
      "h-full flex overflow-hidden",
      "bg-[var(--neko-bg-primary)]",
      isDragging && "select-none cursor-col-resize"
    )}>

      <aside
        className={cn(
          "flex-shrink-0 flex flex-col overflow-hidden select-none",
          sidebarCollapsed && "w-0"
        )}
        style={{
          width: sidebarCollapsed ? 0 : sidebarWidth,
          backgroundColor: NOTES_COLORS.sidebarBg,
        }}
      >

        <div className="px-2 pt-2 pb-2">
          <button
            onClick={() => setShowSearch(true)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-lg",
              "bg-[var(--neko-bg-tertiary)] hover:bg-[var(--neko-hover-filled)]",
              "text-[var(--neko-text-secondary)] text-[13px]",
              "transition-colors"
            )}
          >
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left">Search</span>
          </button>
        </div>

        <div className="flex-1 overflow-auto neko-scrollbar">
          {/* Favorites Section */}
          <FavoritesSection />

          {/* GitHub Section */}
          <GitHubSection />

          {/* Workspace Section */}
          <WorkspaceSection
            rootFolder={rootFolder}
            isLoading={isLoading}
            currentNotePath={currentNote?.path}
            onCreateNote={() => createNote()}
            onCreateFolder={() => createFolder('')}
          />
        </div>


      </aside>

      {!sidebarCollapsed && (
        <>
          <div className="w-0.5 flex-shrink-0" style={{ backgroundColor: NOTES_COLORS.sidebarBg }} />
          <div
            onMouseDown={handleDragStart}
            onMouseEnter={() => setSidebarHeaderHovered(true)}
            onMouseLeave={() => setSidebarHeaderHovered(false)}
            className={cn(
              "w-2 cursor-col-resize group",
              "fixed top-0 bottom-0 z-10",
              "flex items-center justify-center"
            )}
            style={{ left: sidebarWidth - 2 }}
          >
            <div
              className="w-0.5 h-full transition-colors"
              style={{
                backgroundColor: isDragging ? NOTES_COLORS.dividerHover : 'transparent',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = NOTES_COLORS.dividerHover}
              onMouseLeave={(e) => !isDragging && (e.currentTarget.style.backgroundColor = 'transparent')}
            />
          </div>
        </>
      )}


      <main className="flex-1 flex flex-col min-w-0 bg-[var(--neko-bg-primary)]">
        {currentNote ? (
          <div className="flex-1 flex min-h-0">
            <div className="flex-1 min-w-0">
              <MarkdownEditor />
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}
      </main>

      <NoteSearch isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </div>
  );
}
