
import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, Star } from 'lucide-react';
import { useNotesStore, type FileTreeNode } from '@/stores/useNotesStore';
import { FileTreeItem } from '../FileTree/FileTreeItem'; // Adjusted path
import { cn } from '@/lib/utils';

export function FavoritesSection() {
    const {
        starredNotes,
        starredFolders,
        rootFolder,
        currentNote,
    } = useNotesStore();

    const hasFavorites = starredNotes.length > 0 || starredFolders.length > 0;
    const [expanded, setExpanded] = useState(hasFavorites);

    // Auto-expand when favorites are added
    useEffect(() => {
        if (hasFavorites && !expanded) {
            setExpanded(true);
        }
    }, [hasFavorites, expanded]);

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

    return (
        <div className="mb-2">
            {/* Header */}
            <div className="px-2 py-1">
                <div
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center justify-between px-2 py-1 rounded-md hover:bg-[var(--neko-hover)] transition-colors cursor-pointer"
                >
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-[var(--neko-text-tertiary)] uppercase tracking-wider">
                            Favorites
                        </span>
                        <ChevronDown
                            className={cn(
                                "w-3 h-3 text-[#CDCDCD] transition-transform",
                                expanded ? "" : "-rotate-90"
                            )}
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div
                className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out",
                    expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
            >
                <div className="overflow-hidden">
                    <div className="px-1">
                        {!hasFavorites ? (
                            <div className="flex flex-col items-center gap-3 py-8">
                                <div className="w-14 h-14 rounded-full bg-[var(--neko-bg-tertiary)] flex items-center justify-center">
                                    <Star className="w-6 h-6 text-[var(--neko-text-tertiary)]" />
                                </div>
                                <span className="text-[15px] text-[var(--neko-text-tertiary)]">No favorites</span>
                            </div>
                        ) : (
                            <div>
                                {/* Starred Folders */}
                                {starredFolderNodes.map((node) => (
                                    <FileTreeItem
                                        key={`folder-${node.path}`}
                                        node={node}
                                        depth={0}
                                        currentNotePath={currentNote?.path}
                                    />
                                ))}

                                {/* Starred Notes */}
                                {starredNoteNodes.map((node) => (
                                    <FileTreeItem
                                        key={`note-${node.path}`}
                                        node={node}
                                        depth={0}
                                        currentNotePath={currentNote?.path}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
