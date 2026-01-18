import { motion, AnimatePresence } from 'framer-motion';
import { Ellipsis, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGroupStore, useUIStore } from '@/stores/useGroupStore';
import { ALL_COLORS, COLOR_HEX, RAINBOW_GRADIENT } from '@/lib/colors';
import { ALL_STATUSES } from '@/stores/uiSlice';
import type { TaskStatus } from '@/stores/uiSlice';
import { useState, useRef, useEffect } from 'react';

const statusLabels: Record<TaskStatus, string> = {
    todo: 'Todo',
    scheduled: 'Scheduled',
    completed: 'Done',
};

export function TaskFilterMenu() {
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const moreMenuRef = useRef<HTMLDivElement>(null);

    const { activeGroupId, deleteGroup, archiveCompletedTasks, deleteCompletedTasks } = useGroupStore();
    const {
        hideCompleted, setHideCompleted,
        hideActualTime, setHideActualTime,
        selectedColors, toggleColor, toggleAllColors,
        selectedStatuses, toggleStatus, toggleAllStatuses
    } = useUIStore();

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
                setShowMoreMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleArchiveCompleted = async () => {
        if (!activeGroupId || activeGroupId === '__archive__') return;
        try {
            await archiveCompletedTasks(activeGroupId);
            setShowMoreMenu(false);
        } catch (error) {
            console.error('Failed to archive:', error);
        }
    };

    const handleDeleteCompleted = () => {
        if (!activeGroupId || activeGroupId === '__archive__') return;
        deleteCompletedTasks(activeGroupId);
        setShowMoreMenu(false);
    };

    return (
        <div className="relative shrink-0" ref={moreMenuRef}>
            <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className={cn(
                    "p-1.5 rounded-md transition-colors mt-0.5",
                    showMoreMenu
                        ? "text-zinc-600 bg-zinc-100 dark:text-zinc-300 dark:bg-zinc-800"
                        : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                )}
            >
                <Ellipsis className="size-4" />
            </button>

            <AnimatePresence>
                {showMoreMenu && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 z-50"
                    >
                        {/* Color filter */}
                        <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
                            <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-2">Color Filter</div>
                            <div className="flex items-center gap-1.5">
                                {ALL_COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleColor(c);
                                        }}
                                        className={cn(
                                            "w-5 h-5 rounded-sm border-2 transition-all hover:scale-110",
                                            selectedColors.includes(c) && "ring-2 ring-zinc-400 dark:ring-zinc-500 ring-offset-1"
                                        )}
                                        style={{
                                            borderColor: COLOR_HEX[c],
                                            backgroundColor: c === 'default' ? 'transparent' : undefined,
                                        }}
                                    />
                                ))}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleAllColors();
                                    }}
                                    className={cn(
                                        "w-5 h-5 rounded-sm transition-all hover:scale-110 p-[2px]",
                                        selectedColors.length === ALL_COLORS.length && "ring-2 ring-zinc-400 ring-offset-1"
                                    )}
                                    style={{ background: RAINBOW_GRADIENT }}
                                >
                                    <span className="block w-full h-full bg-white dark:bg-zinc-900 rounded-sm" />
                                </button>
                            </div>
                        </div>

                        {/* Status filter */}
                        <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
                            <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-2">Status Filter</div>
                            <div className="flex items-center gap-1">
                                {ALL_STATUSES.map(s => (
                                    <button
                                        key={s}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleStatus(s);
                                        }}
                                        className={cn(
                                            "px-2 py-0.5 text-[10px] rounded-md border transition-all",
                                            selectedStatuses.includes(s)
                                                ? "border-zinc-400 dark:border-zinc-500 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
                                                : "border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600"
                                        )}
                                    >
                                        {statusLabels[s]}
                                    </button>
                                ))}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleAllStatuses();
                                    }}
                                    className={cn(
                                        "px-2 py-0.5 text-[10px] rounded-md border transition-all",
                                        selectedStatuses.length === ALL_STATUSES.length
                                            ? "border-zinc-400 dark:border-zinc-500 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
                                            : "border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600"
                                    )}
                                >
                                    All
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                setHideCompleted(!hideCompleted);
                                setShowMoreMenu(false);
                            }}
                            className="w-full px-3 py-1.5 text-left text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-between"
                        >
                            <span>Hide Completed</span>
                            {hideCompleted && <Check className="size-4 text-blue-500" />}
                        </button>

                        <button
                            onClick={() => {
                                setHideActualTime(!hideActualTime);
                                setShowMoreMenu(false);
                            }}
                            className="w-full px-3 py-1.5 text-left text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-between"
                        >
                            <span>Hide Time Info</span>
                            {hideActualTime && <Check className="size-4 text-blue-500" />}
                        </button>

                        {activeGroupId !== '__archive__' && (
                            <>
                                <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />
                                <button
                                    onClick={() => setShowMoreMenu(false)}
                                    className="w-full px-3 py-1.5 text-left text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                >
                                    Info
                                </button>
                                <button
                                    onClick={() => setShowMoreMenu(false)}
                                    className="w-full px-3 py-1.5 text-left text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                >
                                    History...
                                </button>
                                <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />
                                <button
                                    onClick={handleArchiveCompleted}
                                    className="w-full px-3 py-1.5 text-left text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                >
                                    Archive Completed
                                </button>
                                <button
                                    onClick={handleDeleteCompleted}
                                    className="w-full px-3 py-1.5 text-left text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                >
                                    Delete Completed
                                </button>
                                <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />
                                <button
                                    onClick={() => {
                                        if (activeGroupId && activeGroupId !== 'default') {
                                            deleteGroup(activeGroupId);
                                        }
                                        setShowMoreMenu(false);
                                    }}
                                    className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                >
                                    Move to Trash
                                </button>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
