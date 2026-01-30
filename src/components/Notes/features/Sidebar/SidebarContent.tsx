import { MdSearch } from 'react-icons/md';
import { FavoritesSection } from '../Favorites';
import { GitHubSection } from '../GitHub';
import { WorkspaceSection } from '../FileTree';
import { cn } from '@/lib/utils';

interface SidebarContentProps {
    onSearchClick: () => void;
    rootFolder: any; // Using exact types would be better but keeping it flexible for now matching useNotesStore
    isLoading: boolean;
    currentNotePath?: string | null;
    createNote: () => void;
    createFolder: (path: string) => void;
    className?: string;
    isPeeking?: boolean;
}

export function SidebarContent({
    onSearchClick,
    rootFolder,
    isLoading,
    currentNotePath,
    createNote,
    createFolder,
    className,
    isPeeking = false
}: SidebarContentProps) {
    return (
        <div className={cn("flex flex-col h-full", className)}>
            <div className={cn(
                "flex-1 overflow-auto neko-scrollbar px-2",
                isPeeking ? "pt-4 pb-4 neko-scrollbar-rounded" : "pt-2"
            )}>
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
                        <MdSearch className="w-[18px] h-[18px] text-inherit transition-colors" />
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
                    currentNotePath={currentNotePath ?? undefined}
                    onCreateNote={createNote}
                    onCreateFolder={() => createFolder('')}
                />
            </div>
        </div>
    );
}