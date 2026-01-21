import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDownUp, Check, Clock, Flag, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/useGroupStore';
import { useState, useRef, useEffect } from 'react';
import type { TaskSortMode } from '@/stores/uiSlice';

const sortOptions: { mode: TaskSortMode; label: string; icon: any }[] = [
    { mode: 'default', label: 'Manual', icon: List },
    { mode: 'time', label: 'Time', icon: Clock },
    { mode: 'priority', label: 'Priority', icon: Flag },
];

export function TaskSortMenu() {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const { taskSortMode, setTaskSortMode } = useUIStore();

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative shrink-0" ref={menuRef}>
            <button
                onClick={() => setShowMenu(!showMenu)}
                className={cn(
                    "p-1.5 rounded-md transition-colors mt-0.5",
                    showMenu
                        ? "text-zinc-600 bg-zinc-100 dark:text-zinc-300 dark:bg-zinc-800"
                        : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                )}
                title="Sort tasks"
            >
                <ArrowDownUp className="size-4" />
            </button>

            <AnimatePresence>
                {showMenu && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 z-50 overflow-hidden"
                    >
                        <div className="px-3 py-2 text-xs text-zinc-400 dark:text-zinc-500 border-b border-zinc-200 dark:border-zinc-700">
                            Sort By
                        </div>
                        <div className="py-1">
                            {sortOptions.map((option) => (
                                <button
                                    key={option.mode}
                                    onClick={() => {
                                        setTaskSortMode(option.mode);
                                        setShowMenu(false);
                                    }}
                                    className="w-full px-3 py-1.5 text-left text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-2">
                                        <option.icon className={cn("size-4", taskSortMode === option.mode ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400")} />
                                        <span>{option.label}</span>
                                    </div>
                                    {taskSortMode === option.mode && (
                                        <Check className="size-3.5 text-blue-500" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
