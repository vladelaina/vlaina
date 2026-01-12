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

const AI_PANEL_WIDTH = 360;

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
    notesShowAIPanel: showAIPanel,
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
              "fixed top-0 bottom-0 z-[100]",
              "flex items-center justify-center"
            )}
            style={{ left: sidebarWidth - 2 }}
          >
            <div
              className="w-0.5 h-full transition-colors"
              style={{
                backgroundColor: isDragging ? NOTES_COLORS.dividerHover : NOTES_COLORS.divider,
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = NOTES_COLORS.dividerHover}
              onMouseLeave={(e) => !isDragging && (e.currentTarget.style.backgroundColor = NOTES_COLORS.divider)}
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

      {showAIPanel && (
        <AIPanelContent />
      )}

      <NoteSearch isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </div>
  );
}

function AIPanelContent() {
  const [showAddMenu, setShowAddMenu] = useState(false);

  return (
    <aside
      className="flex-shrink-0 border-l border-[var(--neko-border)] bg-[var(--neko-bg-primary)] flex flex-col"
      style={{ width: AI_PANEL_WIDTH }}
    >
      <div className="flex-1 overflow-auto neko-scrollbar px-4 pb-4">
      </div>

      <div className="p-3">
        <div className="rounded-xl border border-[var(--neko-border)] bg-[var(--neko-bg-secondary)] overflow-hidden relative">
          <textarea
            placeholder="What are your thoughts?"
            rows={3}
            className={cn(
              "w-full px-4 py-3 resize-none border-none",
              "bg-transparent",
              "text-sm text-[var(--neko-text-primary)]",
              "placeholder:text-[var(--neko-text-tertiary)] placeholder:font-medium",
              "outline-none"
            )}
            disabled
          />
          <div className="flex items-center justify-between px-3 py-2">
            <div className="relative">
              <button
                className="p-1.5 rounded-md hover:bg-[var(--neko-hover)] text-[var(--neko-text-tertiary)] transition-colors"
                onClick={() => setShowAddMenu(!showAddMenu)}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              {showAddMenu && (
                <div className="absolute bottom-full left-0 mb-2 w-56 bg-[var(--neko-bg-primary)] border border-[var(--neko-border)] rounded-lg shadow-lg py-1 z-50">
                  <button
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--neko-text-primary)] hover:bg-[var(--neko-hover)] transition-colors"
                    onClick={() => setShowAddMenu(false)}
                  >
                    <svg className="w-5 h-5 text-[var(--neko-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    Upload images
                  </button>
                  <button
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--neko-text-primary)] hover:bg-[var(--neko-hover)] transition-colors"
                    onClick={() => setShowAddMenu(false)}
                  >
                    <svg className="w-5 h-5 text-[var(--neko-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload files (pdf, txt, csv)
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="p-1.5 rounded-md hover:bg-[var(--neko-hover)] text-[var(--neko-text-tertiary)] transition-colors"
                disabled
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <button
                className="p-1.5 rounded-md hover:bg-[var(--neko-hover)] transition-colors"
                style={{ color: '#1E96EB' }}
                disabled
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

      </div>
    </aside>
  );
}
