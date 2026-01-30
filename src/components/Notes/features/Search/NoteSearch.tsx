/**
 * NoteSearch - Full-text search for notes
 * 
 * Modern block-editor style quick search
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MdDescription, MdClose, MdAccessTime } from 'react-icons/md';
import { useNotesStore } from '@/stores/useNotesStore';
import { cn } from '@/lib/utils';

interface SearchResult {
  path: string;
  name: string;
  preview: string;
  matchIndex: number;
}

interface NoteSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NoteSearch({ isOpen, onClose }: NoteSearchProps) {
  const { rootFolder, openNote, recentNotes } = useNotesStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Get recent notes as search results when no query
  const recentResults = useMemo(() => {
    if (query.trim() || !rootFolder) return [];

    const findNote = (path: string, children: typeof rootFolder.children): SearchResult | null => {
      for (const node of children) {
        if (node.isFolder) {
          const found = findNote(path, node.children);
          if (found) return found;
        } else if (node.path === path) {
          const parentPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
          return {
            path: node.path,
            name: node.name,
            preview: parentPath ? `${parentPath}/` : '',
            matchIndex: 0,
          };
        }
      }
      return null;
    };

    return recentNotes
      .map(path => findNote(path, rootFolder.children))
      .filter((r): r is SearchResult => r !== null)
      .slice(0, 5);
  }, [query, rootFolder, recentNotes]);

  // Search notes by name
  const searchNotes = useCallback((searchQuery: string) => {
    if (!searchQuery.trim() || !rootFolder) {
      setResults([]);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();
    const matches: SearchResult[] = [];

    const searchInFolder = (children: typeof rootFolder.children, parentPath: string = '') => {
      for (const node of children) {
        if (node.isFolder) {
          searchInFolder(node.children, node.path);
        } else {
          const lowerName = node.name.toLowerCase();
          const matchIndex = lowerName.indexOf(lowerQuery);
          if (matchIndex !== -1) {
            matches.push({
              path: node.path,
              name: node.name,
              preview: parentPath ? `${parentPath}/` : '',
              matchIndex,
            });
          }
        }
      }
    };

    searchInFolder(rootFolder.children);

    // Sort by match position (earlier matches first)
    matches.sort((a, b) => a.matchIndex - b.matchIndex);
    setResults(matches.slice(0, 10));
    setSelectedIndex(0);
  }, [rootFolder]);

  // Handle search input
  useEffect(() => {
    const timer = setTimeout(() => searchNotes(query), 100);
    return () => clearTimeout(timer);
  }, [query, searchNotes]);

  // Keyboard navigation
  const displayResults = query.trim() ? results : recentResults;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, displayResults.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (displayResults[selectedIndex]) {
          openNote(displayResults[selectedIndex].path);
          onClose();
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    openNote(result.path);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-transparent"
        onClick={onClose}
      />

      {/* Search Modal */}
      <div className="relative w-full max-w-lg bg-[var(--neko-bg-primary)] rounded-xl shadow-2xl border border-[var(--neko-border)] overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--neko-border)]">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search notes..."
            className="flex-1 bg-transparent text-[16px] text-[var(--neko-text-primary)] placeholder:text-[var(--neko-text-tertiary)] outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 hover:bg-[var(--neko-hover)] rounded">
              <MdClose className="w-[18px] h-[18px] text-[var(--neko-icon-secondary)]" />
            </button>
          )}
        </div>

        {/* Results */}
        {displayResults.length > 0 && (
          <div className="max-h-80 overflow-auto py-2 neko-scrollbar">
            {!query.trim() && recentResults.length > 0 && (
              <div className="px-4 py-1.5 text-[10px] font-medium text-[var(--neko-text-tertiary)] uppercase tracking-wider flex items-center gap-1.5">
                <MdAccessTime className="w-[18px] h-[18px]" />
                Recent
              </div>
            )}
            {displayResults.map((result, index) => (
              <button
                key={result.path}
                onClick={() => handleResultClick(result)}
                className={cn(
                  "w-full px-4 py-2 flex items-center gap-3 text-left transition-colors",
                  index === selectedIndex
                    ? "bg-[var(--neko-accent-light)]"
                    : "hover:bg-[var(--neko-hover)]"
                )}
              >
                <MdDescription className="w-[18px] h-[18px] text-amber-500 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-[14px] text-[var(--neko-text-primary)] truncate">
                    {result.name}
                  </div>
                  {result.preview && (
                    <div className="text-[12px] text-[var(--neko-text-tertiary)] truncate">
                      {result.preview}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {query && results.length === 0 && (
          <div className="py-8 text-center text-sm text-[var(--neko-text-tertiary)]">
            No notes found
          </div>
        )}

        {/* Hint */}
        {!query && recentResults.length === 0 && (
          <div className="py-6 text-center text-xs text-[var(--neko-text-tertiary)]">
            Type to search your notes
          </div>
        )}
      </div>
    </div>
  );
}