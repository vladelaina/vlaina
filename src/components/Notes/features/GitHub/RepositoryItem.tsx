import { useState, useRef, useCallback } from 'react';
import { Icon } from '@/components/ui/icons';
import { DeleteIcon } from '@/components/common/DeleteIcon';
import { useGithubReposStore } from '@/stores/useGithubReposStore';
import { type RepositoryInfo } from '@/lib/tauri/githubRepoCommands';
import { LocalFileTree } from './LocalFileTree';
import { cn, iconButtonStyles } from '@/lib/utils';
import { CollapseTriangleAffordance } from '../common/collapseTrianglePrimitive';
import { NotesSidebarContextMenu, NotesSidebarContextMenuDivider, NotesSidebarContextMenuItem } from '../Sidebar/NotesSidebarContextMenu';
import { NotesSidebarRow } from '../Sidebar/NotesSidebarRow';

interface RepositoryItemProps {
    repository: RepositoryInfo;
    isRefreshing?: boolean;
}

export function RepositoryItem({ repository, isRefreshing = false }: RepositoryItemProps) {
    const {
        expandedRepos,
        toggleRepoExpanded,
        syncStatus,
        cloningRepos,
        syncRepository,
        pullChanges,
        pushChanges,
        removeRepository,
        hasChanges,
        isCloned,
    } = useGithubReposStore();

    const [showMenu, setShowMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);

    const isExpanded = expandedRepos.has(repository.id);
    const status = syncStatus.get(repository.id) || 'not_cloned';
    const isCloning = cloningRepos.has(repository.id);
    const isSyncing = status === 'syncing' || isCloning;
    const repoIsCloned = isCloned(repository.id);
    const repoHasChanges = hasChanges(repository.id);

    const getCloudIcon = () => {
        const iconClass = "h-[18px] w-[18px] text-[var(--notes-sidebar-icon)]";

        if (isRefreshing || isSyncing) {
            return <Icon name="common.refresh" className={cn(iconClass, "animate-spin")} />;
        }

        if (!repoIsCloned) {
            return <Icon name="file.cloudOff" className={cn(iconClass, "text-[var(--notes-sidebar-text-soft)]")} />;
        }

        if (repoHasChanges) {
            return <Icon name="common.upload" className={cn(iconClass, "text-[var(--notes-sidebar-status-warning)]")} />;
        }

        switch (status) {
            case 'synced':
                return <Icon name="file.cloud" className={iconClass} />;
            case 'has_changes':
                return <Icon name="common.upload" className={cn(iconClass, "text-[var(--notes-sidebar-status-warning)]")} />;
            case 'error':
                return <Icon name="common.error" className={cn(iconClass, "text-[var(--notes-sidebar-status-danger)]")} />;
            default:
                return <Icon name="file.cloud" className={iconClass} />;
        }
    };

    const handleClick = useCallback(() => {
        toggleRepoExpanded(repository.id);
    }, [repository.id, toggleRepoExpanded]);

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

    const handleSyncNow = async () => {
        setShowMenu(false);
        await syncRepository(repository.id);
    };

    const handlePull = async () => {
        setShowMenu(false);
        await pullChanges(repository.id);
    };

    const handlePush = async () => {
        setShowMenu(false);
        await pushChanges(repository.id);
    };

    const handleOpenInGitHub = () => {
        window.open(repository.htmlUrl, '_blank');
        setShowMenu(false);
    };

    const handleRemove = () => {
        removeRepository(repository.id);
        setShowMenu(false);
    };

    return (
        <div className="relative">
            <NotesSidebarRow
                depth={0}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                leadingClassName="w-10"
                leading={
                    <div className="flex w-10 items-center gap-1">
                        <span className="flex size-[20px] items-center justify-center">
                            <CollapseTriangleAffordance
                                collapsed={!isExpanded}
                                visibility="always"
                                size={16}
                                className="h-[18px] w-[18px] text-[var(--notes-sidebar-icon)]"
                            />
                        </span>
                        <span className="flex size-[20px] items-center justify-center">
                            {getCloudIcon()}
                        </span>
                    </div>
                }
                main={
                    <span className="block truncate text-[13px] text-[var(--notes-sidebar-text)]">
                        {repository.displayName}
                    </span>
                }
                actions={
                    <button
                        ref={buttonRef}
                        type="button"
                        aria-label="Open repository menu"
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
                    icon={<Icon name="common.refresh" size="md" />}
                    label="Sync Now"
                    onClick={handleSyncNow}
                    disabled={isSyncing || !repoIsCloned}
                />
                <NotesSidebarContextMenuItem
                    icon={<Icon name="common.download" size="md" />}
                    label="Pull from Remote"
                    onClick={handlePull}
                    disabled={isSyncing || !repoIsCloned}
                />
                <NotesSidebarContextMenuItem
                    icon={<Icon name="common.upload" size="md" />}
                    label="Push to Remote"
                    onClick={handlePush}
                    disabled={isSyncing || !repoIsCloned || !repoHasChanges}
                />
                <NotesSidebarContextMenuDivider />
                <NotesSidebarContextMenuItem
                    icon={<Icon name="nav.external" size="md" />}
                    label="Open in GitHub"
                    onClick={handleOpenInGitHub}
                />
                <NotesSidebarContextMenuDivider />
                <NotesSidebarContextMenuItem
                    icon={<DeleteIcon />}
                    label="Remove from List"
                    onClick={handleRemove}
                    danger
                />
            </NotesSidebarContextMenu>

            {isExpanded && repoIsCloned && (
                <LocalFileTree
                    repoId={repository.id}
                    owner={repository.owner}
                    repo={repository.name}
                    depth={1}
                />
            )}

            {isExpanded && !repoIsCloned && isCloning && (
                <div className="flex items-center gap-2 px-4 py-3 text-[12px] text-[var(--notes-sidebar-text-soft)]">
 <Icon size="md" name="common.refresh" className="animate-spin text-[var(--notes-sidebar-icon)]" />
                    Cloning repository...
                </div>
            )}
        </div>
    );
}
