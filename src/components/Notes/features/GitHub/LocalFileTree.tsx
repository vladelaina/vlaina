import { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@/components/ui/icons';
import { useGithubReposStore } from '@/stores/useGithubReposStore';
import { useNotesStore } from '@/stores/useNotesStore';
import { cn, iconButtonStyles } from '@/lib/utils';
import { readDir, type DirEntry } from '@tauri-apps/plugin-fs';
import { CollapseTriangleIcon } from '../common/collapseTrianglePrimitive';
import { NotesSidebarContextMenu, NotesSidebarContextMenuItem } from '../Sidebar/NotesSidebarContextMenu';
import { NotesSidebarEmptyState, NotesSidebarList } from '../Sidebar/NotesSidebarPrimitives';
import { NotesSidebarRow } from '../Sidebar/NotesSidebarRow';

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

    if (localPath && entries.length === 0) {
        return (
            <NotesSidebarEmptyState title="Empty folder" className="py-4" />
        );
    }

    return (
        <NotesSidebarList>
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
        </NotesSidebarList>
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

    const currentNotePath = useNotesStore(s => s.currentNote?.path);
    const openNoteByAbsolutePath = useNotesStore(s => s.openNoteByAbsolutePath);

    const fullFilePath = `${localRepoPath}/${relativePath}`.replace(/\\/g, '/');
    const isActive = currentNotePath === fullFilePath ||
        currentNotePath?.replace(/\\/g, '/') === fullFilePath;

    const [showMenu, setShowMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);

    const displayName = isMdFile ? entry.name.replace(/\.md$/, '') : entry.name;

    const handleClick = useCallback(async () => {
        if (isFolder) {
            onToggle();
        } else if (isMdFile) {
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

    const getStatusColor = () => {
        switch (gitStatus) {
            case 'new':
            case 'untracked':
                return 'text-[var(--notes-sidebar-status-success)]';
            case 'modified':
                return 'text-[var(--notes-sidebar-status-warning)]';
            case 'deleted':
                return 'text-[var(--notes-sidebar-status-danger)]';
            default:
                return '';
        }
    };

    return (
        <div className="relative">
            <NotesSidebarRow
                depth={depth}
                onClick={() => void handleClick()}
                onContextMenu={handleContextMenu}
                isActive={isActive}
                leading={
                    isFolder ? (
                        <span className="relative flex size-[20px] items-center justify-center">
                            <Icon
                                size="md"
                                name={isExpanded ? 'file.folderOpen' : 'file.folder'}
                                className="text-[var(--notes-sidebar-folder-icon)] group-hover/sidebar-row:hidden"
                            />
                            <CollapseTriangleIcon
                                collapsed={!isExpanded}
                                size={16}
                                className="hidden text-[var(--notes-sidebar-folder-icon)] group-hover/sidebar-row:block"
                            />
                        </span>
                    ) : (
                        <Icon size="md" name="file.text" className={cn("text-[var(--notes-sidebar-file-icon)]", getStatusColor())} />
                    )
                }
                main={
                    <span className={cn("block truncate text-[13px]", gitStatus && getStatusColor(), isActive && "font-medium text-[var(--notes-sidebar-text)]")}>
                        {displayName}
                    </span>
                }
                trailing={gitStatus ? (
                    <span className={cn("text-[10px] font-medium", getStatusColor())}>
                        {gitStatus === 'new' || gitStatus === 'untracked' ? 'U' :
                            gitStatus === 'modified' ? 'M' :
                                gitStatus === 'deleted' ? 'D' : ''}
                    </span>
                ) : undefined}
                actions={
                    <button
                        ref={buttonRef}
                        type="button"
                        aria-label="Open file menu"
                        onClick={(event) => {
                            event.stopPropagation();
                            if (!showMenu && buttonRef.current) {
                                const rect = buttonRef.current.getBoundingClientRect();
                                setMenuPosition({
                                    top: rect.bottom + 4,
                                    left: rect.right - 180,
                                });
                            }
                            setShowMenu(!showMenu);
                        }}
                        className={cn(
                            'rounded-md p-1 focus:outline-none',
                            iconButtonStyles,
                            'text-[var(--notes-sidebar-icon)] hover:text-[var(--notes-sidebar-icon-hover)]'
                        )}
                    >
                        <Icon size="md" name="common.more" />
                    </button>
                }
            />

            <NotesSidebarContextMenu isOpen={showMenu} onClose={() => setShowMenu(false)} position={menuPosition}>
                <NotesSidebarContextMenuItem
                    icon={<Icon size="md" name="nav.external" />}
                    label="Open in GitHub"
                    onClick={handleOpenInGitHub}
                />
            </NotesSidebarContextMenu>

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
