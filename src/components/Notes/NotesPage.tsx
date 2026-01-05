// NotesPage - Main notes view container

import { useEffect, useState, useRef, useCallback } from 'react';
import { 
  IconSearch, 
  IconPlus,
  IconFolder,
  IconTriangleFilled,
  IconStar,
} from '@tabler/icons-react';

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
import { useNotesStore, type FolderNode } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { FileTree } from './features/FileTree';
import { MarkdownEditor } from './features/Editor';
import { NoteSearch } from './features/Search';
import { IconButton } from '@/components/ui/icon-button';
import './features/BlockEditor/styles.css';
import { cn, NOTES_COLORS } from '@/lib/utils';

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
  
  const {
    notesSidebarCollapsed: sidebarCollapsed,
    notesSidebarWidth: sidebarWidth,
    setNotesSidebarWidth: setSidebarWidth,
    notesShowAIPanel: showAIPanel,
  } = useUIStore();
  
  const [isDragging, setIsDragging] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  useEffect(() => {
    loadFileTree();
  }, [loadFileTree]);

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

        <div className="flex-1 overflow-auto neko-scrollbar">
          {/* Favorites Section */}
          <FavoritesSection />

          {/* Workspace Section */}
          <WorkspaceSection 
            rootFolder={rootFolder}
            isLoading={isLoading}
            currentNotePath={currentNote?.path}
            onCreateNote={() => createNote()}
            onCreateFolder={(name) => createFolder('', name)}
          />
        </div>
      </aside>

      {!sidebarCollapsed && (
        <>
          <div className="w-0.5 flex-shrink-0" style={{ backgroundColor: NOTES_COLORS.sidebarBg }} />
          <div
            onMouseDown={handleDragStart}
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
          <EmptyState onCreateNote={() => createNote()} onOpenSearch={() => setShowSearch(true)} />
        )}
      </main>

      {showAIPanel && (
        <AIPanelContent />
      )}

      <NoteSearch isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </div>
  );
}

function FavoritesSection() {
  const [expanded, setExpanded] = useState(true);
  const { starredNotes, openNote, currentNote, getDisplayName, getNoteIcon } = useNotesStore();
  
  return (
    <div className="mb-2">
      {/* Header */}
      <div className="px-2 py-1">
        <div 
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between px-2 py-1 rounded-md hover:bg-[var(--neko-hover)] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-[var(--neko-text-tertiary)] uppercase tracking-wider">
              Favorites
            </span>
            <IconTriangleFilled 
              className={cn(
                "w-1.5 h-1.5 text-[#CDCDCD] transition-transform",
                expanded ? "rotate-180" : "rotate-90"
              )} 
            />
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div 
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-1">
            {starredNotes.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="w-14 h-14 rounded-full bg-[var(--neko-bg-tertiary)] flex items-center justify-center">
                  <IconStar className="w-6 h-6 text-[var(--neko-text-tertiary)]" />
                </div>
                <span className="text-[15px] text-[var(--neko-text-tertiary)]">No favorites</span>
              </div>
            ) : (
              <div className="space-y-0.5">
                {starredNotes.map((path) => {
                  const displayName = getDisplayName(path);
                  const icon = getNoteIcon(path);
                  const isActive = currentNote?.path === path;
                  
                  return (
                    <button
                      key={path}
                      onClick={() => openNote(path)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1 rounded-md text-[13px] transition-colors",
                        isActive 
                          ? "bg-[var(--neko-accent-light)] text-[var(--neko-accent)]" 
                          : "text-[var(--neko-text-secondary)] hover:bg-[var(--neko-hover)]"
                      )}
                    >
                      <span className="flex-shrink-0 text-base">
                        {icon || '📄'}
                      </span>
                      <span className="truncate">{displayName}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceSection({ 
  rootFolder, 
  isLoading, 
  currentNotePath,
  onCreateNote,
  onCreateFolder
}: { 
  rootFolder: FolderNode | null;
  isLoading: boolean;
  currentNotePath?: string;
  onCreateNote: () => void;
  onCreateFolder: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  
  const handleHeaderClick = (e: React.MouseEvent) => {
    // 只有点击非按钮区域才切换展开状态
    const target = e.target as HTMLElement;
    if (!target.closest('button')) {
      setExpanded(!expanded);
    }
  };
  
  return (
    <div>
      {/* Header */}
      <div className="px-2 py-1">
        <div 
          onClick={handleHeaderClick}
          className="group flex items-center justify-between px-2 py-1 rounded-md hover:bg-[var(--neko-hover)] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-[var(--neko-text-tertiary)] uppercase tracking-wider">
              Workspace
            </span>
            <IconTriangleFilled 
              className={cn(
                "w-1.5 h-1.5 text-[#CDCDCD] transition-transform",
                expanded ? "rotate-180" : "rotate-90"
              )} 
            />
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <IconButton
              icon={<IconPlus className="w-3.5 h-3.5" />}
              tooltip="New Doc"
              onClick={() => {
                if (!expanded) setExpanded(true);
                onCreateNote();
              }}
            />
            <IconButton
              icon={<IconFolder className="w-3.5 h-3.5" />}
              tooltip="New Folder"
              onClick={() => {
                const name = prompt('Folder name:');
                if (name?.trim()) {
                  if (!expanded) setExpanded(true);
                  onCreateFolder(name.trim());
                }
              }}
            />
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div 
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-1">
            <FileTree 
              rootFolder={rootFolder} 
              isLoading={isLoading}
              currentNotePath={currentNotePath}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onCreateNote, onOpenSearch }: { onCreateNote: () => void; onOpenSearch: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md px-8">
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

function AIPanelContent() {
  const [showAddMenu, setShowAddMenu] = useState(false);

  return (
    <aside 
      className="flex-shrink-0 border-l border-[var(--neko-border)] bg-[var(--neko-bg-primary)] flex flex-col"
      style={{ width: AI_PANEL_WIDTH }}
    >
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
        <p className="text-xs text-[var(--neko-text-tertiary)] mt-2 text-center">
          ⓘ AI outputs can be misleading or wrong
        </p>
      </div>
    </aside>
  );
}
