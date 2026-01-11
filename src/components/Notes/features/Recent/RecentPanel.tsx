/**
 * RecentPanel - Display recently opened notes
 * 
 * Obsidian-style recent files panel
 */

import { useState } from 'react';
import { Clock, ChevronRight, FileText } from 'lucide-react';
import { useNotesStore } from '@/stores/useNotesStore';
import { cn } from '@/lib/utils';

interface RecentPanelProps {
  onNoteClick: (path: string) => void;
}

export function RecentPanel({ onNoteClick }: RecentPanelProps) {
  const { recentNotes } = useNotesStore();
  const [isExpanded, setIsExpanded] = useState(true);

  // Get note name from path
  const getNoteName = (path: string) => {
    return path.split('/').pop()?.replace('.md', '') || path;
  };

  // Get folder path from full path
  const getFolderPath = (path: string) => {
    const parts = path.split('/');
    if (parts.length > 1) {
      return parts.slice(0, -1).join('/');
    }
    return null;
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
        <Clock className="size-3.5" />
        Recent
        {recentNotes.length > 0 && (
          <span className="ml-auto text-zinc-400 dark:text-zinc-600 font-normal">
            {recentNotes.length}
          </span>
        )}
      </button>
      
      {isExpanded && (
        <div className="pb-2 max-h-48 overflow-auto">
          {recentNotes.length === 0 ? (
            <div className="px-3 py-3 text-center">
              <p className="text-xs text-zinc-400 dark:text-zinc-600">
                No recent notes
              </p>
              <p className="text-[10px] text-zinc-300 dark:text-zinc-700 mt-1">
                Open notes to see them here
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {recentNotes.map((path) => {
                const folderPath = getFolderPath(path);
                return (
                  <button
                    key={path}
                    onClick={() => onNoteClick(path)}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors group"
                  >
                    <FileText className="size-4 text-zinc-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate block">
                        {getNoteName(path)}
                      </span>
                      {folderPath && (
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-600 truncate block">
                          {folderPath}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
