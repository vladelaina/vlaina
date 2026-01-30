/**
 * PremiumSlider - Zero-Render Performance Edition
 *
 * This slider achieves maximum performance by:
 * 1. Using NO React state for visual updates
 * 2. All visual feedback (track, thumb) is handled by the native browser engine
 * 3. React is only used for the callback dispatch
 *
 * The secret: We use CSS custom properties and direct DOM manipulation
 * to update the visual state, completely bypassing React's render cycle.
 */

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

    // Initialize visual state on mount and when value prop changes externally
    // This handles external sync (e.g., switching notes, database updates)
    useEffect(() => {
        latestValueRef.current = value;
        updateVisuals(value);
        // IMPORTANT: Also sync the native input's value
        // Since we use defaultValue (uncontrolled), we need to manually update it
        if (inputRef.current) {
            inputRef.current.value = String(value);
        }
    }, [value, min, max]);

    // Direct DOM update - NO React state, NO re-render
    const updateVisuals = useCallback((currentValue: number) => {
        if (!containerRef.current) return;
        const percentage = ((currentValue - min) / (max - min)) * 100;
        containerRef.current.style.setProperty('--slider-percentage', `${percentage}%`);
    }, [min, max]);

    // Handle input change - update visuals directly, dispatch via RAF
    const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseFloat(e.target.value);
        console.log('[PremiumSlider] Input Change:', newValue); // Debug Log
        latestValueRef.current = newValue;

        // Instant visual feedback - direct DOM, no React
        updateVisuals(newValue);

        // Throttled callback to parent - prevents overwhelming the main thread
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(() => {
            onChange(latestValueRef.current);
            rafRef.current = undefined;
        });
    }, [onChange, updateVisuals]);

    // Handle release - confirm the final value
    const handleRelease = useCallback(() => {
        console.log('[PremiumSlider] Release'); // Debug Log
        // Flush any pending RAF
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = undefined;
        }
        // Emit final value
        onConfirm?.(latestValueRef.current);
    }, [onConfirm]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    // Calculate initial percentage for SSR/first paint
    const initialPercentage = ((value - min) / (max - min)) * 100;

    return (
        <div
            ref={containerRef}
            className={cn('premium-slider relative flex items-center w-full h-6 group', className)}
            style={{
                '--slider-percentage': `${initialPercentage}%`,
            } as React.CSSProperties}
            // CRITICAL FIX: Prevent HTML5 Native Drag & Drop from hijacking the slider interaction
            // This stops the "red forbidden icon" and allows mouse events to continue
            draggable={true} // Must be true to capture the event reliably in some browsers
            onDragStart={(e) => {
                console.log('[PremiumSlider] Native DragStart Intercepted');
                e.preventDefault();
                e.stopPropagation();
            }}
        >
            {/* Visual Track - driven by CSS variable, no React re-render needed */}
            <div
                className="absolute w-full h-[3px] rounded-full pointer-events-none"
                style={{
                    background: `linear-gradient(to right, #1e96eb var(--slider-percentage), var(--neko-bg-tertiary, #e4e4e7) var(--slider-percentage))`,
                }}
            />

            {/* Native Range Input - UNCONTROLLED for performance */}
            {/* Using defaultValue + ref for updates, NOT value prop */}
            <input
                ref={inputRef}
                type="range"
                min={min}
                max={max}
                step={step}
                defaultValue={value}
                onInput={handleInput}
                onMouseDown={(e) => {
                    console.log('[PremiumSlider] MouseDown triggered');
                    e.stopPropagation();
                }}
                onPointerDown={(e) => {
                    console.log('[PremiumSlider] PointerDown triggered');
                    e.stopPropagation();
                }}
                onMouseUp={handleRelease}
                onTouchEnd={handleRelease}
                className={cn(
                    'absolute w-full h-full opacity-0 cursor-pointer z-10',
                    'appearance-none bg-transparent'
                )}
            />

            {/* Premium Thumb - position driven by CSS variable */}
            <div
                className="absolute pointer-events-none transition-none"
                style={{
                    left: `calc(var(--slider-percentage) - 12px)`,
                }}
            >
                <div
                    className={cn(
                        'w-6 h-[18px] bg-[var(--neko-bg-primary)] rounded-full shadow-md border border-[var(--neko-border)]',
                        'group-active:scale-[0.9] transition-transform duration-100'
                    )}
                />
            </div>
        </div>
    );
}