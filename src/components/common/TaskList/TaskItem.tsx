/**
 * TaskItem - Reusable task item component
 * Migrated from Calendar/features/TaskPanel/PanelTaskItem.tsx
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSortable, defaultAnimateLayoutChanges, type AnimateLayoutChanges } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRight, ChevronDown, HeartPulse } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task } from '@/stores/useGroupStore';
import { useGroupStore, useUIStore } from '@/stores/useGroupStore';
import { formatDuration } from '@/lib/time';
import { getColorHex } from '@/lib/colors';
import { IconSelector } from '@/components/common/IconSelector';
import { TaskIcon } from '@/components/common/TaskIcon';
import { useIconPreview } from '@/components/common/UniversalIconPicker/useIconPreview';
import { useGlobalIconUpload } from '@/components/common/UniversalIconPicker/hooks/useGlobalIconUpload';
import { loadImageAsBlob } from '@/lib/assets/imageLoader';
import { loadSkinTone, getRandomEmoji } from '@/components/common/UniversalIconPicker/constants';
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
    onUpdateIcon?: (id: string, icon: string) => void;
    isBeingDragged?: boolean;
    isOverlay?: boolean;
    level?: number;
    hasChildren?: boolean;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
    // Feature flags
    draggable?: boolean;
    allowSubtasks?: boolean;
}

export function TaskItem({
    task,
    onToggle,
    onUpdate,
    onDelete,
    onAddSubTask,
    onUpdateIcon,
    isBeingDragged,
    isOverlay,
    level = 0,
    hasChildren = false,
    collapsed = false,
    onToggleCollapse,
    draggable = true,
    allowSubtasks = true,
}: TaskItemProps) {
    const MAX_LEVEL = 3;
    const canAddSubTask = allowSubtasks && level < MAX_LEVEL;
    const itemRef = useRef<HTMLDivElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [content, setContent] = useState(task.content);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { hideActualTime } = useUIStore();
    const groupStore = useGroupStore();
    const updateTaskIcon = onUpdateIcon || groupStore.updateTaskIcon;

    const { handlePreview } = useIconPreview(task.id);
    const { customIcons, onUploadFile, onDeleteCustomIcon } = useGlobalIconUpload();
    
    const imageLoader = useCallback(async (src: string) => {
        if (!src.startsWith('img:')) return src;
        return await loadImageAsBlob(src.substring(4));
    }, []);

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
        transition: isOverlay ? undefined : transition, // No transition for overlay to snap instantly
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
                    'group flex items-start gap-3 px-3 py-2 rounded-xl transition-all',
                    'border',
                    isOverlay
                        ? 'bg-white dark:bg-zinc-800 shadow-xl scale-[1.02] border-zinc-200 dark:border-zinc-700 cursor-grabbing z-50'
                        : isBeingDragged
                            ? 'opacity-0 border-transparent'
                            : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                )}
            >
                {/* Drag Zone (Left Side) */}
                <div 
                    {...attributes} 
                    {...(draggable ? listeners : {})}
                    className={cn(
                        "flex-shrink-0 mt-0.5 transition-colors",
                        "flex items-center justify-center h-6 w-6",
                        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-50"
                    )}
                >
                    {hasChildren ? (
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={onToggleCollapse}
                            className="p-0.5 transition-colors"
                        >
                            {collapsed ? (
                                <ChevronRight className="h-4 w-4 text-zinc-400" />
                            ) : (
                                <ChevronDown className="h-4 w-4 text-zinc-400" />
                            )}
                        </button>
                    ) : (
                        // Invisible hit area for pure drag
                        <div className="w-full h-full" />
                    )}
                </div>

                {/* Checkbox */}
                <div className="mt-0.5 flex-shrink-0">
                    <Checkbox
                        checked={task.completed}
                        onCheckedChange={() => onToggle(task.id)}
                        checkmarkColor={
                            task.completed 
                                ? (colorValue || '#a1a1aa') // Default to zinc-400 to match border/text style, preventing blue bg
                                : undefined
                        }
                        className={cn(
                            "h-5 w-5 rounded-[6px] transition-none", // 3.5 -> 5, rounded-sm -> rounded-[6px] (Apple style)
                            colorValue ? "border-2" : "border-2 border-zinc-300 dark:border-zinc-600" // Thicker border
                        )}
                        style={colorValue ? { borderColor: colorValue } : undefined}
                    />
                </div>

                {/* Icon Selector (Direct Access) */}
                <div className="mt-0.5 flex-shrink-0" onPointerDown={(e) => e.stopPropagation()}>
                    <IconSelector
                        value={task.icon}
                        onChange={(icon) => updateTaskIcon(task.id, icon)}
                        onHover={handlePreview}
                        compact
                        closeOnSelect={false}
                        hideColorPicker={true}
                        color={task.color}
                        customIcons={customIcons}
                        onUploadFile={onUploadFile}
                        onDeleteCustomIcon={onDeleteCustomIcon}
                        imageLoader={imageLoader}
                        trigger={
                            <button 
                                className="flex items-center justify-center p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors w-6 h-6"
                                title="Change icon"
                                onClick={() => {
                                    if (!task.icon) {
                                        const currentSkinTone = loadSkinTone();
                                        const randomEmoji = getRandomEmoji(currentSkinTone);
                                        updateTaskIcon(task.id, randomEmoji);
                                    }
                                }}
                            >
                                <TaskIcon
                                    itemId={task.id}
                                    icon={task.icon}
                                    color={colorValue}
                                    sizeClass="h-5 w-5"
                                    fallback={<HeartPulse className="h-4.5 w-4.5 text-zinc-400 opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity" />}
                                />
                            </button>
                        }
                    />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-[1px]"> {/* Optical alignment */}
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
                                'text-[15px] text-foreground placeholder:text-muted-foreground', // 13px -> 15px
                                'focus:ring-0 leading-relaxed min-h-[24px] max-h-[160px]'
                            )}
                        />
                    ) : (
                        <div
                            onClick={() => setIsEditing(true)}
                            className={cn(
                                'w-full text-[15px] cursor-text select-none whitespace-pre-wrap break-words', // 13px -> 15px
                                task.completed
                                    ? 'text-zinc-400 line-through'
                                    : 'text-zinc-900 dark:text-zinc-100 font-normal',
                                'leading-relaxed'
                            )}
                        >
                            {task.content}
                        </div>
                    )}

                    {/* Time info */}
                    {!hideActualTime && (task.estimatedMinutes || task.actualMinutes) && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400 dark:text-zinc-500 font-medium"> {/* 10px -> xs, mt-0.5 -> 1 */}
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
                        <div className="mt-1 text-xs text-zinc-400 dark:text-zinc-500 font-medium"> {/* 10px -> xs, mt-0.5 -> 1 */}
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


