/**
 * FullTextSearch - Search note contents
 * 
 * Obsidian-style full-text search with preview
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { MagnifyingGlassIcon, FileTextIcon, XIcon, SpinnerIcon } from '@phosphor-icons/react';
import { useNotesStore, type FileTreeNode } from '@/stores/useNotesStore';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { cn } from '@/lib/utils';

interface SearchMatch {
  path: string;
  name: string;
  line: number;
  context: string;
  matchStart: number;
  matchEnd: number;
}

interface FullTextSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onResultClick: (path: string) => void;
}

export function FullTextSearch({ isOpen, onClose, onResultClick }: FullTextSearchProps) {
  const { rootFolder, notesPath } = useNotesStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Get all note paths
  const getAllNotePaths = useCallback((nodes: FileTreeNode[]): { path: string; name: string }[] => {
    const paths: { path: string; name: string }[] = [];
    for (const node of nodes) {
      if (node.isFolder) {
        paths.push(...getAllNotePaths(node.children));
      } else {
        paths.push({ path: node.path, name: node.name });
      }
    }
    return paths;
  }, []);

  // Search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !rootFolder || !notesPath) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const matches: SearchMatch[] = [];
    const lowerQuery = searchQuery.toLowerCase();
    const notePaths = getAllNotePaths(rootFolder.children);

    try {
      for (const { path, name } of notePaths) {
        try {
          const fullPath = await join(notesPath, path);
          const content = await readTextFile(fullPath);
          const lines = content.split('\n');

          lines.forEach((line, lineIndex) => {
            const lowerLine = line.toLowerCase();
            let searchIndex = 0;
            let matchIndex;

            while ((matchIndex = lowerLine.indexOf(lowerQuery, searchIndex)) !== -1) {
              // Get context around match
              const contextStart = Math.max(0, matchIndex - 30);
              const contextEnd = Math.min(line.length, matchIndex + lowerQuery.length + 30);
              let context = line.substring(contextStart, contextEnd);
              
              if (contextStart > 0) context = '...' + context;
              if (contextEnd < line.length) context = context + '...';

              matches.push({
                path,
                name,
                line: lineIndex + 1,
                context,
                matchStart: matchIndex - contextStart + (contextStart > 0 ? 3 : 0),
                matchEnd: matchIndex - contextStart + lowerQuery.length + (contextStart > 0 ? 3 : 0),
              });

              searchIndex = matchIndex + 1;
              
              // Limit matches per file
              if (matches.filter(m => m.path === path).length >= 5) break;
            }
          });
        } catch {
          // Skip files that can't be read
        }

        // Limit total results
        if (matches.length >= 50) break;
      }
    } finally {
      setIsSearching(false);
    }

    setResults(matches);
    setSelectedIndex(0);
  }, [rootFolder, notesPath, getAllNotePaths]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    } else {
      setResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, performSearch]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          onResultClick(results[selectedIndex].path);
          onClose();
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  if (!isOpen) return null;

  // Group results by file
  const groupedResults: Record<string, SearchMatch[]> = {};
  for (const result of results) {
    if (!groupedResults[result.path]) {
      groupedResults[result.path] = [];
    }
    groupedResults[result.path].push(result);
  }

  let globalIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          {isSearching ? (
            <SpinnerIcon className="size-5 text-purple-500 animate-spin" />
          ) : (
            <MagnifyingGlassIcon className="size-5 text-zinc-400" weight="bold" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search in all notes..."
            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
              <XIcon className="size-4 text-zinc-400" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-auto">
          {results.length > 0 ? (
            <div className="py-2">
              {Object.entries(groupedResults).map(([path, matches]) => (
                <div key={path} className="mb-2">
                  {/* File header */}
                  <div className="px-4 py-1.5 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50">
                    <FileTextIcon className="size-3.5" weight="duotone" />
                    <span className="font-medium">{matches[0].name}</span>
                    <span className="text-zinc-400 dark:text-zinc-600">
                      {matches.length} match{matches.length > 1 ? 'es' : ''}
                    </span>
                  </div>
                  
                  {/* Matches */}
                  {matches.map((match, i) => {
                    const currentIndex = globalIndex++;
                    return (
                      <button
                        key={`${match.path}-${match.line}-${i}`}
                        onClick={() => {
                          onResultClick(match.path);
                          onClose();
                        }}
                        className={cn(
                          "w-full px-4 py-2 text-left transition-colors",
                          currentIndex === selectedIndex
                            ? "bg-purple-50 dark:bg-purple-900/30"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        )}
                      >
                        <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
                          <span>Line {match.line}</span>
                        </div>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 font-mono">
                          {match.context.substring(0, match.matchStart)}
                          <mark className="bg-yellow-200 dark:bg-yellow-900/50 text-yellow-900 dark:text-yellow-200 px-0.5 rounded">
                            {match.context.substring(match.matchStart, match.matchEnd)}
                          </mark>
                          {match.context.substring(match.matchEnd)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : query && !isSearching ? (
            <div className="py-12 text-center text-sm text-zinc-400">
              No results found for "{query}"
            </div>
          ) : !query ? (
            <div className="py-12 text-center">
              <p className="text-sm text-zinc-400">
                Search in all your notes
              </p>
              <p className="text-xs text-zinc-300 dark:text-zinc-600 mt-1">
                Results will appear as you type
              </p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400">
            {results.length} result{results.length > 1 ? 's' : ''} in {Object.keys(groupedResults).length} file{Object.keys(groupedResults).length > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
