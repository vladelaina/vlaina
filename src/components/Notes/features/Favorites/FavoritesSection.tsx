import { useState, useEffect } from 'react';
import { MdStar } from 'react-icons/md';
import { useNotesStore, type FileTreeNode } from '@/stores/useNotesStore';
import { findNode } from '@/stores/notes/fileTreeUtils';
import { FileTreeItem } from '../FileTree/FileTreeItem';
import { CollapsibleSection } from '@/components/ui/collapsible-section';

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
        <CollapsibleSection
            title="Favorites"
            expanded={expanded}
            onToggle={() => setExpanded(!expanded)}
            className="mb-2"
        >
            {showEmptyState ? (
                <div className="flex flex-col items-center gap-2 py-4">
                    <div className="w-10 h-10 rounded-full bg-[var(--neko-bg-tertiary)] flex items-center justify-center">
                        <MdStar className="w-[18px] h-[18px] text-[var(--neko-text-tertiary)]" />
                    </div>
                    <span className="text-[13px] text-[var(--neko-text-tertiary)]">No favorites</span>
                </div>
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
        </CollapsibleSection>
    );
}