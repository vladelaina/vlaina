import { MdExpandMore, MdCheck, MdArchive } from 'react-icons/md';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Group } from '@/stores/types';

interface GroupSelectorProps {
    groups: Group[];
    activeGroupId: string;
    onSelectGroup: (groupId: string) => void;
    showPicker: boolean;
    onTogglePicker: () => void;
    pickerRef: React.RefObject<HTMLDivElement>;
}

export function GroupSelector({
    groups,
    activeGroupId,
    onSelectGroup,
    showPicker,
    onTogglePicker,
    pickerRef,
}: GroupSelectorProps) {
    const currentGroup = groups.find(g => g.id === activeGroupId);

    return (
        <div className="relative flex-1 min-w-0" ref={pickerRef}>
            <button
                onClick={onTogglePicker}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors max-w-full"
            >
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">
                    {currentGroup?.name || 'Inbox'}
                </span>
                <MdExpandMore className={cn(
                    "size-3.5 text-zinc-400 transition-transform flex-shrink-0",
                    showPicker && "rotate-180"
                )} />
            </button>

            {/* Group dropdown menu */}
            <AnimatePresence>
                {showPicker && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 z-50 max-h-64 overflow-y-auto"
                    >
                        {groups.map((group) => (
                            <button
                                key={group.id}
                                onClick={() => {
                                    onSelectGroup(group.id);
                                }}
                                className={cn(
                                    "w-full px-3 py-1.5 text-left text-sm transition-colors flex items-center gap-2",
                                    group.id === activeGroupId
                                        ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                                        : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                )}
                            >
                                {group.pinned && <span className="text-[10px]">📌</span>}
                                <span className="truncate">{group.name}</span>
                                {group.id === activeGroupId && (
                                    <MdCheck className="size-3.5 ml-auto flex-shrink-0" />
                                )}
                            </button>
                        ))}
                        {/* Archive entry */}
                        <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />
                        <button
                            onClick={() => {
                                onSelectGroup('__archive__');
                            }}
                            className={cn(
                                "w-full px-3 py-1.5 text-left text-sm transition-colors flex items-center gap-2",
                                activeGroupId === '__archive__'
                                    ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                                    : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                            )}
                        >
                            <MdArchive className="size-3.5" />
                            <span>Archive</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
