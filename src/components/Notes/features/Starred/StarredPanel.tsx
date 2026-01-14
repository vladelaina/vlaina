/**
 * StarredPanel - Display starred/bookmarked notes
 * 
 * Obsidian-style starred notes panel
 */

import { useState } from 'react';
import { Star, ChevronRight, FileText } from 'lucide-react';
import { useNotesStore } from '@/stores/useNotesStore';
import { cn } from '@/lib/utils';

interface StarredPanelProps {
  onNoteClick: (path: string) => void;
}

export function StarredPanel({ onNoteClick }: StarredPanelProps) {
  const { starredNotes, toggleStarred } = useNotesStore();
  const [isExpanded, setIsExpanded] = useState(true);

  // Get note name from path
  const getNoteName = (path: string) => {
    return path.split('/').pop()?.replace('.md', '') || path;
  };

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider hover:bg-zinc-50 dark:hover:bg-zinc-800"
      >
        <ChevronRight
          className={cn("size-3 transition-transform", isExpanded && "rotate-90")}
        />
        <Star className="size-3.5 text-yellow-500" fill="currentColor" />
        Starred
        {starredNotes.length > 0 && (
          <span className="ml-auto text-zinc-400 dark:text-zinc-600 font-normal">
            {starredNotes.length}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="pb-2 max-h-48 overflow-auto">
          {starredNotes.length === 0 ? (
            <div className="px-3 py-3 text-center">
              <p className="text-xs text-zinc-400 dark:text-zinc-600">
                No starred notes
              </p>
              <p className="text-[10px] text-zinc-300 dark:text-zinc-700 mt-1">
                Star notes to access them quickly
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {starredNotes.map((path) => (
                <div
                  key={path}
                  className="group flex items-center hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <button
                    onClick={() => onNoteClick(path)}
                    className="flex-1 px-3 py-1 flex items-center gap-2 text-left"
                  >
                    <FileText className="size-4 text-amber-500" />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                      {getNoteName(path)}
                    </span>
                  </button>
                  <button
                    onClick={() => toggleStarred(path)}
                    className="p-1 mr-2 opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-all"
                    title="Unstar"
                  >
                    <Star className="size-3.5 text-yellow-500" fill="currentColor" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
