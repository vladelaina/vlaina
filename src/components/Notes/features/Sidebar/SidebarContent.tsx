import { Search } from 'lucide-react';
import { FavoritesSection } from './FavoritesSection';
import { GitHubSection } from './GitHubSection';
import { WorkspaceSection } from './WorkspaceSection';
import { cn } from '@/lib/utils';

interface SidebarContentProps {
    onSearchClick: () => void;
    rootFolder: any; // Using exact types would be better but keeping it flexible for now matching useNotesStore
    isLoading: boolean;
    currentNote?: { path: string } | null;
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
            <div className="flex-1 overflow-auto neko-scrollbar px-2 pt-2">
                <div className="pb-2">
                    <button
                        onClick={onSearchClick}
                        className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-[6px] mx-0",
                            "text-[var(--neko-text-tertiary)] hover:text-[var(--neko-text-primary)]",
                            "bg-transparent hover:bg-transparent",
                            "transition-colors duration-200 ease-out",
                            "group"
                        )}
                    >
                        <Search className="w-4 h-4 text-inherit transition-colors" />
                        <span className="flex-1 text-left text-[13px] font-medium tracking-wide">Search</span>
                        <span className="text-[10px] uppercase font-bold text-[var(--neko-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity">
                            Ctrl+K
                        </span>
                    </button>
                </div>

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
