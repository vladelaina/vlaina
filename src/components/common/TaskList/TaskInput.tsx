/**
 * TaskInput - Reusable task input component for panels
 * Migrated from Calendar/features/TaskPanel/PanelTaskInput.tsx
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MdAdd } from 'react-icons/md';
import { cn } from '@/lib/utils';
import { useGroupStore } from '@/stores/useGroupStore';
import { ALL_COLORS, SIMPLE_COLOR_STYLES, type ItemColor } from '@/lib/colors';
import { TaskFilterMenu } from './TaskFilterMenu';
import { TaskSortMenu } from './TaskSortMenu';

interface TaskInputProps {
    compact?: boolean;
}

export function TaskInput({ compact = false }: TaskInputProps) {
    const [content, setContent] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [color, setColor] = useState<ItemColor>('default');
    const [showColorMenu, setShowColorMenu] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const colorMenuRef = useRef<HTMLDivElement>(null);

    const { addTask, activeGroupId } = useGroupStore();

    const handleSubmit = () => {
        if (content.trim() && activeGroupId) {
            addTask(content.trim(), activeGroupId, color);
            setContent('');
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    useEffect(() => {
        const textarea = inputRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, compact ? 80 : 120)}px`;
        }
    }, [content, compact]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-color-option]')) return;

            if (colorMenuRef.current && !colorMenuRef.current.contains(target)) {
                setShowColorMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="flex items-start gap-1">
            {/* Main input area */}
            <div
                className={cn(
                    'flex-1 flex items-start gap-2 px-2 py-1.5 rounded-md transition-all duration-200',
                    'border',
                    isFocused
                        ? 'border-zinc-200 dark:border-zinc-700 bg-muted/30'
                        : 'border-transparent hover:border-zinc-200 dark:hover:border-zinc-800'
                )}
            >
                {/* Color picker */}
                <div className="relative shrink-0 pt-0.5" ref={colorMenuRef}>
                    <button
                        onClick={() => setShowColorMenu(!showColorMenu)}
                        className={cn(
                            "flex items-center justify-center w-5 h-5 rounded-[6px] transition-colors border-2",
                            color && color !== 'default'
                                ? "bg-transparent" // Use inline style for border color
                                : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500 bg-transparent"
                        )}
                        style={color && color !== 'default'
                            ? { 
                                borderColor: SIMPLE_COLOR_STYLES[color].hex,
                                backgroundColor: `${SIMPLE_COLOR_STYLES[color].hex}20` // 12% opacity background
                              }
                            : undefined
                        }
                    >
                        {/* Optional: Inner indicator or just keep it as a colored box */}
                    </button>

                    <AnimatePresence>
                        {showColorMenu && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="absolute left-0 top-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1.5 px-1.5 z-50 flex flex-col gap-0.5"
                            >
                                {[...ALL_COLORS].reverse().map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => {
                                            setColor(c);
                                            setShowColorMenu(false);
                                        }}
                                        className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                                    >
                                        <div
                                            className="w-[18px] h-[18px] rounded-[4px] transition-transform active:scale-90"
                                            style={c && c !== 'default'
                                                ? { backgroundColor: SIMPLE_COLOR_STYLES[c].hex }
                                                : { border: '1px solid currentColor', opacity: 0.5 }
                                            }
                                        />
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Input field */}
                <textarea
                    ref={inputRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={handleKeyDown}
                    placeholder="New task..."
                    rows={1}
                    className={cn(
                        'flex-1 bg-transparent border-none outline-none resize-none py-0.5',
                        'text-sm text-foreground placeholder:text-muted-foreground/50',
                        'focus:ring-0 leading-relaxed min-h-[20px]',
                        compact ? 'max-h-[80px]' : 'max-h-[120px]'
                    )}
                />

                {/* Submit button */}
                <AnimatePresence mode="wait">
                    {content.trim() && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            onClick={handleSubmit}
                            className="shrink-0 p-1 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 transition-opacity mt-0.5"
                        >
                            <MdAdd className="w-[18px] h-[18px]" />
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* Filter Menu */}
            <TaskFilterMenu />
            
            {/* Sort Menu */}
            <TaskSortMenu />
        </div>
    );
}



