import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    measureTextNaturalWidth,
    resolveElementTextLayoutMetrics,
} from '@/lib/text-layout';
import { usePredictedTextareaHeight } from '@/hooks/usePredictedTextareaHeight';

interface LinkEditorProps {
    editUrl: string;
    setEditUrl: (url: string) => void;
    editText: string;
    setEditText: (text: string) => void;
    onSave: (shouldClose: boolean) => void;
    onCancel: () => void;
    isNewLink: boolean;
    autoFocus: boolean;
    initialText: string;
}

export const LinkEditor = ({
    editUrl,
    setEditUrl,
    onSave,
    onCancel,
    isNewLink,
    autoFocus,
}: LinkEditorProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [surfaceWidth, setSurfaceWidth] = useState<number | null>(null);
    const [editorWidth, setEditorWidth] = useState(280);

    usePredictedTextareaHeight(inputRef, {
        value: editUrl,
        minHeight: 0,
        maxHeight: 100000,
    });

    useEffect(() => {
        const positionRoot = containerRef.current?.parentElement;
        if (!(positionRoot instanceof HTMLElement)) {
            return;
        }

        const updateWidth = () => {
            const nextWidth = Math.round(positionRoot.clientWidth);
            setSurfaceWidth(nextWidth > 0 ? nextWidth : null);
        };

        updateWidth();

        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(updateWidth)
            : null;
        resizeObserver?.observe(positionRoot);

        return () => {
            resizeObserver?.disconnect();
        };
    }, []);

    useLayoutEffect(() => {
        const input = inputRef.current;
        if (!input) {
            return;
        }

        const text = editUrl.trim().length > 0 ? editUrl : input.placeholder;
        const metrics = resolveElementTextLayoutMetrics(input);
        const naturalWidth = measureTextNaturalWidth(text, {
            font: metrics.font,
            prepareOptions: {
                whiteSpace: 'pre-wrap',
            },
        });

        const shellPadding = 40;
        const actionWidth = editUrl.length > 0 ? 36 : 0;
        const nextMaxWidth = Math.max(280, Math.min(surfaceWidth ?? 680, window.innerWidth - 32));
        const nextWidth = Math.min(
            nextMaxWidth,
            Math.max(280, naturalWidth + shellPadding + actionWidth)
        );

        setEditorWidth(nextWidth);
    }, [editUrl, surfaceWidth]);

    useEffect(() => {
        if (!autoFocus && isNewLink) {
            return;
        }

        const timer = setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.select();
            }
        }, 50);
        return () => clearTimeout(timer);
    }, [autoFocus, isNewLink]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.nativeEvent.isComposing) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            onSave(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
        }
    };

    return (
        <motion.div
            ref={containerRef}
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            style={{
                width: `${editorWidth}px`,
            }}
            className="flex items-end min-w-[280px] max-w-[calc(100vw-32px)] bg-white dark:bg-[#1a1a1a] border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.04)] p-1.5 pr-2 z-[100]"
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="relative flex-1 px-2">
                <textarea
                    ref={inputRef}
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    rows={1}
                    className="block w-full resize-none overflow-hidden bg-transparent border-none outline-none text-sm font-mono text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 placeholder:font-light leading-6 py-1.5"
                    placeholder="Paste or type a URL..."
                    spellCheck={false}
                    autoComplete="off"
                    style={{ overflowWrap: 'anywhere' }}
                />

                <motion.div 
                    initial={{ scaleX: 0 }}
                    animate={{ 
                        scaleX: 1,
                        opacity: isFocused ? 0.6 : 0.2,
                        height: isFocused ? '1.5px' : '1px'
                    }}
                    className="absolute bottom-0 left-2 right-2 bg-[var(--vlaina-accent)] origin-left"
                />
            </div>

            <AnimatePresence>
                {editUrl.length > 0 && (
                    <motion.button
                        initial={{ opacity: 0, x: -4, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 4, scale: 0.8 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onSave(true)}
                        className="flex items-center justify-center size-7 text-[var(--vlaina-accent)] hover:bg-[var(--vlaina-accent)]/10 rounded-lg transition-colors shrink-0"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </motion.button>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
