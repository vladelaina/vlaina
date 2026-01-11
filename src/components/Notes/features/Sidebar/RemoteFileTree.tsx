/**
 * RemoteFileTree - Lazy-loading file tree for GitHub repositories
 * 
 * Uses the same visual style as local FileTreeItem for consistency.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, FileText, Folder, Loader2, Ellipsis, RefreshCw, ExternalLink } from 'lucide-react';
import { useGithubReposStore } from '@/stores/useGithubReposStore';
import { type TreeEntry } from '@/lib/tauri/invoke';
import { cn, iconButtonStyles, NOTES_COLORS } from '@/lib/utils';

interface RemoteFileTreeProps {
  repoId: number;
  owner: string;
  repo: string;
  path: string;
  depth: number;
}

const MAX_DEPTH = 10;

export function RemoteFileTree({ repoId, owner, repo, path, depth }: RemoteFileTreeProps) {
  const {
    getTreeEntries,
    loadDirectory,
    loadingPaths,
  } = useGithubReposStore();

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const cacheKey = `${repoId}:${path}`;
  const isLoading = loadingPaths.has(cacheKey);
  const entries = getTreeEntries(repoId, path);

  // Load directory on mount if not cached
  useEffect(() => {
    if (!entries && !isLoading) {
      loadDirectory(repoId, owner, repo, path);
    }
  }, [entries, isLoading, loadDirectory, repoId, owner, repo, path]);

  const toggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

  // Loading state - same style as local FileTree
  if (isLoading && !entries) {
    return (
      <div className="py-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2 px-2 h-[30px]" style={{ paddingLeft: 8 + depth * 16 }}>
            <div className="w-4 h-4 rounded bg-[var(--neko-bg-tertiary)] animate-pulse" />
            <div className="flex-1 h-4 rounded bg-[var(--neko-bg-tertiary)] animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (!entries || entries.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-[12px] text-[var(--neko-text-tertiary)]">
          Empty folder
        </p>
      </div>
    );
  }

  // Sort entries: folders first, then files, alphabetically
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.entryType === 'dir' && b.entryType !== 'dir') return -1;
    if (a.entryType !== 'dir' && b.entryType === 'dir') return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="py-1">
      {sortedEntries.map((entry) => (
        <RemoteFileTreeItem
          key={entry.path}
          entry={entry}
          repoId={repoId}
          owner={owner}
          repo={repo}
          depth={depth}
          isExpanded={expandedFolders.has(entry.path)}
          onToggle={() => toggleFolder(entry.path)}
        />
      ))}
    </div>
  );
}

interface RemoteFileTreeItemProps {
  entry: TreeEntry;
  repoId: number;
  owner: string;
  repo: string;
  depth: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function RemoteFileTreeItem({
  entry,
  repoId,
  owner,
  repo,
  depth,
  isExpanded,
  onToggle,
}: RemoteFileTreeItemProps) {
  const isFolder = entry.entryType === 'dir';
  const { currentRemoteFile, openRemoteFile, pendingChanges } = useGithubReposStore();
  
  const isActive = currentRemoteFile?.repoId === repoId && 
                   currentRemoteFile?.path === entry.path;
  
  const isPending = pendingChanges.get(repoId)?.has(entry.path) || false;
  const paddingLeft = 8 + depth * 16;

  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(() => {
    if (isFolder) {
      onToggle();
    } else {
      openRemoteFile(repoId, owner, repo, entry.path);
    }
  }, [isFolder, onToggle, openRemoteFile, repoId, owner, repo, entry.path]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.right - 160,
      });
    }
    setShowMenu(true);
  };

  const handleOpenInGitHub = () => {
    const url = `https://github.com/${owner}/${repo}/blob/main/${entry.path}`;
    window.open(url, '_blank');
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className="flex items-center h-[30px] cursor-pointer"
      >
        {/* Indent spacer */}
        <div style={{ width: paddingLeft }} className="flex-shrink-0" />
        
        {/* Content with background - same as FileTreeItem */}
        <div
          className={cn(
            "group flex-1 flex items-center gap-1 h-full pr-2 rounded-md transition-colors",
            "hover:bg-[var(--neko-hover)]"
          )}
          style={isActive ? { backgroundColor: NOTES_COLORS.activeItem } : undefined}
        >
          {/* Chevron for folders */}
          {isFolder ? (
            <span className="w-4 h-4 flex items-center justify-center">
              <ChevronRight 
                className={cn(
                  "w-3 h-3 text-[var(--neko-icon-secondary)] transition-transform duration-150",
                  isExpanded && "rotate-90"
                )} 
              />
            </span>
          ) : (
            <span className="w-4" />
          )}

          {/* Icon */}
          <span className="w-4 h-4 flex items-center justify-center">
            {isFolder ? (
              <Folder className="w-4 h-4 text-amber-500" />
            ) : (
              <FileText className="w-4 h-4 text-[var(--neko-icon-secondary)]" />
            )}
          </span>

          {/* Name */}
          <span className={cn(
            "flex-1 min-w-0 text-[13px] truncate text-[var(--neko-text-primary)]",
            isActive && "font-medium"
          )}>
            {entry.name}
          </span>

          {/* Pending indicator */}
          {isPending && (
            <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
          )}

          {/* Menu button */}
          <button
            ref={buttonRef}
            onClick={(e) => {
              e.stopPropagation();
              if (!showMenu && buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                setMenuPosition({
                  top: rect.bottom + 4,
                  left: rect.right - 160,
                });
              }
              setShowMenu(!showMenu);
            }}
            className={cn(
              "p-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
              iconButtonStyles
            )}
          >
            <Ellipsis className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Context menu */}
      {showMenu && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={() => setShowMenu(false)}
          />
          <div 
            ref={menuRef}
            style={{ top: menuPosition.top, left: menuPosition.left }}
            className={cn(
              "fixed z-[9999] min-w-[160px] py-1.5 rounded-lg shadow-lg",
              "bg-[var(--neko-bg-primary)] border border-[var(--neko-border)]"
            )}
          >
            <button
              onClick={handleOpenInGitHub}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] text-[var(--neko-text-primary)] hover:bg-[var(--neko-hover)] transition-colors"
            >
              <span className="w-4 h-4 flex items-center justify-center">
                <ExternalLink className="w-4 h-4" />
              </span>
              Open in GitHub
            </button>
          </div>
        </>,
        document.body
      )}

      {/* Nested tree for expanded folders */}
      {isFolder && isExpanded && depth < MAX_DEPTH && (
        <RemoteFileTree
          repoId={repoId}
          owner={owner}
          repo={repo}
          path={entry.path}
          depth={depth + 1}
        />
      )}
    </div>
  );
}
