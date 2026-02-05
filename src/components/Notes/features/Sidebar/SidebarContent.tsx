import { FavoritesSection } from '../Favorites';
import { GitHubSection } from '../GitHub';
import { WorkspaceSection } from '../FileTree';
import { cn } from '@/lib/utils';

interface SidebarContentProps {
    rootFolder: any;
    isLoading: boolean;
    currentNotePath?: string | null;
    createNote: () => void;
    createFolder: (path: string) => void;
    className?: string;
    isPeeking?: boolean;
}

export function SidebarContent({
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