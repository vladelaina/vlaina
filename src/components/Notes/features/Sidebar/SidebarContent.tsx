import { Search } from 'lucide-react';
import { FavoritesSection } from './FavoritesSection';
import { GitHubSection } from './GitHubSection';
import { WorkspaceSection } from './WorkspaceSection';
import { cn } from '@/lib/utils';
import { Note } from '@/types/note';

interface SidebarContentProps {
    onSearchClick: () => void;
    rootFolder: any; // Using exact types would be better but keeping it flexible for now matching useNotesStore
    isLoading: boolean;
    currentNote?: Note | null;
    createNote: () => void;
    createFolder: (path: string) => void;
    className?: string;
}

export function SidebarContent({
    onSearchClick,
    rootFolder,
    isLoading,
    currentNote,
    createNote,
    createFolder,
    className
}: SidebarContentProps) {
    return (
        <div className={cn("flex flex-col h-full", className)}>
            <div className="px-2 pt-2 pb-2">
                <button
                    onClick={onSearchClick}
                    className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg",
                        "bg-[var(--neko-bg-tertiary)] hover:bg-[var(--neko-hover-filled)]",
                        "text-[var(--neko-text-secondary)] text-[13px]",
                        "transition-colors"
                    )}
                >
                    <Search className="w-4 h-4" />
                    <span className="flex-1 text-left">Search</span>
                </button>
            </div>

            <div className="flex-1 overflow-auto neko-scrollbar">
                {/* Favorites Section */}
                <FavoritesSection />

                {/* GitHub Section */}
                <GitHubSection />

                {/* Workspace Section */}
                <WorkspaceSection
                    rootFolder={rootFolder}
                    isLoading={isLoading}
                    currentNotePath={currentNote?.path}
                    onCreateNote={createNote}
                    onCreateFolder={() => createFolder('')}
                />
            </div>
        </div>
    );
}
