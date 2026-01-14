// NotesPage - Main notes view container

import { useEffect, useState } from 'react';
import { windowCommands } from '@/lib/tauri/invoke';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { useUIStore } from '@/stores/uiSlice';
import { MarkdownEditor } from './features/Editor';
import { NoteSearch } from './features/Search';
import { VaultWelcome } from '@/components/VaultWelcome';
import { SidebarContent } from './features/Sidebar/SidebarContent';
import { useNotesSidebarResize } from '@/hooks/useSidebarResize';
import { motion } from 'framer-motion';
import { HoverPeekOverlay } from '@/components/ui/HoverPeekOverlay';
import { SPRING_PREMIUM } from '@/lib/animations';
import './features/BlockEditor/styles.css';
import { cn, NOTES_COLORS } from '@/lib/utils';


interface NotesPageProps {
  onOpenSettings?: () => void;
}

export function NotesPage({ onOpenSettings: _onOpenSettings }: NotesPageProps) {
  // CRITICAL: Only subscribe to what we actually render.
  // We do NOT need currentNote.content here, only whether a note exists.
  const rootFolder = useNotesStore(s => s.rootFolder);
  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const isLoading = useNotesStore(s => s.isLoading);
  const loadFileTree = useNotesStore(s => s.loadFileTree);
  const createNote = useNotesStore(s => s.createNote);
  const createFolder = useNotesStore(s => s.createFolder);
  const openNote = useNotesStore(s => s.openNote);
  const openTabs = useNotesStore(s => s.openTabs);
  const closeTab = useNotesStore(s => s.closeTab);
  const loadFavorites = useNotesStore(s => s.loadFavorites);
  const loadMetadata = useNotesStore(s => s.loadMetadata);

  const { currentVault } = useVaultStore();

  const {
    notesSidebarCollapsed: sidebarCollapsed,
    setSidebarHeaderHovered,
    setNotesSidebarPeeking,
  } = useUIStore();

  const { sidebarWidth, isDragging, handleDragStart } = useNotesSidebarResize();

  const [isPeeking, setIsPeeking] = useState(false);

  // Sync peeking state to global store for TitleBar
  useEffect(() => {
    setNotesSidebarPeeking(isPeeking);
  }, [isPeeking, setNotesSidebarPeeking]);

  const [showSearch, setShowSearch] = useState(false);

  // Load assets and cleanup temp files when vault is present
  const loadAssets = useNotesStore(s => s.loadAssets);
  const cleanupAssetTempFiles = useNotesStore(s => s.cleanupAssetTempFiles);

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

      // Search shortcut: Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openTabs, currentNotePath, openNote, closeTab]);

  // Show vault welcome if no vault selected
  if (!currentVault) {
    return (
      <div className="h-full bg-[var(--neko-bg-primary)]">
        <VaultWelcome />
      </div>
    );
  }

  // Common props for both Sidebar instances to ensure strict reuse/consistency
  const sidebarContentProps = {
    onSearchClick: () => setShowSearch(true),
    rootFolder,
    isLoading,
    currentNotePath,
    createNote,
    createFolder: (path: string) => createFolder(path),
  };

  return (
    <div className={cn(
      "h-full flex overflow-hidden",
      "bg-[var(--neko-bg-primary)]",
      isDragging && "select-none cursor-col-resize"
    )}>

      {/* Static Sidebar with Premium Physics */}
      <motion.aside
        initial={false}
        animate={{
          width: sidebarCollapsed ? 0 : sidebarWidth,
          opacity: 1
        }}
        transition={SPRING_PREMIUM}
        className="flex-shrink-0 flex flex-col overflow-hidden select-none relative"
        style={{
          backgroundColor: NOTES_COLORS.sidebarBg,
        }}
      >
        <SidebarContent {...sidebarContentProps} />
      </motion.aside>

      {/* Hover Peek - Trigger Zone & Floating Sidebar */}
      <HoverPeekOverlay
        isEnabled={sidebarCollapsed}
        width={sidebarWidth} // Sync with Golden Ratio width
        style={{ backgroundColor: NOTES_COLORS.sidebarBg }}
        onPeekChange={setIsPeeking}
      >
        <SidebarContent {...sidebarContentProps} isPeeking />
      </HoverPeekOverlay>

      {
        !sidebarCollapsed && (
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
        )
      }


      <main className="flex-1 flex flex-col min-w-0 bg-[var(--neko-bg-primary)]">
        {currentNotePath ? (
          <div className="flex-1 flex min-h-0">
            <div className="flex-1 min-w-0">
              <MarkdownEditor isPeeking={isPeeking} peekOffset={sidebarWidth} />
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}
      </main>

      <NoteSearch isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </div >
  );
}
