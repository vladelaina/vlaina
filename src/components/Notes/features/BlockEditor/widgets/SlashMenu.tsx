/**
 * Slash Menu - Command palette triggered by typing '/'
 */

import { useEffect, useCallback, useMemo } from 'react';
import { useEditorContext } from '../EditorContext';
import { useEditorStore } from '../EditorStore';
import type { BlockType, SlashCommand } from '../types';
import { cn } from '@/lib/utils';
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  SquareCheck,
  Quote,
  Code,
  Minus,
  Info,
} from 'lucide-react';

// Command definitions
const SLASH_COMMANDS: Omit<SlashCommand, 'action'>[] = [
  // Basic
  { id: 'text', label: 'Text', icon: <Type size={18} />, category: 'basic', keywords: ['paragraph', 'plain'] },
  { id: 'h1', label: 'Heading 1', icon: <Heading1 size={18} />, category: 'basic', shortcut: '#', keywords: ['title', 'large'] },
  { id: 'h2', label: 'Heading 2', icon: <Heading2 size={18} />, category: 'basic', shortcut: '##', keywords: ['subtitle'] },
  { id: 'h3', label: 'Heading 3', icon: <Heading3 size={18} />, category: 'basic', shortcut: '###', keywords: ['section'] },
  { id: 'bullet', label: 'Bullet List', icon: <List size={18} />, category: 'basic', shortcut: '-', keywords: ['unordered', 'ul'] },
  { id: 'numbered', label: 'Numbered List', icon: <ListOrdered size={18} />, category: 'basic', shortcut: '1.', keywords: ['ordered', 'ol'] },
  { id: 'todo', label: 'To-do List', icon: <SquareCheck size={18} />, category: 'basic', shortcut: '[]', keywords: ['checkbox', 'task'] },
  { id: 'quote', label: 'Quote', icon: <Quote size={18} />, category: 'basic', shortcut: '>', keywords: ['blockquote'] },
  { id: 'divider', label: 'Divider', icon: <Minus size={18} />, category: 'basic', shortcut: '---', keywords: ['hr', 'line'] },
  { id: 'code', label: 'Code Block', icon: <Code size={18} />, category: 'basic', shortcut: '```', keywords: ['pre', 'snippet'] },
  // Advanced
  { id: 'callout', label: 'Callout', icon: <Info size={18} />, category: 'advanced', keywords: ['note', 'warning', 'tip'] },
];

const COMMAND_TO_BLOCK_TYPE: Record<string, BlockType> = {
  text: 'paragraph',
  h1: 'heading1',
  h2: 'heading2',
  h3: 'heading3',
  bullet: 'bulletList',
  numbered: 'numberedList',
  todo: 'todoList',
  quote: 'quote',
  divider: 'divider',
  code: 'codeBlock',
  callout: 'callout',
};

export function SlashMenu() {
  const { slashMenu, setSlashMenu, focusBlock } = useEditorContext();
  const { convertBlock, blocks } = useEditorStore();

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    const search = slashMenu.searchText.toLowerCase();
    if (!search) return SLASH_COMMANDS;

    return SLASH_COMMANDS.filter((cmd) => {
      const matchLabel = cmd.label.toLowerCase().includes(search);
      const matchShortcut = cmd.shortcut?.toLowerCase().includes(search);
      const matchKeywords = cmd.keywords?.some((k) => k.includes(search));
      return matchLabel || matchShortcut || matchKeywords;
    });
  }, [slashMenu.searchText]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, typeof filteredCommands> = {};
    for (const cmd of filteredCommands) {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    }
    return groups;
  }, [filteredCommands]);

  // Execute command
  const executeCommand = useCallback((commandId: string) => {
    const blockType = COMMAND_TO_BLOCK_TYPE[commandId];
    if (!blockType || !slashMenu.triggerBlockId) return;

    // Get the trigger block
    const triggerBlock = blocks.find(b => b.id === slashMenu.triggerBlockId);
    if (!triggerBlock) return;

    // Clear the slash command text from the block
    // For now, just convert the block type
    convertBlock(slashMenu.triggerBlockId, blockType);

    // Close menu
    setSlashMenu({
      isOpen: false,
      position: { x: 0, y: 0 },
      searchText: '',
      selectedIndex: 0,
      triggerBlockId: null,
    });

    // Focus the block
    setTimeout(() => {
      if (slashMenu.triggerBlockId) {
        focusBlock(slashMenu.triggerBlockId, 'start');
      }
    }, 0);
  }, [slashMenu.triggerBlockId, blocks, convertBlock, setSlashMenu, focusBlock]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!slashMenu.isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSlashMenu((prev) => ({
            ...prev,
            selectedIndex: Math.min(prev.selectedIndex + 1, filteredCommands.length - 1),
          }));
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSlashMenu((prev) => ({
            ...prev,
            selectedIndex: Math.max(prev.selectedIndex - 1, 0),
          }));
          break;

        case 'Enter':
          e.preventDefault();
          const selectedCmd = filteredCommands[slashMenu.selectedIndex];
          if (selectedCmd) {
            executeCommand(selectedCmd.id);
          }
          break;

        case 'Escape':
          e.preventDefault();
          setSlashMenu((prev) => ({ ...prev, isOpen: false }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slashMenu.isOpen, slashMenu.selectedIndex, filteredCommands, setSlashMenu, executeCommand]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.slash-menu')) {
        setSlashMenu((prev) => ({ ...prev, isOpen: false }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setSlashMenu]);

  if (filteredCommands.length === 0) {
    return (
      <div
        className="slash-menu"
        style={{
          left: slashMenu.position.x,
          top: slashMenu.position.y,
        }}
      >
        <div className="slash-menu-empty">No results</div>
      </div>
    );
  }

  let itemIndex = 0;

  return (
    <div
      className="slash-menu"
      style={{
        left: slashMenu.position.x,
        top: slashMenu.position.y,
      }}
    >
      {Object.entries(groupedCommands).map(([category, commands]) => (
        <div key={category} className="slash-menu-group">
          <div className="slash-menu-category">{category}</div>
          {commands.map((cmd) => {
            const currentIndex = itemIndex++;
            return (
              <button
                key={cmd.id}
                className={cn(
                  'slash-menu-item',
                  currentIndex === slashMenu.selectedIndex && 'selected'
                )}
                onClick={() => executeCommand(cmd.id)}
                onMouseEnter={() =>
                  setSlashMenu((prev) => ({ ...prev, selectedIndex: currentIndex }))
                }
              >
                <span className="slash-menu-icon">{cmd.icon}</span>
                <span className="slash-menu-label">{cmd.label}</span>
                {cmd.shortcut && (
                  <span className="slash-menu-shortcut">{cmd.shortcut}</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
