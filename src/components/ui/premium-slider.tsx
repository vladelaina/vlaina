import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface PremiumSliderProps {
    min: number;
    max: number;
    step?: number;
    value: number;
    onChange: (value: number) => void;
    onConfirm?: (value: number) => void;
    className?: string;
}

export function PremiumSlider({
    min,
    max,
    step = 1,
    value,
    onChange,
    onConfirm,
    className,
}: PremiumSliderProps) {
    const rafRef = useRef<number | undefined>(undefined);
    const latestValueRef = useRef(value);
    const [internalValue, setInternalValue] = useState(value);

    // Sync internal value when external value changes
    useEffect(() => {
        setInternalValue(value);
        latestValueRef.current = value;
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseFloat(e.target.value);
        setInternalValue(newValue);
        latestValueRef.current = newValue;

        if (rafRef.current) return;

        rafRef.current = requestAnimationFrame(() => {
            onChange(latestValueRef.current);
            rafRef.current = undefined;
        });
    };

    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    const percentage = ((internalValue - min) / (max - min)) * 100;

    return (
        <div className={cn('relative flex items-center w-full h-6 group', className)}>
            {/* Visual Track */}
            <div
                className="absolute w-full h-[3px] rounded-full bg-zinc-100 dark:bg-zinc-800 pointer-events-none"
                style={{
                    background: `linear-gradient(to right, #1e96eb ${percentage}%, var(--neko-bg-tertiary, #e4e4e7) ${percentage}%)`,
                }}
            />

            {/* Hidden Native Input (The Controller) */}
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={internalValue}
                onChange={handleChange}
                onMouseUp={() => onConfirm?.(internalValue)}
                onTouchEnd={() => onConfirm?.(internalValue)}
                className={cn(
                    'absolute w-full h-full opacity-0 cursor-pointer z-10',
                    'appearance-none bg-transparent'
                )}
            />

            {/* Premium Thumb (Visual Only) */}
            <div
                className="absolute pointer-events-none"
                style={{
                    left: `calc(${percentage}% - 12px)`, // 12px is half of 24px width
                }}
            >
                <div
                    className={cn(
                        'w-6 h-3 bg-white rounded-full shadow-md border border-zinc-200/50 transition-transform duration-150',
                        'group-active:scale-[0.9] dark:bg-zinc-100 dark:border-white/20'
                    )}
                />
            </div>
        </div>
    );
}
