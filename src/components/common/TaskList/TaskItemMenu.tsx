import { useRef, useEffect, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { useGroupStore } from '@/stores/useGroupStore';
import { parseDuration, formatDuration } from '@/lib/time';
import { ColorPicker } from '@/components/common/ColorPicker';
import type { NekoEvent } from '@/stores/useGroupStore';

function formatEstimatedTimeForInput(minutes: number | undefined): string {
    if (!minutes) return '';
    return formatDuration(minutes, { showDays: true });
}

interface TaskItemMenuProps {
    task: NekoEvent;
    canAddSubTask: boolean;
    onAddSubTask?: (parentId: string) => void;
    onDelete: (uid: string) => void;
}

export function TaskItemMenu({
    task,
    canAddSubTask,
    onAddSubTask,
    onDelete
}: TaskItemMenuProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [estimatedTime, setEstimatedTime] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);

    const { updateTaskColor, updateTaskEstimation } = useGroupStore();

    useEffect(() => {
        if (showMenu) {
            setEstimatedTime(formatEstimatedTimeForInput(task.estimatedMinutes));
        }
    }, [showMenu, task.estimatedMinutes]);

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

    return (
        <div className="relative flex-shrink-0" ref={menuRef}>
            <button
                onClick={() => setShowMenu(!showMenu)}
                className={cn(
                    'p-1 rounded transition-all',
                    showMenu
                        ? 'opacity-100 bg-zinc-100 dark:bg-zinc-800'
                        : 'opacity-0 group-hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                )}
            >
 <Icon size="md" name="common.more" className="text-zinc-400" />
            </button>

            {showMenu && (
                <div
                    className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 z-50"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-2">
                        <ColorPicker
                            value={task.color}
                            onChange={(color) => {
                                updateTaskColor(task.uid, color);
                                setShowMenu(false);
                            }}
                        />
                    </div>
                    <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />

                    <div className="px-3 py-2">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">Estimated Time</div>
                        <input
                            type="text"
                            value={estimatedTime}
                            onChange={(e) => setEstimatedTime(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (estimatedTime.trim()) {
                                        const newEstimation = parseDuration(estimatedTime.trim());
                                        if (newEstimation !== undefined) {
                                            updateTaskEstimation(task.uid, newEstimation);
                                            setShowMenu(false);
                                        } else {
                                            setEstimatedTime(formatEstimatedTimeForInput(task.estimatedMinutes));
                                        }
                                    } else {
                                        updateTaskEstimation(task.uid, undefined);
                                        setShowMenu(false);
                                    }
                                } else if (e.key === 'Escape') {
                                    setEstimatedTime(formatEstimatedTimeForInput(task.estimatedMinutes));
                                    setShowMenu(false);
                                }
                            }}
                            onBlur={() => {
                                const currentFormatted = formatEstimatedTimeForInput(task.estimatedMinutes);
                                if (estimatedTime.trim() !== currentFormatted) {
                                    if (estimatedTime.trim()) {
                                        const newEstimation = parseDuration(estimatedTime.trim());

                                        if (newEstimation !== undefined) {
                                            updateTaskEstimation(task.uid, newEstimation);
                                        } else {
                                            setEstimatedTime(currentFormatted);
                                        }
                                    } else {
                                        updateTaskEstimation(task.uid, undefined);
                                    }
                                }
                            }}
                            placeholder="e.g. 2d, 3h, 30m"
                            className="w-full px-2 py-1 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 text-zinc-900 dark:text-zinc-100"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />

                    <button
                        onClick={() => {
                            if (canAddSubTask && onAddSubTask) {
                                onAddSubTask(task.uid);
                                setShowMenu(false);
                            }
                        }}
                        disabled={!canAddSubTask}
                        className={cn(
                            "w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2",
                            canAddSubTask
                                ? "text-zinc-600 dark:text-zinc-300"
                                : "text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                        )}
                    >
 <Icon size="md" name="common.add" />
                        <span>Add Subtask</span>
                        {!canAddSubTask && <span className="ml-auto text-xs">(Max)</span>}
                    </button>
                    <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />

                    {task.completed && task.calendarId !== '__archive__' && (
                        <button
                            onClick={() => setShowMenu(false)}
                            className="w-full px-3 py-1.5 text-left text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
                        >
 <Icon size="md" name="file.archive" />
                            <span>Archive</span>
                        </button>
                    )}

                    <button
                        onClick={() => {
                            onDelete(task.uid);
                            setShowMenu(false);
                        }}
                        className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
                    >
 <Icon size="md" name="common.delete" />
                        <span>Delete</span>
                    </button>
                </div>
            )}
        </div>
    );
}