import React, { useRef, useEffect, useCallback } from 'react';
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
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const rafRef = useRef<number | undefined>(undefined);
    const latestValueRef = useRef(value);
    const range = max - min;

    const resolvePercentage = useCallback((currentValue: number) => {
        if (!Number.isFinite(currentValue) || !Number.isFinite(range) || range <= 0) {
            return 0;
        }

        return Math.min(100, Math.max(0, ((currentValue - min) / range) * 100));
    }, [min, range]);

    useEffect(() => {
        latestValueRef.current = value;
        updateVisuals(value);
        if (inputRef.current) {
            inputRef.current.value = String(value);
        }
    }, [value, min, max]);

    const updateVisuals = useCallback((currentValue: number) => {
        if (!containerRef.current) return;
        const percentage = resolvePercentage(currentValue);
        containerRef.current.style.setProperty('--vlaina-slider-percentage', `${percentage}%`);
    }, [resolvePercentage]);

    const handleInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
        const newValue = parseFloat(e.currentTarget.value);
        latestValueRef.current = newValue;

        updateVisuals(newValue);

        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(() => {
            onChange(latestValueRef.current);
            rafRef.current = undefined;
        });
    }, [onChange, updateVisuals]);

    const handleRelease = useCallback(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = undefined;
        }
        onConfirm?.(latestValueRef.current);
    }, [onConfirm]);

    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    const initialPercentage = resolvePercentage(value);

    return (
        <div
            ref={containerRef}
            className={cn('premium-slider relative flex items-center w-full h-6 group', className)}
            style={{
                '--vlaina-slider-percentage': `${initialPercentage}%`,
            } as React.CSSProperties}
            draggable={true}
            onDragStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
        >
            <div
                className="absolute w-full h-[var(--vlaina-size-3px)] rounded-full pointer-events-none"
                style={{
                    background: 'var(--vlaina-gradient-premium-slider-track)',
                }}
            />

            <input
                ref={inputRef}
                type="range"
                spellCheck={false}
                min={min}
                max={max}
                step={step}
                defaultValue={value}
                onInput={handleInput}
                onMouseDown={(e) => {
                    e.stopPropagation();
                }}
                onPointerDown={(e) => {
                    e.stopPropagation();
                }}
                onMouseUp={handleRelease}
                onTouchEnd={handleRelease}
                className={cn(
                    'absolute w-full h-full opacity-[var(--vlaina-opacity-0)] cursor-pointer z-[var(--vlaina-z-10)]',
                    'appearance-none bg-transparent'
                )}
            />

            <div
                className="absolute pointer-events-none transition-none"
                style={{
                    left: `calc(var(--vlaina-slider-percentage) - 12px)`,
                }}
            >
                <div
                    className={cn(
                        'w-6 h-[var(--vlaina-size-18px)] bg-[var(--vlaina-bg-primary)] rounded-full shadow-[var(--vlaina-shadow-md)] border border-[var(--vlaina-border)]',
                        'group-active:scale-[var(--vlaina-scale-90)] transition-transform duration-[var(--vlaina-duration-100)]'
                    )}
                />
            </div>
        </div>
    );
}
