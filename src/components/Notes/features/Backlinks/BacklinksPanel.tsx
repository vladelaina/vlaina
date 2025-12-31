/**
 * BacklinksPanel - Shows notes that link to the current note
 * 
 * Obsidian-style backlinks panel with real link scanning
 */

import { useEffect, useMemo } from 'react';
import { ArrowUUpLeftIcon, FileTextIcon, ArrowsClockwiseIcon } from '@phosphor-icons/react';
import { useNotesStore } from '@/stores/useNotesStore';

interface BacklinksPanelProps {
  currentNotePath: string;
  onNavigate: (path: string) => void;
}

export function BacklinksPanel({ currentNotePath, onNavigate }: BacklinksPanelProps) {
  const { getBacklinks, scanAllNotes, noteContentsCache } = useNotesStore();
  
  // Scan notes on mount if cache is empty
  useEffect(() => {
    if (noteContentsCache.size === 0) {
      scanAllNotes();
    }
  }, [noteContentsCache.size, scanAllNotes]);

  // Get current note name (without extension and path)
  const currentNoteName = useMemo(() => {
    const fileName = currentNotePath.split('/').pop() || '';
    return fileName.replace('.md', '');
  }, [currentNotePath]);

  // Get backlinks
  const backlinks = useMemo(() => {
    return getBacklinks(currentNotePath);
  }, [getBacklinks, currentNotePath, noteContentsCache]);

  const handleRefresh = () => {
    scanAllNotes();
  };

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800">
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          <ArrowUUpLeftIcon className="size-3.5" weight="bold" />
          Backlinks
          {backlinks.length > 0 && (
            <span className="text-zinc-400 dark:text-zinc-600 font-normal normal-case">
              ({backlinks.length})
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          title="Refresh backlinks"
        >
          <ArrowsClockwiseIcon className="size-3.5" weight="bold" />
        </button>
      </div>
      
      {backlinks.length === 0 ? (
        <div className="px-3 py-4 text-center">
          <p className="text-xs text-zinc-400 dark:text-zinc-600">
            No backlinks found
          </p>
          <p className="text-[10px] text-zinc-300 dark:text-zinc-700 mt-1">
            Link to this note using [[{currentNoteName}]]
          </p>
        </div>
      ) : (
        <div className="py-1">
          {backlinks.map((link) => (
            <button
              key={link.path}
              onClick={() => onNavigate(link.path)}
              className="w-full px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileTextIcon className="size-4 text-zinc-400" weight="duotone" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                  {link.name}
                </span>
              </div>
              {link.context && (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 line-clamp-2 font-mono">
                  {link.context}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
