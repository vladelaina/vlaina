import { StarredSection } from '../Starred';
import { GitHubSection } from '../GitHub';
import { WorkspaceSection } from '../FileTree';
import { cn } from '@/lib/utils';
import { NotesSidebarScrollArea } from './NotesSidebarPrimitives';

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
            <NotesSidebarScrollArea className={cn(
                isPeeking ? "pt-4 pb-4 neko-scrollbar-rounded" : "pt-2"
            )}
            data-notes-sidebar-scroll-root="true"
            >
                <StarredSection />
                <GitHubSection />
                <WorkspaceSection
                    rootFolder={rootFolder}
                    isLoading={isLoading}
                    currentNotePath={currentNotePath ?? undefined}
                    onCreateNote={createNote}
                    onCreateFolder={() => createFolder('')}
                />
            </NotesSidebarScrollArea>
        </div>
    );
}
