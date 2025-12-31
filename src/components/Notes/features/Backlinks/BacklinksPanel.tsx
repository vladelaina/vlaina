/**
 * BacklinksPanel - Shows notes that link to the current note
 * 
 * Modern block-editor style backlinks panel
 */

import { useEffect, useMemo } from 'react';
import { IconCornerUpLeft, IconFileText, IconRefresh } from '@tabler/icons-react';
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
    <div className="border-t border-[var(--neko-border)]">
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-medium text-[var(--neko-text-tertiary)] uppercase tracking-wider">
          <IconCornerUpLeft className="w-3.5 h-3.5" />
          Backlinks
          {backlinks.length > 0 && (
            <span className="text-[var(--neko-text-disabled)] font-normal normal-case">
              ({backlinks.length})
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          className="p-1 rounded hover:bg-[var(--neko-hover)] text-[var(--neko-icon-secondary)] hover:text-[var(--neko-icon-primary)]"
          title="Refresh backlinks"
        >
          <IconRefresh className="w-3.5 h-3.5" />
        </button>
      </div>
      
      {backlinks.length === 0 ? (
        <div className="px-3 py-4 text-center">
          <p className="text-xs text-[var(--neko-text-tertiary)]">
            No backlinks found
          </p>
          <p className="text-[10px] text-[var(--neko-text-disabled)] mt-1">
            Link to this note using [[{currentNoteName}]]
          </p>
        </div>
      ) : (
        <div className="py-1">
          {backlinks.map((link) => (
            <button
              key={link.path}
              onClick={() => onNavigate(link.path)}
              className="w-full px-3 py-2 text-left hover:bg-[var(--neko-hover)] transition-colors"
            >
              <div className="flex items-center gap-2">
                <IconFileText className="w-4 h-4 text-[var(--neko-icon-secondary)]" />
                <span className="text-sm text-[var(--neko-text-primary)] truncate">
                  {link.name}
                </span>
              </div>
              {link.context && (
                <p className="text-xs text-[var(--neko-text-tertiary)] mt-1 line-clamp-2 font-mono">
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
