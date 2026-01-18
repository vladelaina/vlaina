/**
 * TaskItem - Reusable task item component
 * Migrated from Calendar/features/TaskPanel/PanelTaskItem.tsx
 */

import { useState, useRef, useEffect } from 'react';
import { useSortable, defaultAnimateLayoutChanges, type AnimateLayoutChanges } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox } from '@/components/ui/checkbox';
import { GripVertical, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task } from '@/stores/useGroupStore';
import { useUIStore } from '@/stores/useGroupStore';
import { formatDuration } from '@/lib/time';
import { getColorHex } from '@/lib/colors';
import { TaskIcon } from '@/components/common';
import { TaskItemMenu } from './TaskItemMenu';

const animateLayoutChanges: AnimateLayoutChanges = (args) => {
    const { isSorting, wasDragging } = args;
    if (isSorting || wasDragging) return false;
    return defaultAnimateLayoutChanges(args);
};

function formatMinutes(minutes: number): string {
    return formatDuration(minutes);
}

function formatScheduledTime(startDate: number, endDate?: number): string {
    const start = new Date(startDate);
    const month = (start.getMonth() + 1).toString().padStart(2, '0');
    const day = start.getDate().toString().padStart(2, '0');
    const startHour = start.getHours().toString().padStart(2, '0');
    const startMin = start.getMinutes().toString().padStart(2, '0');

    if (endDate) {
        const end = new Date(endDate);
        const endHour = end.getHours().toString().padStart(2, '0');
        const endMin = end.getMinutes().toString().padStart(2, '0');
        const durationMin = Math.round((endDate - startDate) / 60000);
        return `${startHour}:${startMin} - ${endHour}:${endMin} (${durationMin}m) · ${month}/${day}`;
    }
    return `${startHour}:${startMin} · ${month}/${day}`;
}

interface TaskItemProps {
    task: Task;
    onToggle: (id: string) => void;
    onUpdate: (id: string, content: string) => void;
    onDelete: (id: string) => void;
    onAddSubTask?: (parentId: string) => void;
    isBeingDragged?: boolean;
    level?: number;
    hasChildren?: boolean;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
}

export function TaskItem({
    task,
    onToggle,
    onUpdate,
    onDelete,
    onAddSubTask,
    isBeingDragged,
    level = 0,
    hasChildren = false,
    collapsed = false,
    onToggleCollapse,
}: TaskItemProps) {
    const MAX_LEVEL = 3;
    const canAddSubTask = level < MAX_LEVEL;
    const itemRef = useRef<HTMLDivElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [content, setContent] = useState(task.content);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { hideActualTime } = useUIStore();

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({
        id: task.id,
        animateLayoutChanges,
        data: { task },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            const length = inputRef.current.value.length;
            inputRef.current.setSelectionRange(length, length);
        }
    }, [isEditing]);

    useEffect(() => {
        setContent(task.content);
    }, [task.content]);

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
            textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
        }
    }, [isEditing, content]);

    const combinedRef = (node: HTMLDivElement | null) => {
        setNodeRef(node);
        (itemRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    };

    const colorValue = task.color && task.color !== 'default'
        ? getColorHex(task.color)
        : undefined;

    return (
        <>
            <div
                ref={combinedRef}
                style={style}
                data-task-id={task.id}
                className={cn(
                    'group flex items-start gap-1.5 px-1.5 py-1.5 rounded-md',
                    'border border-transparent',
                    isBeingDragged
                        ? 'opacity-0'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                )}
            >
                {/* Collapse/Expand icon */}
                {hasChildren ? (
                    <button
                        onClick={onToggleCollapse}
                        className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors flex-shrink-0"
                    >
                        {collapsed ? (
                            <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                        ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                        )}
                    </button>
                ) : (
                    <div className="w-4" />
                )}

                {/* Drag handle */}
                <button
                    {...attributes}
                    {...listeners}
                    className={cn(
                        'opacity-0 group-hover:opacity-100 cursor-move',
                        'p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-opacity duration-150',
                        'touch-none flex-shrink-0'
                    )}
                >
                    <GripVertical className="h-3.5 w-3.5 text-zinc-400" />
                </button>

                {/* Checkbox */}
                <div className="mt-0.5 flex-shrink-0">
                    <Checkbox
                        checked={task.completed}
                        onCheckedChange={() => onToggle(task.id)}
                        checkmarkColor={task.completed && colorValue ? colorValue : undefined}
                        className={cn(
                            "h-3.5 w-3.5 rounded-sm transition-none",
                            colorValue ? "border-2" : "border border-zinc-400/40"
                        )}
                        style={colorValue ? { borderColor: colorValue } : undefined}
                    />
                </div>

                {/* Icon */}
                <div className="mt-0.5">
                    <TaskIcon
                        itemId={task.id}
                        icon={task.icon}
                        color={colorValue}
                        sizeClass="h-3.5 w-3.5"
                        enablePreview={false}
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
                                'text-[13px] text-foreground placeholder:text-muted-foreground',
                                'focus:ring-0 leading-relaxed min-h-[18px] max-h-[120px]'
                            )}
                        />
                    ) : (
                        <div
                            onClick={() => setIsEditing(true)}
                            className={cn(
                                'w-full text-[13px] cursor-text select-none whitespace-pre-wrap break-words',
                                task.completed
                                    ? 'text-zinc-400 line-through'
                                    : 'text-zinc-700 dark:text-zinc-200',
                                'leading-relaxed'
                            )}
                        >
                            {task.content}
                        </div>
                    )}

                    {/* Time info */}
                    {!hideActualTime && (task.estimatedMinutes || task.actualMinutes) && (
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-600">
                            {task.estimatedMinutes && (
                                <span>Est. {formatMinutes(task.estimatedMinutes)}</span>
                            )}
                            {task.actualMinutes && (
                                <span>Act. {formatMinutes(task.actualMinutes)}</span>
                            )}
                        </div>
                    )}

                    {/* Scheduled time */}
                    {task.startDate && !task.isAllDay && (
                        <div className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                            {formatScheduledTime(task.startDate, task.endDate)}
                        </div>
                    )}
                </div>

                {/* More menu */}
                <TaskItemMenu
                    task={task}
                    canAddSubTask={canAddSubTask}
                    onAddSubTask={onAddSubTask}
                    onDelete={onDelete}
                />
            </div>
        </>
    );
}


