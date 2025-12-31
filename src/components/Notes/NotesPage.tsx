/**
 * NotesPage - Main notes view container
 * 
 * Simplified layout:
 * - Left sidebar: FileTree + Search
 * - Center: Tab bar + Markdown editor
 * - Right sidebar: Outline, Backlinks (optional)
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { 
  NotePencilIcon, 
  MagnifyingGlassIcon, 
  ListBulletsIcon, 
  QuestionIcon,
  GraphIcon,
  ArrowUUpLeftIcon,
  CommandIcon,
  FileTextIcon
} from '@phosphor-icons/react';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { FileTree } from './features/FileTree';
import { MarkdownEditor } from './features/Editor';
import { NoteSearch, FullTextSearch } from './features/Search';
import { NoteOutline } from './features/Outline';
import { KeyboardShortcuts } from './features/Help';
import { NoteTabs } from './features/Tabs';
import { CommandPalette, createDefaultCommands } from './features/CommandPalette';
import { GraphView } from './features/Graph';
import { BacklinksPanel } from './features/Backlinks';
import { PropertiesPanel } from './features/Properties';
import { cn } from '@/lib/utils';

const PANEL_MIN_WIDTH = 180;
const PANEL_DEFAULT_WIDTH = 260;
const RIGHT_PANEL_WIDTH = 220;
const PANEL_STORAGE_KEY = 'nekotick-notes-panel-width';

function loadPanelWidth(): number {
  try {
    const saved = localStorage.getItem(PANEL_STORAGE_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= PANEL_MIN_WIDTH) return parsed;
    }
  } catch { /* ignore */ }
  return PANEL_DEFAULT_WIDTH;
}

