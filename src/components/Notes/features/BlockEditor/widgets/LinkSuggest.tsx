/**
 * Link Suggest - Wiki-style link suggestions triggered by [[
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { IconFile, IconFilePlus } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

export interface LinkSuggestNote {
  id: string;
  title: string;
  path?: string;
}

interface LinkSuggestProps {
  isOpen: boolean;
  position: { x: number; y: number };
  searchText: string;
  notes: LinkSuggestNote[];
  onSelect: (note: LinkSuggestNote) => void;
  onCreate: (title: string) => void;
  onClose: () => void;
}

export function LinkSuggest({
  isOpen,
  position,
  searchText,
  notes,
  onSelect,
  onCreate,
  onClose,
}: LinkSuggestProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Filter notes by search text
  const filteredNotes = notes.filter((note) =>
    note.title.toLowerCase().includes(searchText.toLowerCase())
  );

  // Include "Create new" option
  const showCreateOption = searchText.length > 0;
  const totalItems = filteredNotes.length + (showCreateOption ? 1 : 0);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchText]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % totalItems);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex < filteredNotes.length) {
            onSelect(filteredNotes[selectedIndex]);
          } else if (showCreateOption) {
            onCreate(searchText);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredNotes, showCreateOption, searchText, onSelect, onCreate, onClose, totalItems]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="link-suggest-menu"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {filteredNotes.length === 0 && !showCreateOption && (
        <div className="link-suggest-empty">No notes found</div>
      )}

      {filteredNotes.map((note, index) => (
        <button
          key={note.id}
          className={cn('link-suggest-item', selectedIndex === index && 'selected')}
          onClick={() => onSelect(note)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <IconFile size={16} className="link-suggest-icon" />
          <span className="link-suggest-title">{note.title}</span>
          {note.path && <span className="link-suggest-path">{note.path}</span>}
        </button>
      ))}

      {showCreateOption && (
        <>
          {filteredNotes.length > 0 && <div className="link-suggest-divider" />}
          <button
            className={cn(
              'link-suggest-item create',
              selectedIndex === filteredNotes.length && 'selected'
            )}
            onClick={() => onCreate(searchText)}
            onMouseEnter={() => setSelectedIndex(filteredNotes.length)}
          >
            <IconFilePlus size={16} className="link-suggest-icon" />
            <span className="link-suggest-title">Create "{searchText}"</span>
          </button>
        </>
      )}
    </div>
  );
}
