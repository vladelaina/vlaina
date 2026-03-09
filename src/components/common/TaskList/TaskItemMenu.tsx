import { useRef, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import { useGroupStore } from '@/stores/useGroupStore';
import { ColorPicker } from '@/components/common/ColorPicker';
import type { NekoEvent } from '@/stores/useGroupStore';
import type { ItemColor } from '@/lib/colors';
import { collectUniqueTags, normalizeTag, normalizeTags } from '@/lib/tags/tagUtils';

interface TaskItemMenuProps {
    task: NekoEvent;
    canAddSubTask: boolean;
    onAddSubTask?: (parentId: string) => void;
    onDelete: (uid: string) => void;
    onPreviewColor?: (color: ItemColor | null) => void;
}

export function TaskItemMenu({
    task,
    canAddSubTask,
    onAddSubTask,
    onDelete,
    onPreviewColor,
}: TaskItemMenuProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);

    const { tasks, updateTaskColor, updateTaskTags } = useGroupStore();
    const currentTags = useMemo(() => normalizeTags(task.tags), [task.tags]);
    const suggestedTags = useMemo(
        () => collectUniqueTags(tasks)
            .filter(tag => !currentTags.some(item => item.toLocaleLowerCase() === tag.toLocaleLowerCase()))
            .slice(0, 8),
        [tasks, currentTags]
    );

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
                onPreviewColor?.(null);
            }
        };
        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMenu, onPreviewColor]);

    useEffect(() => {
        if (!showMenu) {
            setTagInput('');
            onPreviewColor?.(null);
        }
    }, [showMenu, onPreviewColor]);

    const addTag = () => {
        const normalized = normalizeTag(tagInput);
        if (!normalized) return;
        void updateTaskTags(task.uid, normalizeTags([...currentTags, normalized]));
        setTagInput('');
    };

    const removeTag = (targetTag: string) => {
        const nextTags = currentTags.filter(tag => tag.toLocaleLowerCase() !== targetTag.toLocaleLowerCase());
        void updateTaskTags(task.uid, nextTags);
    };

    return (
        <div className="relative flex-shrink-0 -mr-2" ref={menuRef}>
            <button
                onClick={() => setShowMenu(!showMenu)}
                className={cn(
                    'p-1.5 rounded-md transition-colors mt-0.5',
                    showMenu
                        ? 'opacity-100 text-[var(--neko-text-primary)]'
                        : cn('opacity-0 group-hover:opacity-100', iconButtonStyles)
                )}
            >
                <Icon size="md" name="common.more" />
            </button>

            {showMenu && (
                <div
                    className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 z-50"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-2">
                        <ColorPicker
                            value={task.color}
                            onHover={onPreviewColor}
                            onChange={(color) => {
                                updateTaskColor(task.uid, color);
                                setShowMenu(false);
                                onPreviewColor?.(null);
                            }}
                        />
                    </div>
                    <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />

                    <div className="px-3 py-2">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">Tags</div>
                        <div className="flex items-center gap-2">
                            <input
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addTag();
                                    }
                                }}
                                placeholder="Add tag..."
                                className="flex-1 px-2 py-1 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500"
                            />
                            <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={addTag}
                                className="px-2 py-1 text-xs rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                            >
                                Add
                            </button>
                        </div>

                        {currentTags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {currentTags.map(tag => (
                                    <button
                                        key={`menu-tag-${task.uid}-${tag}`}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => removeTag(tag)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                    >
                                        <span>#{tag}</span>
                                        <Icon size="xs" name="common.close" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {suggestedTags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {suggestedTags.map(tag => (
                                    <button
                                        key={`menu-suggested-tag-${task.uid}-${tag}`}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => void updateTaskTags(task.uid, normalizeTags([...currentTags, tag]))}
                                        className="px-2 py-0.5 rounded-md text-xs border border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600"
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        )}
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
