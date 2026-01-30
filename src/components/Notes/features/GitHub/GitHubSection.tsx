/**
 * GitHubSection - Sidebar section for GitHub repositories
 * 
 * Displays user's nekotick-* repositories with sync status,
 * supports lazy loading file tree, and provides repository management.
 */

import { useEffect, useState } from 'react';
import { MdAdd, MdRefresh, MdInventory2 } from 'react-icons/md';
import { useGithubSyncStore } from '@/stores/useGithubSyncStore';
import { useGithubReposStore } from '@/stores/useGithubReposStore';
import { hasBackendCommands } from '@/lib/tauri/invoke';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { RepositoryItem } from './RepositoryItem';
import { NewRepositoryDialog } from './NewRepositoryDialog';
import { cn } from '@/lib/utils';

// GitHub icon component (Custom SVG as react-icons/md doesn't have the exact brand icon)
function GitHubIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="currentColor"
        >
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
    );
}

export function GitHubSection() {
    const { isConnected, isConnecting, connect, username } = useGithubSyncStore();
    const {
        repositories,
        isLoadingRepos,
        sectionExpanded,
        toggleSectionExpanded,
        loadRepositories,
        error,
        clearError,
    } = useGithubReposStore();

    const [showNewRepoDialog, setShowNewRepoDialog] = useState(false);

    // Auto-expand when connected
    useEffect(() => {
        if (isConnected && !sectionExpanded) {
            toggleSectionExpanded();
        }
    }, [isConnected]);

    // Load repositories when connected or username changes
    useEffect(() => {
        if (isConnected && hasBackendCommands()) {
            loadRepositories();
        }
    }, [isConnected, username, loadRepositories]);

    const handleConnect = async () => {
        await connect();
    };

    const hasRepos = repositories.length > 0;

    // Header actions (only when connected)
    const headerActions = isConnected ? (
        <>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    loadRepositories();
                }}
                disabled={isLoadingRepos}
                className="p-1 rounded hover:bg-[var(--neko-hover-filled)] text-[var(--neko-text-tertiary)] transition-colors disabled:opacity-50"
                title="Refresh"
            >
                <MdRefresh className={cn("w-[18px] h-[18px]", isLoadingRepos && "animate-spin")} />
            </button>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setShowNewRepoDialog(true);
                }}
                className="p-1 rounded hover:bg-[var(--neko-hover-filled)] text-[var(--neko-text-tertiary)] transition-colors"
                title="New Repository"
            >
                <MdAdd className="w-[18px] h-[18px]" />
            </button>
        </>
    ) : undefined;

    return (
        <>
            <CollapsibleSection
                title="GitHub"
                expanded={sectionExpanded}
                onToggle={toggleSectionExpanded}
                actions={headerActions}
                className="mb-2"
            >
                {!isConnected ? (
                    <div className="flex flex-col items-center py-3">
                        <button
                            onClick={handleConnect}
                            disabled={isConnecting || !hasBackendCommands()}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg",
                                "bg-[#24292e] hover:bg-[#2f363d] text-white text-[13px] font-medium",
                                "transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                        >
                            {isConnecting ? (
                                <MdRefresh className="w-[18px] h-[18px] animate-spin" />
                            ) : (
                                <GitHubIcon className="w-[18px] h-[18px]" />
                            )}
                            {isConnecting ? 'Connecting...' : 'Connect GitHub'}
                        </button>
                        {!hasBackendCommands() && (
                            <span className="text-[11px] text-[var(--neko-text-tertiary)] mt-2">
                                Desktop app required
                            </span>
                        )}
                    </div>
                ) : isLoadingRepos && !hasRepos ? (
                    <div className="flex items-center justify-center py-8">
                        <MdRefresh className="w-5 h-5 animate-spin text-[var(--neko-text-tertiary)]" />
                    </div>
                ) : !hasRepos ? (
                    <div className="flex flex-col items-center gap-3 py-8">
                        <div className="w-14 h-14 rounded-full bg-[var(--neko-bg-tertiary)] flex items-center justify-center">
                            <MdInventory2 className="w-6 h-6 text-[var(--neko-text-tertiary)]" />
                        </div>
                        <span className="text-[13px] text-[var(--neko-text-tertiary)]">
                            No repositories
                        </span>
                        <button
                            onClick={() => setShowNewRepoDialog(true)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md",
                                "bg-[var(--neko-bg-tertiary)] hover:bg-[var(--neko-hover-filled)]",
                                "text-[var(--neko-text-secondary)] text-[12px]",
                                "transition-colors"
                            )}
                        >
                            <MdAdd className="w-[18px] h-[18px]" />
                            New Repository
                        </button>
                    </div>
                ) : (
                    <div>
                        {repositories.map((repo) => (
                            <RepositoryItem key={repo.id} repository={repo} isRefreshing={isLoadingRepos} />
                        ))}
                    </div>
                )}

                {/* Error display */}
                {error && (
                    <div className="mx-2 mb-2 p-2 rounded-md bg-red-500/10 border border-red-500/20">
                        <p className="text-[12px] text-red-400">{error}</p>
                        <button
                            onClick={clearError}
                            className="text-[11px] text-red-400/70 hover:text-red-400 mt-1"
                        >
                            Dismiss
                        </button>
                    </div>
                )}
            </CollapsibleSection>

            <NewRepositoryDialog
                isOpen={showNewRepoDialog}
                onClose={() => setShowNewRepoDialog(false)}
            />
        </>
    );
}