import { useState, useRef, useEffect } from 'react';
import { useSortable, defaultAnimateLayoutChanges, type AnimateLayoutChanges } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox } from '@/components/ui/checkbox';
import { GripVertical, MoreHorizontal, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task } from '@/types';

// Disable drop animation to prevent "snap back" effect
const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  const { isSorting, wasDragging } = args;
  if (isSorting || wasDragging) {
    return false;
  }
  return defaultAnimateLayoutChanges(args);
};

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onUpdate: (id: string, content: string) => void;
  onUpdateTime?: (id: string, est?: number, act?: number) => void;
  onDelete: (id: string) => void;
  isBeingDragged?: boolean;
  isDropTarget?: boolean;
  insertAfter?: boolean;
}

export function TaskItem({ task, onToggle, onUpdate, onDelete, isBeingDragged, isDropTarget, insertAfter }: TaskItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(task.content);
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useSortable({ 
    id: task.id,
    animateLayoutChanges,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: undefined, // Disable all dnd-kit transitions to prevent flicker
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setContent(task.content);
  }, [task.content]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleBlur = () => {
    setIsEditing(false);
    if (content.trim() && content !== task.content) {
      onUpdate(task.id, content.trim());
    } else {
      setContent(task.content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    } else if (e.key === 'Escape') {
      setContent(task.content);
      setIsEditing(false);
    }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      const textarea = inputRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [isEditing, content]);

  // Combined ref for both sortable and item selection
  const combinedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    (itemRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  // Drop target indicator
  const dropIndicator = isDropTarget && (
    <div className="h-10 rounded-md border-2 border-dashed border-zinc-300 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/50" />
  );

  return (
    <>
      {!insertAfter && dropIndicator}
      <div
        ref={combinedRef}
        style={{ ...style, transition: 'none' }}
        data-task-id={task.id}
        className={cn(
          'group flex items-start gap-2 px-2 py-2 rounded-md',
          'border border-transparent',
          isBeingDragged 
            ? 'h-0 overflow-hidden opacity-0 !p-0 !m-0' 
            : 'hover:bg-muted/50 hover:border-border/50'
        )}
      >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className={cn(
          'opacity-0 group-hover:opacity-100 cursor-move',
          'p-0.5 rounded hover:bg-muted transition-opacity duration-150',
          'touch-none'
        )}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/60" />
      </button>

      {/* Checkbox */}
      <div className="mt-0.5">
        <Checkbox
          checked={task.isDone}
          onCheckedChange={() => onToggle(task.id)}
          className="h-4 w-4 rounded-sm border-muted-foreground/40 transition-none"
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <textarea
            ref={inputRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            rows={1}
            className={cn(
              'w-full bg-transparent border-none outline-none resize-none',
              'text-sm text-foreground placeholder:text-muted-foreground',
              'focus:ring-0 leading-relaxed min-h-[20px] max-h-[200px]'
            )}
          />
        ) : (
          <div
            data-editable
            onClick={() => !task.isDone && setIsEditing(true)}
            className={cn(
              'w-full text-sm cursor-text select-none whitespace-pre-wrap break-all',
              task.isDone
                ? 'line-through text-muted-foreground/60'
                : 'text-foreground'
            )}
            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
          >
            {task.content}
          </div>
        )}
      </div>

      {/* More Options Button */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={cn(
            'opacity-0 group-hover:opacity-100',
            'p-1 rounded hover:bg-muted',
            'transition-opacity duration-150'
          )}
          aria-label="More options"
        >
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
        
        {/* Dropdown Menu */}
        {showMenu && (
          <div 
            className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                onDelete(task.id);
                setShowMenu(false);
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>
    </div>
    {insertAfter && dropIndicator}
    </>
  );
}
