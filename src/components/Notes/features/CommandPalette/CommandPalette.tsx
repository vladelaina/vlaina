/**
 * CommandPalette - Obsidian-style command palette
 * 
 * Access all commands via Ctrl+Shift+P
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  CommandIcon, 
  FileTextIcon, 
  FolderPlusIcon, 
  MagnifyingGlassIcon, 
  FloppyDiskIcon,
  TrashIcon,
  PencilSimpleIcon,
  CalendarIcon,
  ListBulletsIcon,
  KeyboardIcon,
  GraphIcon,
  ArrowUUpLeftIcon
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export interface CommandItem {
  id: string;
  name: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string[];
  action: () => void;
  category: 'file' | 'edit' | 'view' | 'navigate';
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

export function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    
    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd => 
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.description?.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  if (!isOpen) return null;

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const cmd of filteredCommands) {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    }
    return groups;
  }, [filteredCommands]);

  const categoryLabels: Record<string, string> = {
    file: 'File',
    edit: 'Edit',
    view: 'View',
    navigate: 'Navigate',
  };

  let globalIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <CommandIcon className="size-5 text-purple-500" weight="bold" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none"
          />
        </div>

        {/* Commands List */}
        <div className="max-h-96 overflow-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-400">
              No commands found
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, cmds]) => (
              <div key={category}>
                <div className="px-4 py-1.5 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                  {categoryLabels[category] || category}
                </div>
                {cmds.map((cmd) => {
                  const currentIndex = globalIndex++;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        cmd.action();
                        onClose();
                      }}
                      className={cn(
                        "w-full px-4 py-2 flex items-center gap-3 text-left transition-colors",
                        currentIndex === selectedIndex
                          ? "bg-purple-50 dark:bg-purple-900/30"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      )}
                    >
                      <span className="text-zinc-400">{cmd.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-zinc-900 dark:text-zinc-100">
                          {cmd.name}
                        </div>
                        {cmd.description && (
                          <div className="text-xs text-zinc-400 truncate">
                            {cmd.description}
                          </div>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <div className="flex items-center gap-1">
                          {cmd.shortcut.map((key, i) => (
                            <span key={i}>
                              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-500">
                                {key}
                              </kbd>
                              {i < cmd.shortcut!.length - 1 && (
                                <span className="text-zinc-300 mx-0.5">+</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Default commands factory
export function createDefaultCommands(actions: {
  createNote: () => void;
  createFolder: () => void;
  saveNote: () => void;
  deleteNote: () => void;
  renameNote: () => void;
  openSearch: () => void;
  toggleOutline: () => void;
  toggleGraph: () => void;
  toggleBacklinks: () => void;
  showShortcuts: () => void;
  switchToCalendar: () => void;
}): CommandItem[] {
  return [
    {
      id: 'new-note',
      name: 'New Note',
      description: 'Create a new note',
      icon: <FileTextIcon className="size-4" weight="duotone" />,
      shortcut: ['Ctrl', 'N'],
      action: actions.createNote,
      category: 'file',
    },
    {
      id: 'new-folder',
      name: 'New Folder',
      description: 'Create a new folder',
      icon: <FolderPlusIcon className="size-4" weight="duotone" />,
      action: actions.createFolder,
      category: 'file',
    },
    {
      id: 'save-note',
      name: 'Save Note',
      description: 'Save current note',
      icon: <FloppyDiskIcon className="size-4" weight="duotone" />,
      shortcut: ['Ctrl', 'S'],
      action: actions.saveNote,
      category: 'file',
    },
    {
      id: 'delete-note',
      name: 'Delete Note',
      description: 'Delete current note',
      icon: <TrashIcon className="size-4" weight="duotone" />,
      action: actions.deleteNote,
      category: 'file',
    },
    {
      id: 'rename-note',
      name: 'Rename Note',
      description: 'Rename current note',
      icon: <PencilSimpleIcon className="size-4" weight="duotone" />,
      shortcut: ['F2'],
      action: actions.renameNote,
      category: 'file',
    },
    {
      id: 'quick-search',
      name: 'Quick Search',
      description: 'Search notes by name',
      icon: <MagnifyingGlassIcon className="size-4" weight="duotone" />,
      shortcut: ['Ctrl', 'P'],
      action: actions.openSearch,
      category: 'navigate',
    },
    {
      id: 'toggle-outline',
      name: 'Toggle Outline',
      description: 'Show/hide document outline',
      icon: <ListBulletsIcon className="size-4" weight="duotone" />,
      action: actions.toggleOutline,
      category: 'view',
    },
    {
      id: 'toggle-graph',
      name: 'Toggle Graph View',
      description: 'Show/hide note graph',
      icon: <GraphIcon className="size-4" weight="duotone" />,
      shortcut: ['Ctrl', 'G'],
      action: actions.toggleGraph,
      category: 'view',
    },
    {
      id: 'toggle-backlinks',
      name: 'Toggle Backlinks',
      description: 'Show/hide backlinks panel',
      icon: <ArrowUUpLeftIcon className="size-4" weight="duotone" />,
      action: actions.toggleBacklinks,
      category: 'view',
    },
    {
      id: 'show-shortcuts',
      name: 'Keyboard Shortcuts',
      description: 'Show all keyboard shortcuts',
      icon: <KeyboardIcon className="size-4" weight="duotone" />,
      shortcut: ['Ctrl', '/'],
      action: actions.showShortcuts,
      category: 'view',
    },
    {
      id: 'switch-calendar',
      name: 'Switch to Calendar',
      description: 'Go to calendar view',
      icon: <CalendarIcon className="size-4" weight="duotone" />,
      action: actions.switchToCalendar,
      category: 'navigate',
    },
  ];
}
