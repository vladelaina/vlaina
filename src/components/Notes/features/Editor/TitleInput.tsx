import { useState, useEffect, useRef } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { cn } from '@/lib/utils';

interface TitleInputProps {
    notePath: string;
    initialTitle: string;
    className?: string;
}

export function TitleInput({ notePath, initialTitle, className }: TitleInputProps) {
    const [value, setValue] = useState(initialTitle);
    const renameNote = useNotesStore(state => state.renameNote);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync internal state if prop changes (e.g. switching notes)
    useEffect(() => {
        setValue(initialTitle);
    }, [initialTitle, notePath]);

    const handleBlur = async () => {
        const trimmed = value.trim();
        if (trimmed && trimmed !== initialTitle) {
            try {
                await renameNote(notePath, trimmed);
            } catch (error) {
                console.error('Failed to rename note:', error);
                // Revert on error
                setValue(initialTitle);
            }
        } else if (!trimmed) {
            // Revert if empty
            setValue(initialTitle);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            inputRef.current?.blur();
        }
    };

    return (
        <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={cn(
                "w-full bg-transparent border-none outline-none",
                "text-[2rem] leading-[2.5rem] font-semibold tracking-tight", // Match H2 styles
                "text-[#121212] dark:text-[#eeeeee]",
                "placeholder:text-gray-300 dark:placeholder:text-gray-600",
                "p-0 m-0",
                className
            )}
            placeholder="Untitled"
            spellCheck={false}
        />
    );
}
