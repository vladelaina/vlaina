import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GripVertical, Trash2, Clock, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMinutes } from '@/lib/markdown';
import { useTaskStore } from '@/stores/useTaskStore';
import type { Task } from '@/types';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onUpdate: (id: string, content: string) => void;
  onUpdateTime: (id: string, est?: number, act?: number) => void;
  onDelete: (id: string) => void;
}

export function TaskItem({ task, onToggle, onUpdate, onUpdateTime, onDelete }: TaskItemProps) {
  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const selectTask = useTaskStore((state) => state.selectTask);
  const isSelected = selectedTaskId === task.id;
  const itemRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(task.content);
  const [timeOpen, setTimeOpen] = useState(false);
  const [estInput, setEstInput] = useState(task.estimatedMinutes?.toString() || '');
  const [actInput, setActInput] = useState(task.actualMinutes?.toString() || '');
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
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

  useEffect(() => {
    setEstInput(task.estimatedMinutes?.toString() || '');
    setActInput(task.actualMinutes?.toString() || '');
  }, [task.estimatedMinutes, task.actualMinutes]);

  const handleBlur = () => {
    setIsEditing(false);
    if (content.trim() && content !== task.content) {
      onUpdate(task.id, content.trim());
    } else {
      setContent(task.content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
    if (e.key === 'Escape') {
      setContent(task.content);
      setIsEditing(false);
    }
  };

  const handleSaveTime = () => {
    const est = estInput ? parseInt(estInput, 10) : undefined;
    const act = actInput ? parseInt(actInput, 10) : undefined;
    onUpdateTime(task.id, est, act);
    setTimeOpen(false);
  };

  const hasTimeData = task.estimatedMinutes !== undefined || task.actualMinutes !== undefined;

  // Scroll into view when selected
  useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
    }
  }, [isSelected]);

  // Combined ref for both sortable and item selection
  const combinedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    (itemRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  return (
    <motion.div
      ref={combinedRef}
      style={style}
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ 
        opacity: isDragging ? 0.5 : 1, 
        y: 0,
        scale: isDragging ? 1.02 : 1,
        boxShadow: isDragging 
          ? '0 4px 12px rgba(0,0,0,0.1)' 
          : '0 0 0 rgba(0,0,0,0)',
      }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      transition={{ duration: 0.2 }}
      data-task-id={task.id}
      onClick={() => selectTask(task.id)}
      className={cn(
        'group flex items-center gap-2 px-2 py-2 rounded-md',
        'hover:bg-muted/50 transition-colors duration-150',
        'border transition-all duration-150',
        isDragging && 'bg-muted/80 border-border z-50',
        isSelected 
          ? 'border-primary/50 bg-primary/5 shadow-sm' 
          : 'border-transparent hover:border-border/50'
      )}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className={cn(
          'opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing',
          'p-0.5 rounded hover:bg-muted transition-opacity duration-150',
          'touch-none'
        )}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/60" />
      </button>

      {/* Checkbox */}
      <Checkbox
        checked={task.isDone}
        onCheckedChange={() => onToggle(task.id)}
        className="h-4 w-4 rounded-sm border-muted-foreground/40"
      />

      {/* Content */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={cn(
              'flex-1 bg-transparent border-none outline-none',
              'text-sm text-foreground placeholder:text-muted-foreground',
              'focus:ring-0'
            )}
          />
        ) : (
          <span
            data-editable
            onClick={() => !task.isDone && setIsEditing(true)}
            className={cn(
              'flex-1 text-sm cursor-text select-none truncate',
              task.isDone
                ? 'line-through text-muted-foreground/60'
                : 'text-foreground'
            )}
          >
            {task.content}
          </span>
        )}

        {/* Time Badges */}
        {hasTimeData && !isEditing && (
          <div className="flex items-center gap-1 shrink-0">
            {task.estimatedMinutes !== undefined && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
                <Timer className="h-3 w-3" />
                {formatMinutes(task.estimatedMinutes)}
              </span>
            )}
            {task.actualMinutes !== undefined && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary">
                <Clock className="h-3 w-3" />
                {formatMinutes(task.actualMinutes)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Time Popover */}
      <Popover open={timeOpen} onOpenChange={setTimeOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'opacity-0 group-hover:opacity-100',
              'p-1 rounded hover:bg-muted transition-opacity duration-150',
              hasTimeData && 'opacity-60'
            )}
            aria-label="Set time"
          >
            <Clock className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="end">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Estimated (minutes)
              </label>
              <Input
                type="number"
                placeholder="e.g., 30"
                value={estInput}
                onChange={(e) => setEstInput(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Actual (minutes)
              </label>
              <Input
                type="number"
                placeholder="e.g., 45"
                value={actInput}
                onChange={(e) => setActInput(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <Button onClick={handleSaveTime} size="sm" className="w-full">
              Save
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Delete Button */}
      <button
        onClick={() => onDelete(task.id)}
        className={cn(
          'opacity-0 group-hover:opacity-100',
          'p-1 rounded hover:bg-destructive/10 hover:text-destructive',
          'transition-opacity duration-150'
        )}
        aria-label="Delete task"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
