/**
 * NotesPage - Main notes view container
 * 
 * Modern block-editor style layout with sidebar and editor
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { 
  IconSearch, 
  IconPlus,
  IconFiles,
  IconStar,
  IconTrash,
  IconFolder,
} from '@tabler/icons-react';

// Custom filled sparkles icon
function SparklesFilledIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg 
      className={className} 
      style={style}
      viewBox="0 0 24 24" 
      fill="currentColor"
    >
      <path d="M12 2L13.09 8.26L18 6L15.74 10.91L22 12L15.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L8.26 13.09L2 12L8.26 10.91L6 6L10.91 8.26L12 2Z" />
    </svg>
  );
}
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { FileTree } from './features/FileTree';
import { MarkdownEditor } from './features/Editor';
import { NoteSearch } from './features/Search';
import './features/BlockEditor/styles.css';
import { cn } from '@/lib/utils';

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 400;
const AI_PANEL_WIDTH = 360;

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
  } = useNotesStore();
  
  // UI State from useUIStore
  const {
    notesSidebarCollapsed: sidebarCollapsed,
    notesSidebarWidth: sidebarWidth,
    setNotesSidebarWidth: setSidebarWidth,
    notesShowAIPanel: showAIPanel,
  } = useUIStore();
  
  // Local UI State
  const [isDragging, setIsDragging] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // Load file tree on mount
  useEffect(() => {
    loadFileTree();
  }, [loadFileTree]);

  // Global keyboard shortcuts for tab switching (Ctrl+Tab / Ctrl+Shift+Tab) and close (Ctrl+W)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Tab / Ctrl+Shift+Tab: 切换标签
      if (e.key === 'Tab' && e.ctrlKey && openTabs.length > 1) {
        e.preventDefault();
        const currentIndex = openTabs.findIndex(t => t.path === currentNote?.path);
        if (currentIndex === -1) return;
        
        let nextIndex: number;
        if (e.shiftKey) {
          // Ctrl+Shift+Tab: 切换到上一个标签
          nextIndex = currentIndex === 0 ? openTabs.length - 1 : currentIndex - 1;
        } else {
          // Ctrl+Tab: 切换到下一个标签
          nextIndex = currentIndex === openTabs.length - 1 ? 0 : currentIndex + 1;
        }
        
        openNote(openTabs[nextIndex].path);
      }
      
      // Ctrl+W: 关闭当前标签
      if (e.key === 'w' && e.ctrlKey && !e.shiftKey && !e.altKey && currentNote) {
        e.preventDefault();
        closeTab(currentNote.path);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openTabs, currentNote, openNote, closeTab]);

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
          "flex-shrink-0 flex flex-col overflow-hidden",
          "bg-[var(--neko-sidebar-bg)]",
          sidebarCollapsed && "w-0"
        )}
        style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
      >

        {/* Quick Search */}
        <div className="px-2 pt-3 pb-2">
          <button
            onClick={() => setShowSearch(true)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-lg",
              "bg-[var(--neko-bg-tertiary)] hover:bg-[var(--neko-hover-filled)]",
              "text-[var(--neko-text-secondary)] text-[13px]",
              "transition-colors"
            )}
          >
            <IconSearch className="w-4 h-4" />
            <span className="flex-1 text-left">Search</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto neko-scrollbar">
          {/* File Tree Section */}
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
                <IconPlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  const name = prompt('Folder name:');
                  if (name?.trim()) createFolder('', name.trim());
                }}
                className="p-1 rounded hover:bg-[var(--neko-hover)] text-[var(--neko-icon-secondary)] transition-colors"
                title="New Folder"
              >
                <IconFolder className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          
          <div className="px-1">
            <FileTree 
              rootFolder={rootFolder} 
              isLoading={isLoading}
              currentNotePath={currentNote?.path}
            />
          </div>

          {/* Divider */}
          <div className="mx-3 my-3 h-px bg-[var(--neko-divider)]" />

          {/* Navigation Items */}
          <div className="px-2 space-y-0.5 pb-2">
            <NavItem icon={<IconFiles />} label="All docs" />
            <NavItem icon={<IconStar />} label="Favorites" />
            <NavItem icon={<IconTrash />} label="Trash" />
          </div>
        </div>
      </aside>

      {/* Resize Handle - Hidden when sidebar collapsed, extends full window height */}
      {!sidebarCollapsed && (
        <>
          {/* Spacer to maintain layout */}
          <div className="w-1 flex-shrink-0 bg-[var(--neko-sidebar-bg)]" />
          {/* Actual resize handle with fixed positioning - wider hit area but thin visible line */}
          <div
            onMouseDown={handleDragStart}
            className={cn(
              "w-2 cursor-col-resize group",
              "fixed top-0 bottom-0 z-[100]",
              "flex items-center justify-center"
            )}
            style={{ left: sidebarWidth - 2 }}
          >
            {/* Thin visible line */}
            <div 
              className={cn(
                "w-0.5 h-full transition-colors",
                "group-hover:bg-[var(--neko-accent)]",
                isDragging && "bg-[var(--neko-accent)]"
              )}
            />
          </div>
        </>
      )}


      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[var(--neko-bg-primary)]">
        {/* Editor or Empty State */}
        {currentNote ? (
          <div className="flex-1 flex min-h-0">
            <div className="flex-1 min-w-0">
              <MarkdownEditor />
            </div>
          </div>
        ) : (
          <EmptyState onCreateNote={() => createNote()} onOpenSearch={() => setShowSearch(true)} />
        )}
      </main>

      {/* AI Panel - Outside main to extend full height */}
      {showAIPanel && (
        <AIPanelContent />
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
            <IconPlus className="w-4 h-4" />
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
            <IconSearch className="w-4 h-4" />
            Open Note
          </button>
        </div>
      </div>
    </div>
  );
}

/* AI Panel Content Component */
function AIPanelContent() {
  const [showAddMenu, setShowAddMenu] = useState(false);

  return (
    <aside 
      className="flex-shrink-0 border-l border-[var(--neko-border)] bg-[var(--neko-bg-primary)] flex flex-col"
      style={{ width: AI_PANEL_WIDTH }}
    >
      {/* AI Panel Content - Chat Messages Area */}
      <div className="flex-1 overflow-auto neko-scrollbar px-4 pb-4">
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ backgroundColor: 'rgba(30, 150, 235, 0.1)' }}
          >
            <SparklesFilledIcon className="w-8 h-8" style={{ color: '#1E96EB' }} />
          </div>
          <h3 className="text-lg font-medium text-[var(--neko-text-primary)] mb-2">
            AI 助手
          </h3>
          <p className="text-sm text-[var(--neko-text-secondary)]">
            即将推出...
          </p>
        </div>
      </div>

      {/* AI Panel Input */}
      <div className="p-3">
        <div className="rounded-xl border border-[var(--neko-border)] bg-[var(--neko-bg-secondary)] overflow-hidden relative">
          {/* Input Area */}
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
          {/* Bottom Actions */}
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
              {/* Add Menu Dropdown */}
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
        {/* Disclaimer */}
        <p className="text-xs text-[var(--neko-text-tertiary)] mt-2 text-center">
          ⓘ AI outputs can be misleading or wrong
        </p>
      </div>
    </aside>
  );
}
