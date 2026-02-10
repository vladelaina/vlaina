import React, { useMemo } from 'react';
import { Icon } from '@/components/ui/icons';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface LinkEditorProps {
    editUrl: string;
    setEditUrl: (url: string) => void;
    editText: string;
    setEditText: (text: string) => void;
    onSave: (shouldClose: boolean) => void;
    isNewLink: boolean;
    initialText: string;
}

export const LinkEditor = ({
    editUrl,
    setEditUrl,
    editText,
    setEditText,
    onSave,
    isNewLink,
    initialText
}: LinkEditorProps) => {

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.nativeEvent.isComposing) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            onSave(true);
        } else {
            e.stopPropagation();
        }
    };

    const dynamicWidth = useMemo(() => {
        const maxLength = Math.max(editText.length, editUrl.length);
        // Base width 320px + approx 8px per char + extra padding, max 520
        return Math.min(Math.max(320, maxLength * 8 + 80), 520);
    }, [editText, editUrl]);

    return (
        <div
            className="flex items-center bg-white dark:bg-[#1e1e1e] border border-black/5 dark:border-white/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-2 gap-2 animate-in fade-in zoom-in-95 duration-200"
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div
                className="flex flex-col gap-2 transition-all duration-200 ease-out"
                style={{ width: `${dynamicWidth}px` }}
            >
                <div className="group flex items-center h-9 px-3 bg-white dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-md focus-within:border-[var(--neko-accent)] focus-within:ring-1 focus-within:ring-[var(--neko-accent)] transition-all">
                    <span className="text-[11px] font-bold text-gray-400 group-focus-within:text-[var(--neko-accent)] uppercase tracking-widest mr-2 transition-colors select-none">
                        Text
                    </span>
                    <input
                        autoFocus={!isNewLink || !initialText}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-gray-800 dark:text-gray-100 placeholder:text-gray-400"
                        placeholder="Display text (optional)"
                    />
                </div>

                <div className="group flex items-center h-9 px-3 bg-white dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-md focus-within:border-[var(--neko-accent)] focus-within:ring-1 focus-within:ring-[var(--neko-accent)] transition-all">
                    <span className="text-[11px] font-bold text-gray-400 group-focus-within:text-[var(--neko-accent)] uppercase tracking-widest mr-2 transition-colors select-none">
                        Link
                    </span>
                    <input
                        autoFocus={isNewLink && !!initialText}
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-gray-600 dark:text-gray-300 placeholder:text-gray-400"
                        placeholder="https://..."
                    />
                </div>
            </div>

            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => onSave(false)}
                            className="flex items-center justify-center size-8 text-[var(--neko-accent)] hover:opacity-80 rounded-full transition-all flex-shrink-0"
                        >
                            <Icon size="md" name="common.check" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Save changes</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
};
