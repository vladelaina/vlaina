import { useState, useCallback, useEffect } from 'react';
import { Star } from 'lucide-react';
import { useNotesStore, type FileTreeNode } from '@/stores/useNotesStore';
import { FileTreeItem } from '../FileTree/FileTreeItem';
import { CollapsibleSection } from './CollapsibleSection';

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

    // 当收藏加载完成且有收藏时，自动展开
    useEffect(() => {
        if (favoritesLoaded && hasFavoritePaths) {
            setExpanded(true);
        }
    }, [favoritesLoaded, hasFavoritePaths]);

    // Find node by path in file tree
    const findNode = useCallback((path: string): FileTreeNode | null => {
        if (!rootFolder) return null;

        const search = (nodes: FileTreeNode[]): FileTreeNode | null => {
            for (const node of nodes) {
                if (node.path === path) return node;
                if (node.isFolder) {
                    const found = search(node.children);
                    if (found) return found;
                }
            }
            return null;
        };

        return search(rootFolder.children);
    }, [rootFolder]);

    // Get nodes for starred items
    const starredFolderNodes = starredFolders
        .map(path => findNode(path))
        .filter((node): node is FileTreeNode => node !== null);

    const starredNoteNodes = starredNotes
        .map(path => findNode(path))
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
                        <Star className="w-4 h-4 text-[var(--neko-text-tertiary)]" />
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