export function NotesPage() {
  const { 
    rootFolder, 
    currentNote, 
    isLoading, 
    loadFileTree, 
    createNote,
    createNoteWithContent,
    createFolder,
    saveNote,
    deleteNote,
    renameNote,
    openNote,
    openTabs,
    closeTab,
  } = useNotesStore();
  
  const { setAppViewMode } = useUIStore();
  
  // UI State
  const [panelWidth, setPanelWidth] = useState(loadPanelWidth);
  const [isDragging, setIsDragging] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showFullSearch, setShowFullSearch] = useState(false);
  const [showOutline, setShowOutline] = useState(true);
  const [showBacklinks, setShowBacklinks] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // Load file tree on mount
  useEffect(() => {
    loadFileTree();
  }, [loadFileTree]);

  // Command palette commands
  const commands = useMemo(() => createDefaultCommands({
    createNote: () => createNote(),
    createFolder: () => {
      const name = prompt('Folder name:');
      if (name?.trim()) createFolder('', name.trim());
    },
    saveNote: () => saveNote(),
    deleteNote: () => {
      if (currentNote && confirm('Delete this note?')) {
        deleteNote(currentNote.path);
      }
    },
    renameNote: () => {
      if (currentNote) {
        const currentName = currentNote.path.split('/').pop()?.replace('.md', '') || '';
        const newName = prompt('New name:', currentName);
        if (newName?.trim()) renameNote(currentNote.path, newName.trim());
      }
    },
    openSearch: () => setShowSearch(true),
    toggleOutline: () => setShowOutline(s => !s),
    toggleGraph: () => setShowGraph(true),
    toggleBacklinks: () => setShowBacklinks(s => !s),
    showShortcuts: () => setShowHelp(true),
    switchToCalendar: () => setAppViewMode('calendar'),
  }), [createNote, createFolder, saveNote, deleteNote, renameNote, currentNote, setAppViewMode]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+P for quick search
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setShowSearch(true);
      }
      // Ctrl+Shift+F for full text search
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setShowFullSearch(true);
      }
      // Ctrl+Shift+P for command palette
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      // Ctrl+N for new note - directly create without template dialog
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        createNote();
      }
      // Ctrl+G for graph
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        setShowGraph(true);
      }
      // Ctrl+/ for help
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowHelp(true);
      }
      // Escape to close modals
      if (e.key === 'Escape') {
        setShowSearch(false);
        setShowFullSearch(false);
        setShowHelp(false);
        setShowCommandPalette(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle wiki link clicks from editor
  useEffect(() => {
    const handleWikiLinkClick = async (e: CustomEvent<{ linkText: string }>) => {
      const { linkText } = e.detail;
      if (!linkText || !rootFolder) return;

      // Find note by name (case-insensitive)
      const findNote = (nodes: typeof rootFolder.children): string | null => {
        for (const node of nodes) {
          if (node.isFolder) {
            const found = findNote(node.children);
            if (found) return found;
          } else {
            const noteName = node.name.toLowerCase();
            if (noteName === linkText.toLowerCase() || 
                noteName === linkText.toLowerCase() + '.md') {
              return node.path;
            }
          }
        }
        return null;
      };

      const notePath = findNote(rootFolder.children);
      
      if (notePath) {
        // Open existing note
        openNote(notePath);
      } else {
        // Create new note with the link text as name
        const shouldCreate = confirm(`Note "${linkText}" doesn't exist. Create it?`);
        if (shouldCreate) {
          await createNoteWithContent(undefined, linkText, `# ${linkText}\n\n`);
        }
      }
    };

    window.addEventListener('wiki-link-click', handleWikiLinkClick as unknown as EventListener);
    return () => window.removeEventListener('wiki-link-click', handleWikiLinkClick as unknown as EventListener);
  }, [rootFolder, openNote, createNoteWithContent]);

  // Panel resize handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;
  }, [panelWidth]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current;
      const newWidth = Math.max(PANEL_MIN_WIDTH, dragStartWidth.current + delta);
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      localStorage.setItem(PANEL_STORAGE_KEY, panelWidth.toString());
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, panelWidth]);

  // Quick create note - no template, just blank
  const handleQuickCreateNote = async () => {
    await createNote();
  };

  return (
    <div className={cn(
      "h-full flex bg-white dark:bg-zinc-900",
      isDragging && "select-none cursor-col-resize"
    )}>
      {/* Left Sidebar */}
      <aside 
        className="flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50/50 dark:bg-zinc-900/50 overflow-hidden"
        style={{ width: panelWidth }}
      >
        {/* Search Buttons */}
        <div className="p-2 space-y-1 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setShowSearch(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <MagnifyingGlassIcon className="size-3.5" weight="bold" />
            <span>Quick Open</span>
            <span className="ml-auto text-[10px] text-zinc-300 dark:text-zinc-600">Ctrl+P</span>
          </button>
          <button
            onClick={() => setShowCommandPalette(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <CommandIcon className="size-3.5" weight="bold" />
            <span>Commands</span>
            <span className="ml-auto text-[10px] text-zinc-300 dark:text-zinc-600">Ctrl+Shift+P</span>
          </button>
        </div>

        {/* File Tree */}
        <div className="flex-1 overflow-auto">
          <FileTree 
            rootFolder={rootFolder} 
            isLoading={isLoading}
            currentNotePath={currentNote?.path}
          />
        </div>

        {/* Bottom Actions */}
        <div className="p-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-1">
          <button
            onClick={() => setShowGraph(true)}
            className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
            title="Graph View (Ctrl+G)"
          >
            <GraphIcon className="size-4" weight="bold" />
          </button>
          <button
            onClick={() => setShowFullSearch(true)}
            className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
            title="Search in Files (Ctrl+Shift+F)"
          >
            <MagnifyingGlassIcon className="size-4" weight="bold" />
          </button>
        </div>
      </aside>

      {/* Resize Handle */}
      <div
        onMouseDown={handleDragStart}
        className={cn(
          "w-[5px] flex-shrink-0 cursor-col-resize transition-colors",
          "bg-zinc-200/50 dark:bg-zinc-800/50",
          "hover:bg-zinc-300 dark:hover:bg-zinc-700",
          isDragging && "bg-zinc-400 dark:bg-zinc-600"
        )}
      />

      {/* Center: Tabs + Editor */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Tab Bar */}
        <NoteTabs
          tabs={openTabs}
          activeTabPath={currentNote?.path || null}
          onTabClick={(path) => openNote(path)}
          onTabClose={closeTab}
          onTabMiddleClick={closeTab}
        />

        {/* Editor */}
        {currentNote ? (
          <MarkdownEditor />
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-sm">
              <NotePencilIcon className="size-20 text-zinc-200 dark:text-zinc-700 mx-auto mb-6" weight="duotone" />
              <h2 className="text-lg font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                No note open
              </h2>
              <p className="text-sm text-zinc-400 dark:text-zinc-600 mb-6">
                Create a new note or open an existing one to start writing
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleQuickCreateNote}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
                >
                  <FileTextIcon className="size-4" />
                  New Note
                </button>
                <button
                  onClick={() => setShowSearch(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg transition-colors"
                >
                  <MagnifyingGlassIcon className="size-4" />
                  Open Note
                </button>
              </div>
              <p className="text-xs text-zinc-300 dark:text-zinc-700 mt-6">
                Press Ctrl+P to quick open • Ctrl+N for new note
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Right Sidebar */}
      {currentNote && (showOutline || showBacklinks) && (
        <>
          <div className="w-px bg-zinc-200 dark:bg-zinc-800" />
          <aside 
            className="flex-shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50 overflow-auto flex flex-col"
            style={{ width: RIGHT_PANEL_WIDTH }}
          >
            {showOutline && (
              <NoteOutline content={currentNote.content} />
            )}
            {showBacklinks && (
              <BacklinksPanel 
                currentNotePath={currentNote.path}
                onNavigate={openNote}
              />
            )}
            <PropertiesPanel 
              content={currentNote.content}
              path={currentNote.path}
            />
          </aside>
        </>
      )}

      {/* Floating Action Buttons */}
      {currentNote && (
        <div className="absolute right-4 bottom-4 flex items-center gap-2">
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 rounded-lg shadow-lg transition-colors bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700"
            title="Keyboard Shortcuts (Ctrl+/)"
          >
            <QuestionIcon className="size-5" weight="bold" />
          </button>
          <button
            onClick={() => setShowBacklinks(s => !s)}
            className={cn(
              "p-2 rounded-lg shadow-lg transition-colors",
              showBacklinks 
                ? "bg-purple-500 text-white" 
                : "bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
            )}
            title="Toggle Backlinks"
          >
            <ArrowUUpLeftIcon className="size-5" weight="bold" />
          </button>
          <button
            onClick={() => setShowOutline(s => !s)}
            className={cn(
              "p-2 rounded-lg shadow-lg transition-colors",
              showOutline 
                ? "bg-purple-500 text-white" 
                : "bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
            )}
            title="Toggle Outline"
          >
            <ListBulletsIcon className="size-5" weight="bold" />
          </button>
        </div>
      )}

      {/* Modals */}
      <NoteSearch isOpen={showSearch} onClose={() => setShowSearch(false)} />
      <FullTextSearch 
        isOpen={showFullSearch} 
        onClose={() => setShowFullSearch(false)} 
        onResultClick={(path) => {
          openNote(path);
          setShowFullSearch(false);
        }}
      />
      <KeyboardShortcuts isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <CommandPalette 
        isOpen={showCommandPalette} 
        onClose={() => setShowCommandPalette(false)}
        commands={commands}
      />
      <GraphView 
        isOpen={showGraph} 
        onClose={() => setShowGraph(false)}
        onNodeClick={(path) => {
          openNote(path);
          setShowGraph(false);
        }}
        currentNotePath={currentNote?.path}
      />
    </div>
  );
}
