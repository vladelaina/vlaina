/**
 * LinkSuggest - Auto-complete popup for [[wiki links]]
 * 
 * Shows when user types [[ and suggests matching notes
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { IconFileText, IconPlus } from '@tabler/icons-react';
import { useNotesStore, type FileTreeNode } from '@/stores/useNotesStore';
import { cn } from '@/lib/utils';

interface LinkSuggestProps {
  isOpen: boolean;
  query: string;
  position: { top: number; left: number };
  onSelect: (noteName: string) => void;
  onCreateNew: (noteName: string) => void;
  onClose: () => void;
}

export function LinkSuggest({ 
  isOpen, 
  query, 
  position, 
  onSelect, 
  onCreateNew,
  onClose 
}: LinkSuggestProps) {
  const { rootFolder } = useNotesStore();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get all note names from file tree
  const getAllNotes = useCallback((nodes: FileTreeNode[]): string[] => {
    const notes: string[] = [];
    for (const node of nodes) {
      if (node.isFolder) {
        notes.push(...getAllNotes(node.children));
      } else {
        notes.push(node.name);
      }
    }
    return notes;
  }, []);

  // Filter notes by query
  const suggestions = useCallback(() => {
    if (!rootFolder) return [];
    const allNotes = getAllNotes(rootFolder.children);
    const lowerQuery = query.toLowerCase();
    
    return allNotes
      .filter(name => name.toLowerCase().includes(lowerQuery))
      .sort((a, b) => {
        // Prioritize starts-with matches
        const aStarts = a.toLowerCase().startsWith(lowerQuery);
        const bStarts = b.toLowerCase().startsWith(lowerQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      })
      .slice(0, 8);
  }, [rootFolder, query, getAllNotes]);

  const filteredSuggestions = suggestions();
  const showCreateOption = query.trim() && !filteredSuggestions.some(
    s => s.toLowerCase() === query.toLowerCase()
  );

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const totalItems = filteredSuggestions.length + (showCreateOption ? 1 : 0);
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex(i => Math.min(i + 1, totalItems - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          e.stopPropagation();
          if (selectedIndex < filteredSuggestions.length) {
            onSelect(filteredSuggestions[selectedIndex]);
          } else if (showCreateOption) {
            onCreateNew(query.trim());
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, selectedIndex, filteredSuggestions, showCreateOption, query, onSelect, onCreateNew, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl overflow-hidden min-w-48 max-w-72"
      style={{ top: position.top, left: position.left }}
    >
      {filteredSuggestions.length === 0 && !showCreateOption ? (
        <div className="px-3 py-2 text-xs text-zinc-400">
          No matching notes
        </div>
      ) : (
        <div className="py-1 max-h-64 overflow-auto">
          {filteredSuggestions.map((name, index) => (
            <button
              key={name}
              onClick={() => onSelect(name)}
              className={cn(
                "w-full px-3 py-1.5 flex items-center gap-2 text-left text-sm",
                index === selectedIndex
                  ? "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              )}
            >
              <IconFileText className="size-4 text-zinc-400 flex-shrink-0" />
              <span className="truncate">{name}</span>
            </button>
          ))}
          
          {showCreateOption && (
            <button
              onClick={() => onCreateNew(query.trim())}
              className={cn(
                "w-full px-3 py-1.5 flex items-center gap-2 text-left text-sm border-t border-zinc-100 dark:border-zinc-800",
                selectedIndex === filteredSuggestions.length
                  ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              )}
            >
              <IconPlus className="size-4 text-green-500 flex-shrink-0" />
              <span>Create "{query.trim()}"</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
