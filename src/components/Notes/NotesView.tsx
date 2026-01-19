import { useEffect, useState } from 'react';
import { windowCommands } from '@/lib/tauri/invoke';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { useUIStore } from '@/stores/uiSlice';
import { MarkdownEditor } from './features/Editor';
import { NoteSearch } from './features/Search';
import { VaultWelcome } from '@/components/VaultWelcome';

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

  // Initialize vault data
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

  // Keyboard Shortcuts
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

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openTabs, currentNotePath, openNote, closeTab]);

  // Expose search trigger to parent if needed via ref or context?
  // Actually, sidebar usually triggers search. 
  // We can listen to a global event or store signal if we want sidebar to trigger this local state.
  // OR: We can hoist `showSearch` state to UI store?
  // For now, let's keep it simple. The sidebar button might need to know how to trigger this.
  // The SidebarContent receives onSearchClick.
  // In the App.tsx lift-up, we'll need to coordinate this.
  
  // Temporary: Listen for a custom event for search?
  useEffect(() => {
    const handleOpenSearch = () => setShowSearch(true);
    window.addEventListener('neko-open-search', handleOpenSearch);
    return () => window.removeEventListener('neko-open-search', handleOpenSearch);
  }, []);

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
      <div className="h-full w-full relative">
         {currentNotePath ? (
           <MarkdownEditor 
             peekOffset={sidebarWidth}
             isPeeking={sidebarPeeking}
           />
         ) : (
           <div className="flex-1" />
         )}
      </div>
      
      <NoteSearch isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </>
  );
}
