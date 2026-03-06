import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { useGroupStore, useUIStore } from '@/stores/useGroupStore';
import { useState, useRef, useEffect } from 'react';

export function TaskFilterMenu() {
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const moreMenuRef = useRef<HTMLDivElement>(null);

    const { activeGroupId, archiveCompletedTasks, deleteCompletedTasks } = useGroupStore();
    const {
        hideActualTime, setHideActualTime
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
                <Icon size="md" name="common.more" />
            </button>

            <AnimatePresence>
                {showMoreMenu && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 z-50"
                    >
                        <button
                            onClick={() => {
                                setHideActualTime(!hideActualTime);
                                setShowMoreMenu(false);
                            }}
                            className="w-full px-3 py-1.5 text-left text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-between"
                        >
                            <span>Hide Time Info</span>
                            {hideActualTime && <Icon size="md" name="common.check" className=" text-blue-500" />}
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
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
