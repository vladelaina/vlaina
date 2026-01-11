/**
 * TagsPanel - Display and manage tags across all notes
 * 
 * Obsidian-style tag pane with real tag scanning
 */

import { useEffect, useMemo, useState } from 'react';
import { Hash, ChevronRight, RefreshCw } from 'lucide-react';
import { useNotesStore } from '@/stores/useNotesStore';
import { cn } from '@/lib/utils';

interface TagsPanelProps {
  onTagClick: (tag: string) => void;
}

export function TagsPanel({ onTagClick }: TagsPanelProps) {
  const { getAllTags, scanAllNotes, noteContentsCache } = useNotesStore();
  const [isExpanded, setIsExpanded] = useState(true);

  // Scan notes on mount if cache is empty
  useEffect(() => {
    if (noteContentsCache.size === 0) {
      scanAllNotes();
    }
  }, [noteContentsCache.size, scanAllNotes]);

  // Get all tags
  const tagCounts = useMemo(() => {
    return getAllTags();
  }, [getAllTags, noteContentsCache]);

  // Group tags by first segment (for nested tags like #project/work)
  const groupedTags = useMemo(() => {
    const groups: Record<string, { tag: string; count: number }[]> = {};
    
    for (const tc of tagCounts) {
      const parts = tc.tag.split('/');
      const group = parts[0];
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(tc);
    }
    
    return groups;
  }, [tagCounts]);

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    scanAllNotes();
  };

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800">
      <div className="w-full px-3 py-2 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <ChevronRight 
            className={cn("size-3 transition-transform", isExpanded && "rotate-90")} 
          />
          <Hash className="size-3.5" />
          Tags
        </button>
        {tagCounts.length > 0 && (
          <span className="ml-auto text-zinc-400 dark:text-zinc-600 font-normal">
            {tagCounts.length}
          </span>
        )}
        <button
          onClick={handleRefresh}
          className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          title="Refresh tags"
        >
          <RefreshCw className="size-3" />
        </button>
      </div>
      
      {isExpanded && (
        <div className="pb-2 max-h-48 overflow-auto">
          {tagCounts.length === 0 ? (
            <div className="px-3 py-3 text-center">
              <p className="text-xs text-zinc-400 dark:text-zinc-600">
                No tags found
              </p>
              <p className="text-[10px] text-zinc-300 dark:text-zinc-700 mt-1">
                Add tags using #tagname
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {Object.entries(groupedTags).map(([group, tags]) => (
                <div key={group}>
                  {tags.length > 1 && tags[0].tag.includes('/') ? (
                    // Show group header for nested tags
                    <>
                      <div className="px-3 py-1 text-[10px] text-zinc-400 dark:text-zinc-600 uppercase">
                        {group}
                      </div>
                      {tags.map((tc) => (
                        <button
                          key={tc.tag}
                          onClick={() => onTagClick(tc.tag)}
                          className="w-full px-3 py-1 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <span className="text-sm text-purple-600 dark:text-purple-400 truncate">
                            #{tc.tag}
                          </span>
                          <span className="text-xs text-zinc-400 dark:text-zinc-600 ml-2 flex-shrink-0">
                            {tc.count}
                          </span>
                        </button>
                      ))}
                    </>
                  ) : (
                    // Show flat tags
                    tags.map((tc) => (
                      <button
                        key={tc.tag}
                        onClick={() => onTagClick(tc.tag)}
                        className="w-full px-3 py-1 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <span className="text-sm text-purple-600 dark:text-purple-400 truncate">
                          #{tc.tag}
                        </span>
                        <span className="text-xs text-zinc-400 dark:text-zinc-600 ml-2 flex-shrink-0">
                          {tc.count}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
