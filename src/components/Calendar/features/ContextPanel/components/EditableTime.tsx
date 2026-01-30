import { useState, useEffect, useRef, useCallback } from 'react';
import { format, setHours, setMinutes } from 'date-fns';
import { parseClockTime } from '@/lib/time';

interface EditableTimeProps {
    date: Date;
    onChange: (newDate: Date) => void;
    use24Hour?: boolean;
    className?: string;
}

export function EditableTime({
    date,
    onChange,
    use24Hour = true,
    className = ''
}: EditableTimeProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const displayTime = use24Hour
        ? format(date, 'H:mm')
        : format(date, 'h:mm a').toUpperCase();

    const parsedPreview = (() => {
        const parsed = parseClockTime(inputValue);
        const previewDate = parsed
            ? setMinutes(setHours(new Date(), parsed.hours), parsed.minutes)
            : date;
        const text = use24Hour
            ? format(previewDate, 'H:mm')
            : format(previewDate, 'h:mm a').toUpperCase();
        return { valid: !!parsed, text };
    })();

    const handleStartEdit = () => {
        setInputValue(use24Hour ? format(date, 'H:mm') : format(date, 'h:mma').toLowerCase());
        setIsEditing(true);
    };

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleInputChange = useCallback((value: string) => {
        setInputValue(value);
        const parsed = parseClockTime(value);
        if (parsed) {
            const newDate = setMinutes(setHours(date, parsed.hours), parsed.minutes);
            onChange(newDate);
        }
    }, [date, onChange]);

    const handleBlur = useCallback(() => {
        setIsEditing(false);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            setIsEditing(false);
        } else if (e.key === 'Escape') {
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <div className="relative">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[10px] rounded whitespace-nowrap bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                    {parsedPreview.text}
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="w-16 px-1 py-0.5 text-sm bg-zinc-100 dark:bg-zinc-800 rounded outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 text-center"
                />
            </div>
        );
    }

    return (
        <button
            onClick={handleStartEdit}
            className={`px-1 py-0.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors ${className}`}
        >
            {displayTime}
        </button>
    );
}
