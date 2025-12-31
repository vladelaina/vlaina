/**
 * NotesPage - Main notes view container
 * 
 * Modern block-editor style layout with sidebar and editor
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { 
  MagnifyingGlassIcon, 
  PlusIcon,
  HouseIcon,
  ClockIcon,
  StarIcon,
  TrashIcon,
  FolderIcon,
  CaretDoubleLeftIcon,
  ListIcon,
} from '@phosphor-icons/react';
import { useNotesStore } from '@/stores/useNotesStore';
import { FileTree } from './features/FileTree';
import { MarkdownEditor } from './features/Editor';
import { NoteSearch } from './features/Search';
import { NoteOutline } from './features/Outline';
import { NoteTabs } from './features/Tabs';
import { BacklinksPanel } from './features/Backlinks';
import { PropertiesPanel } from './features/Properties';
import { cn } from '@/lib/utils';

const SIDEBAR_WIDTH = 248;
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 400;
const RIGHT_PANEL_WIDTH = 260;

export function NotesPage() {
  const { 
    rootFolder, 
    currentNote, 
    isLoading, 
    loadFileTree, 
    createNote,
    createNoteWithContent,
    createFolder,
    openNote,
    openTabs,
    closeTab,
    // UI State from store
    sidebarCollapsed,
    rightPanelCollapsed,
    showOutline,
    showBacklinks,
    toggleSidebar,
    setShowOutline,
    setShowBacklinks,
  } = useNotesStore();
  
  // Local UI State
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // Load file tree on mount
  useEffect(() => {
    loadFileTree();
  }, [loadFileTree]);

  // Handle wiki link clicks
  useEffect(() => {
    const handleWikiLinkClick = async (e: CustomEvent<{ linkText: string }>) => {
      const { linkText } = e.detail;
      if (!linkText || !rootFolder) return;

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
        openNote(notePath);
      } else {
        const shouldCreate = confirm(`Note "${linkText}" doesn't exist. Create it?`);
        if (shouldCreate) {
          await createNoteWithContent(undefined, linkText, `# ${linkText}\n\n`);
        }
      }
    };

    window.addEventListener('wiki-link-click', handleWikiLinkClick as unknown as EventListener);
    return () => window.removeEventListener('wiki-link-click', handleWikiLinkClick as unknown as EventListener);
  }, [rootFolder, openNote, createNoteWithContent]);

  // Sidebar resize handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current;
      const newWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, dragStartWidth.current + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className={cn(
      "h-full flex",
      "bg-[var(--neko-bg-primary)]",
      isDragging && "select-none cursor-col-resize"
    )}>
      {/* Left Sidebar */}
      <aside 
        className={cn(
          "flex-shrink-0 flex flex-col overflow-hidden transition-[width] duration-200",
          "bg-[var(--neko-sidebar-bg)] border-r border-[var(--neko-border)]",
          sidebarCollapsed && "w-0 border-r-0"
        )}
        style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
      >

        {/* Sidebar Header */}
        <div 
          className="flex items-center justify-between px-3 h-[52px] flex-shrink-0"
          style={{ minHeight: 52 }}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">N</span>
            </div>
            <span className="text-[13px] font-medium text-[var(--neko-text-primary)]">
              Notes
            </span>
          </div>
          <button
            onClick={toggleSidebar}
            className="p-1 rounded hover:bg-[var(--neko-hover)] text-[var(--neko-icon-secondary)] transition-colors"
            title="Collapse sidebar"
          >
            <CaretDoubleLeftIcon className="w-4 h-4" weight="bold" />
          </button>
        </div>

        {/* Quick Search */}
        <div className="px-2 pb-2">
          <button
            onClick={() => setShowSearch(true)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-lg",
              "bg-[var(--neko-bg-tertiary)] hover:bg-[var(--neko-hover-filled)]",
              "text-[var(--neko-text-secondary)] text-[13px]",
              "transition-colors"
            )}
          >
            <MagnifyingGlassIcon className="w-4 h-4" />
            <span className="flex-1 text-left">Quick Search</span>
          </button>
        </div>

        {/* Navigation Items */}
        <div className="px-2 space-y-0.5">
          <NavItem icon={<HouseIcon weight="duotone" />} label="Home" />
          <NavItem icon={<ClockIcon weight="duotone" />} label="Recent" />
          <NavItem icon={<StarIcon weight="duotone" />} label="Favorites" />
          <NavItem icon={<TrashIcon weight="duotone" />} label="Trash" />
        </div>

        {/* Divider */}
        <div className="mx-3 my-3 h-px bg-[var(--neko-divider)]" />

        {/* File Tree Section */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="px-3 py-1.5 flex items-center justify-between">
            <span className="text-[11px] font-medium text-[var(--neko-text-tertiary)] uppercase tracking-wider">
              Workspace
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => createNote()}
                className="p-1 rounded hover:bg-[var(--neko-hover)] text-[var(--neko-icon-secondary)] transition-colors"
                title="New Note"
              >
                <PlusIcon className="w-3.5 h-3.5" weight="bold" />
              </button>
              <button
                onClick={() => {
                  const name = prompt('Folder name:');
                  if (name?.trim()) createFolder('', name.trim());
                }}
                className="p-1 rounded hover:bg-[var(--neko-hover)] text-[var(--neko-icon-secondary)] transition-colors"
                title="New Folder"
              >
                <FolderIcon className="w-3.5 h-3.5" weight="bold" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto px-1 neko-scrollbar">
            <FileTree 
              rootFolder={rootFolder} 
              isLoading={isLoading}
              currentNotePath={currentNote?.path}
            />
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="px-2 py-2 border-t border-[var(--neko-divider)]">
          {/* Footer area - reserved for future use */}
        </div>
      </aside>

      {/* Resize Handle */}
      {!sidebarCollapsed && (
        <div
          onMouseDown={handleDragStart}
          className={cn(
            "w-1 flex-shrink-0 cursor-col-resize transition-colors",
            "hover:bg-[var(--neko-accent)]",
            isDragging && "bg-[var(--neko-accent)]"
          )}
        />
      )}


      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[var(--neko-bg-primary)]">
        {/* Tab Bar */}
        {openTabs.length > 0 && (
          <NoteTabs
            tabs={openTabs}
            activeTabPath={currentNote?.path || null}
            onTabClick={(path) => openNote(path)}
            onTabClose={closeTab}
            onTabMiddleClick={closeTab}
          />
        )}

        {/* Editor or Empty State */}
        {currentNote ? (
          <div className="flex-1 flex min-h-0">
            <div className="flex-1 min-w-0">
              <MarkdownEditor />
            </div>
            
            {/* Right Panel */}
            {!rightPanelCollapsed && (showOutline || showBacklinks) && (
              <aside 
                className="flex-shrink-0 border-l border-[var(--neko-border)] bg-[var(--neko-bg-secondary)] overflow-auto neko-scrollbar"
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
            )}
          </div>
        ) : (
          <EmptyState onCreateNote={() => createNote()} onOpenSearch={() => setShowSearch(true)} />
        )}
      </main>

      {/* Floating Actions */}
      {currentNote && (
        <div className="absolute right-4 bottom-4 flex items-center gap-2">
          <FloatingButton
            onClick={() => setShowBacklinks(!showBacklinks)}
            active={showBacklinks && !rightPanelCollapsed}
            title="Backlinks"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 17H7A5 5 0 0 1 7 7h2" />
              <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </FloatingButton>
          <FloatingButton
            onClick={() => setShowOutline(!showOutline)}
            active={showOutline && !rightPanelCollapsed}
            title="Outline"
          >
            <ListIcon className="w-5 h-5" weight="bold" />
          </FloatingButton>
        </div>
      )}

      {/* Modals */}
      <NoteSearch isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </div>
  );
}

