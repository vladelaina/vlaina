// NotesPage - Main notes view container

import { useEffect, useState, useRef } from 'react';
import { windowCommands } from '@/lib/tauri/invoke';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { useUIStore } from '@/stores/uiSlice';
import { MarkdownEditor } from './features/Editor';
import { NoteSearch } from './features/Search';
import { VaultWelcome } from '@/components/VaultWelcome';
import { SidebarContent } from './features/Sidebar/SidebarContent';
import { useNotesSidebarResize } from '@/hooks/useSidebarResize';
import { AnimatePresence, motion } from 'framer-motion';
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
  const [isPeeking, setIsPeeking] = useState(false);
  const peekTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load assets and cleanup temp files when vault is present
  const { loadAssets, cleanupAssetTempFiles } = useNotesStore();

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    };
  }, []);


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

      {/* Static Sidebar */}
      {/* Static Sidebar with Premium Physics */}
      <motion.aside
        initial={false}
        animate={{
          width: sidebarCollapsed ? 0 : sidebarWidth,
          opacity: 1
        }}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
        className="flex-shrink-0 flex flex-col overflow-hidden select-none relative"
        style={{
          backgroundColor: NOTES_COLORS.sidebarBg,
        }}
      >
        <SidebarContent
          onSearchClick={() => setShowSearch(true)}
          rootFolder={rootFolder}
          isLoading={isLoading}
          currentNote={currentNote}
          createNote={createNote}
          createFolder={(path) => createFolder(path)}
        />
      </motion.aside>

      {/* Hover Peek - Trigger Zone & Floating Sidebar */}
      {sidebarCollapsed && (
        <>
          {/* Trigger Zone - Invisible strip on the left edge with Intent Delay */}
          <div
            className="fixed top-0 left-0 bottom-0 w-12 z-[40]"
            onMouseEnter={() => {
              // Intent Detection: Wait 75ms (Perceptually instant, physically filter)
              // With 48px width, a fast swipe (< 40ms) will leave before this fires.
              peekTimerRef.current = setTimeout(() => {
                setIsPeeking(true);
              }, 75);
            }}
            onMouseLeave={() => {
              // If user leaves quickly (e.g. exiting window or swipe), cancel peek
              if (peekTimerRef.current) {
                clearTimeout(peekTimerRef.current);
                peekTimerRef.current = null;
              }
            }}
          />

          {/* Floating Sidebar Overlay */}
          <AnimatePresence>
            {isPeeking && (
              <>
                {/* Backdrop - Optional, maybe just click outside to close? 
                     Actually Notion doesn't have a backdrop, it just closes when you leave. 
                     Let's stick to "Leave to Close" for now. */}

                <motion.aside
                  initial={{ x: '-100%', opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: '-100%', opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 40 }}
                  className="fixed top-0 left-0 bottom-0 w-[260px] z-[50] shadow-2xl border-r border-black/5 dark:border-white/5"
                  style={{ backgroundColor: NOTES_COLORS.sidebarBg }}
                  onMouseLeave={() => setIsPeeking(false)}
                >
                  <SidebarContent
                    onSearchClick={() => setShowSearch(true)}
                    rootFolder={rootFolder}
                    isLoading={isLoading}
                    currentNote={currentNote}
                    createNote={createNote}
                    createFolder={(path) => createFolder(path)}
                  />
                </motion.aside>
              </>
            )}
          </AnimatePresence>
        </>
      )}

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
            {/* If peeking, we might want to push content or just overlay. 
                 Decision: Overlay (as per plan & user request for "pop out"). */}
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
