/**
 * LocalFileTree - File tree for locally cloned GitHub repositories
 * 
 * When a file is clicked, it switches the workspace to the repo's local path
 * and opens the file using the standard notes store logic.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MdChevronRight, MdExpandMore, MdDescription, MdFolder, MdFolderOpen, MdMoreHoriz, MdOpenInNew } from 'react-icons/md';
import { useGithubReposStore } from '@/stores/useGithubReposStore';
import { useNotesStore } from '@/stores/useNotesStore';
import { cn, iconButtonStyles, NOTES_COLORS } from '@/lib/utils';
import { readDir, type DirEntry } from '@tauri-apps/plugin-fs';

interface LocalFileTreeProps {
    repoId: number;
    owner: string;
    repo: string;
    depth: number;
    subPath?: string;
}

const MAX_DEPTH = 10;

export function LocalFileTree({ repoId, owner, repo, depth, subPath = '' }: LocalFileTreeProps) {
    const { getLocalPath, gitStatus } = useGithubReposStore();
    const [entries, setEntries] = useState<DirEntry[]>([]);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    const localPath = getLocalPath(repoId);
    const fullPath = subPath ? `${localPath}/${subPath}` : localPath;
    const repoGitStatus = gitStatus.get(repoId) || [];

    // Load directory contents - no loading state since local reads are instant
    useEffect(() => {
        if (!localPath) return;

        const loadEntries = async () => {
            try {
                const dirEntries = await readDir(fullPath || '');
                // Filter out .git folder and sort (folders first, then alphabetically)
                const filtered = dirEntries
                    .filter(e => e.name !== '.git')
                    .sort((a, b) => {
                        if (a.isDirectory && !b.isDirectory) return -1;
                        if (!a.isDirectory && b.isDirectory) return 1;
                        return a.name.localeCompare(b.name);
                    });
                setEntries(filtered);
            } catch (error) {
                console.error('Failed to read directory:', error);
                setEntries([]);
            }
        };

        loadEntries();
    }, [localPath, fullPath]);

    const toggleFolder = useCallback((folderName: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderName)) {
                next.delete(folderName);
            } else {
                next.add(folderName);
            }
            return next;
        });
    }, []);

    // Empty state (only show if we have a path but no entries)
    if (localPath && entries.length === 0) {
        return (
            <div className="px-3 py-4 text-center">
                <p className="text-[12px] text-[var(--neko-text-tertiary)]">
                    Empty folder
                </p>
            </div>
        );
    }

    return (
        <div>
            {entries.map((entry) => {
                const relativePath = subPath ? `${subPath}/${entry.name}` : entry.name;
                const fileStatus = repoGitStatus.find(s => s.path === relativePath);

                return (
                    <LocalFileTreeItem
                        key={entry.name}
                        entry={entry}
                        repoId={repoId}
                        owner={owner}
                        repo={repo}
                        localRepoPath={localPath || ''}
                        relativePath={relativePath}
                        depth={depth}
                        isExpanded={expandedFolders.has(entry.name)}
                        onToggle={() => toggleFolder(entry.name)}
                        gitStatus={fileStatus?.status}
                    />
                );
            })}
        </div>
    );
}

interface LocalFileTreeItemProps {
    entry: DirEntry;
    repoId: number;
    owner: string;
    repo: string;
    localRepoPath: string;
    relativePath: string;
    depth: number;
    isExpanded: boolean;
    onToggle: () => void;
    gitStatus?: string;
}

function LocalFileTreeItem({
    entry,
    repoId,
    owner,
    repo,
    localRepoPath,
    relativePath,
    depth,
    isExpanded,
    onToggle,
    gitStatus,
}: LocalFileTreeItemProps) {
    const isFolder = entry.isDirectory;
    const isMdFile = !isFolder && entry.name.endsWith('.md');

    // Get current note path from notes store to highlight active file
    const currentNotePath = useNotesStore(s => s.currentNote?.path);
    const openNoteByAbsolutePath = useNotesStore(s => s.openNoteByAbsolutePath);

    // Check if this file is currently active
    const fullFilePath = `${localRepoPath}/${relativePath}`.replace(/\\/g, '/');
    const isActive = currentNotePath === fullFilePath ||
        currentNotePath?.replace(/\\/g, '/') === fullFilePath;

    const paddingLeft = 8 + depth * 16;

    const [showMenu, setShowMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Get display name (remove .md extension for md files)
    const displayName = isMdFile ? entry.name.replace(/\.md$/, '') : entry.name;

    const handleClick = useCallback(async () => {
        if (isFolder) {
            onToggle();
        } else if (isMdFile) {
            // Open the file using absolute path - doesn't affect local workspace
            const absolutePath = `${localRepoPath}/${relativePath}`;
            await openNoteByAbsolutePath(absolutePath);
        }
    }, [isFolder, isMdFile, onToggle, localRepoPath, relativePath, openNoteByAbsolutePath]);

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
        const url = `https://github.com/${owner}/${repo}/blob/main/${relativePath}`;
        window.open(url, '_blank');
        setShowMenu(false);
    };

    // Get status indicator color
    const getStatusColor = () => {
        switch (gitStatus) {
            case 'new':
            case 'untracked':
                return 'text-green-500';
            case 'modified':
                return 'text-orange-500';
            case 'deleted':
                return 'text-red-500';
            default:
                return '';
        }
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
                    {/* Icon - folder shows chevron on hover */}
                    {isFolder ? (
                        <span className="w-[18px] h-[18px] flex items-center justify-center relative">
                            {/* Folder icon - hidden on hover */}
                            <span className="group-hover:hidden">
                                {isExpanded ? (
                                    <MdFolderOpen className="w-[18px] h-[18px] text-amber-500" />
                                ) : (
                                    <MdFolder className="w-[18px] h-[18px] text-amber-500" />
                                )}
                            </span>
                            {/* Chevron icon - shown on hover */}
                            <span className="hidden group-hover:block text-amber-500">
                                {isExpanded ? (
                                    <MdExpandMore className="w-[18px] h-[18px]" />
                                ) : (
                                    <MdChevronRight className="w-[18px] h-[18px]" />
                                )}
                            </span>
                        </span>
                    ) : (
                        <span className="w-[18px] h-[18px] flex items-center justify-center">
                            <MdDescription className={cn("w-[18px] h-[18px] text-amber-500", getStatusColor())} />
                        </span>
                    )}

                    {/* Name (without .md extension for md files) */}
                    <span className={cn(
                        "flex-1 min-w-0 text-[13px] truncate text-[var(--neko-text-primary)]",
                        isActive && "font-medium",
                        gitStatus && getStatusColor()
                    )}>
                        {displayName}
                    </span>

                    {/* Git status indicator */}
                    {gitStatus && (
                        <span className={cn("text-[10px] font-medium", getStatusColor())}>
                            {gitStatus === 'new' || gitStatus === 'untracked' ? 'U' :
                                gitStatus === 'modified' ? 'M' :
                                    gitStatus === 'deleted' ? 'D' : ''}
                        </span>
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
                        <MdMoreHoriz className="w-[18px] h-[18px]" />
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
                            <span className="w-[18px] h-[18px] flex items-center justify-center">
                                <MdOpenInNew className="w-[18px] h-[18px]" />
                            </span>
                            Open in GitHub
                        </button>
                    </div>
                </>,
                document.body
            )}

            {/* Nested tree for expanded folders */}
            {isFolder && isExpanded && depth < MAX_DEPTH && (
                <LocalFileTree
                    repoId={repoId}
                    owner={owner}
                    repo={repo}
                    depth={depth + 1}
                    subPath={relativePath}
                />
            )}
        </div>
    );
}
