/**
 * RepositoryItem - Single repository item in the GitHub sidebar
 * 
 * Uses the same visual style as local FileTreeItem (folder) for consistency.
 * Repositories are cloned locally for offline support.
 */

import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    Ellipsis,
    RefreshCw,
    ExternalLink,
    Trash2,
    Upload,
    Download,
    Cloud,
    CloudUpload,
    CloudCog,
    CloudAlert,
    CloudOff,
} from 'lucide-react';
import { ToggleIcon } from '@/components/common/ToggleIcon';
import { useGithubReposStore } from '@/stores/useGithubReposStore';
import { type RepositoryInfo } from '@/lib/tauri/invoke';
import { LocalFileTree } from './LocalFileTree';
import { cn, iconButtonStyles } from '@/lib/utils';

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

    // Get cloud icon based on sync status (all amber-500 like folder icons)
    const getCloudIcon = () => {
        const iconClass = "w-4 h-4 text-amber-500";

        // Show sync icon when refreshing, cloning, or syncing
        if (isRefreshing || isSyncing) {
            return <CloudCog className={iconClass} />;
        }

        // Not cloned yet
        if (!repoIsCloned) {
            return <CloudOff className={iconClass} />;
        }

        // Has local changes to push
        if (repoHasChanges) {
            return <CloudUpload className={iconClass} />;
        }

        switch (status) {
            case 'synced':
                return <Cloud className={iconClass} />;
            case 'has_changes':
                return <CloudUpload className={iconClass} />;
            case 'error':
                return <CloudAlert className={iconClass} />;
            default:
                return <Cloud className={iconClass} />;
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
            {/* Repository header - same style as folder in FileTreeItem */}
            <div
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                className="flex items-center h-[30px] cursor-pointer"
            >
                {/* Indent spacer (depth 0) */}
                <div style={{ width: 8 }} className="flex-shrink-0" />

                {/* Content with background */}
                <div
                    className={cn(
                        "group flex-1 flex items-center gap-1 h-full pr-2 rounded-md transition-colors",
                        "hover:bg-[var(--neko-hover)]"
                    )}
                >
                    {/* Chevron */}
                    <span className="w-4 h-4 flex items-center justify-center">
                        <ToggleIcon
                            expanded={isExpanded}
                            size={14}
                            className="text-[var(--neko-icon-secondary)]"
                        />
                    </span>

                    {/* Cloud icon - shows sync status */}
                    <span className="w-4 h-4 flex items-center justify-center">
                        {getCloudIcon()}
                    </span>

                    {/* Repository name (without prefix) */}
                    <span className="flex-1 min-w-0 text-[13px] truncate text-[var(--neko-text-primary)]">
                        {repository.displayName}
                    </span>

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
                        style={{ top: menuPosition.top, left: menuPosition.left }}
                        className={cn(
                            "fixed z-[9999] min-w-[160px] py-1.5 rounded-lg shadow-lg",
                            "bg-[var(--neko-bg-primary)] border border-[var(--neko-border)]"
                        )}
                    >
                        <MenuItem
                            icon={<RefreshCw />}
                            label="Sync Now"
                            onClick={handleSyncNow}
                            disabled={isSyncing || !repoIsCloned}
                        />
                        <MenuItem
                            icon={<Download />}
                            label="Pull from Remote"
                            onClick={handlePull}
                            disabled={isSyncing || !repoIsCloned}
                        />
                        <MenuItem
                            icon={<Upload />}
                            label="Push to Remote"
                            onClick={handlePush}
                            disabled={isSyncing || !repoIsCloned || !repoHasChanges}
                        />
                        <div className="h-px bg-[var(--neko-divider)] my-1.5 mx-2" />
                        <MenuItem
                            icon={<ExternalLink />}
                            label="Open in GitHub"
                            onClick={handleOpenInGitHub}
                        />
                        <div className="h-px bg-[var(--neko-divider)] my-1.5 mx-2" />
                        <MenuItem
                            icon={<Trash2 />}
                            label="Remove from List"
                            onClick={handleRemove}
                            danger
                        />
                    </div>
                </>,
                document.body
            )}

            {/* Expanded file tree - reads from local clone */}
            {isExpanded && repoIsCloned && (
                <LocalFileTree
                    repoId={repository.id}
                    owner={repository.owner}
                    repo={repository.name}
                    depth={1}
                />
            )}

            {/* Cloning indicator */}
            {isExpanded && !repoIsCloned && isCloning && (
                <div className="flex items-center gap-2 px-4 py-3 text-[12px] text-[var(--neko-text-tertiary)]">
                    <CloudCog className="w-4 h-4 animate-pulse" />
                    Cloning repository...
                </div>
            )}
        </div>
    );
}

function MenuItem({
    icon,
    label,
    onClick,
    danger = false,
    disabled = false,
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors",
                danger
                    ? "text-red-500 hover:bg-red-500/10"
                    : "text-[var(--neko-text-primary)] hover:bg-[var(--neko-hover)]",
                disabled && "opacity-50 cursor-not-allowed hover:bg-transparent"
            )}
        >
            <span className="w-4 h-4 flex items-center justify-center">
                {icon}
            </span>
            {label}
        </button>
    );
}