/* Navigation Item Component */
function NavItem({ icon, label, active = false, onClick }: { 
  icon: React.ReactNode; 
  label: string; 
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors",
        active 
          ? "bg-[var(--neko-accent-light)] text-[var(--neko-accent)]" 
          : "text-[var(--neko-text-secondary)] hover:bg-[var(--neko-hover)]"
      )}
    >
      <span className="w-5 h-5 flex items-center justify-center text-[var(--neko-icon-primary)]">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

/* Floating Button Component */
function FloatingButton({ 
  children, 
  onClick, 
  active, 
  title 
}: { 
  children: React.ReactNode; 
  onClick: () => void; 
  active: boolean;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-2.5 rounded-lg shadow-lg transition-all",
        active 
          ? "bg-[var(--neko-accent)] text-white" 
          : "bg-[var(--neko-bg-primary)] text-[var(--neko-icon-secondary)] border border-[var(--neko-border)] hover:bg-[var(--neko-hover-filled)]"
      )}
      title={title}
    >
      {children}
    </button>
  );
}

/* Empty State Component */
function EmptyState({ onCreateNote, onOpenSearch }: { onCreateNote: () => void; onOpenSearch: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md px-8">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center">
          <svg className="w-10 h-10 text-[var(--neko-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10,9 9,9 8,9" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-[var(--neko-text-primary)] mb-2">
          Start Writing
        </h2>
        <p className="text-[14px] text-[var(--neko-text-secondary)] mb-8 leading-relaxed">
          Create a new note to capture your thoughts, or open an existing one from the sidebar.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onCreateNote}
            className={cn(
              "flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg",
              "bg-[var(--neko-accent)] hover:bg-[var(--neko-accent-hover)]",
              "text-white text-[14px] font-medium transition-colors"
            )}
          >
            <PlusIcon className="w-4 h-4" weight="bold" />
            New Note
          </button>
          <button
            onClick={onOpenSearch}
            className={cn(
              "flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg",
              "bg-[var(--neko-bg-tertiary)] hover:bg-[var(--neko-hover-filled)]",
              "text-[var(--neko-text-primary)] text-[14px] font-medium transition-colors"
            )}
          >
            <MagnifyingGlassIcon className="w-4 h-4" />
            Open Note
          </button>
        </div>
      </div>
    </div>
  );
}
