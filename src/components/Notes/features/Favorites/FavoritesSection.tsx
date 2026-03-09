import { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/icons';
import { useNotesStore, type FileTreeNode } from '@/stores/useNotesStore';
import { findNode } from '@/stores/notes/fileTreeUtils';
import { FileTreeItem } from '../FileTree/FileTreeItem';
import { NotesSidebarEmptyState, NotesSidebarSection } from '../Sidebar/NotesSidebarPrimitives';

export function FavoritesSection() {
    const {
        starredNotes,
        starredFolders,
        rootFolder,
        currentNote,
        favoritesLoaded,
    } = useNotesStore();

    const hasFavoritePaths = starredNotes.length > 0 || starredFolders.length > 0;
    const [expanded, setExpanded] = useState(false);

    // Auto-expand when favorites are loaded and there are favorites
    useEffect(() => {
        if (favoritesLoaded && hasFavoritePaths) {
            setExpanded(true);
        }
    }, [favoritesLoaded, hasFavoritePaths]);

    // Get nodes for starred items
    const starredFolderNodes = starredFolders
        .map(path => rootFolder ? findNode(rootFolder.children, path) : null)
        .filter((node): node is FileTreeNode => node !== null);

    const starredNoteNodes = starredNotes
        .map(path => rootFolder ? findNode(rootFolder.children, path) : null)
        .filter((node): node is FileTreeNode => node !== null);

    const hasResolvedFavorites = starredFolderNodes.length > 0 || starredNoteNodes.length > 0;
    const showEmptyState = favoritesLoaded && !hasFavoritePaths;

    return (
        <NotesSidebarSection
            title="Favorites"
            expanded={expanded}
            onToggle={() => setExpanded(!expanded)}
        >
            {showEmptyState ? (
                <NotesSidebarEmptyState
                    icon={<Icon size="md" name="misc.star" className="text-[var(--notes-sidebar-icon)]" />}
                    title="No favorites"
                />
            ) : hasResolvedFavorites ? (
                <div>
                    {starredFolderNodes.map((node) => (
                        <FileTreeItem
                            key={`folder-${node.path}`}
                            node={node}
                            depth={0}
                            currentNotePath={currentNote?.path}
                        />
                    ))}
                    {starredNoteNodes.map((node) => (
                        <FileTreeItem
                            key={`note-${node.path}`}
                            node={node}
                            depth={0}
                            currentNotePath={currentNote?.path}
                        />
                    ))}
                </div>
            ) : null}
        </NotesSidebarSection>
    );
}
