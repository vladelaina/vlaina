import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { Icon } from '@/components/ui/icons';
import {
    measureTextNaturalWidth,
    resolveElementTextLayoutMetrics,
} from '@/lib/text-layout';
import { usePredictedTextareaHeight } from '@/hooks/usePredictedTextareaHeight';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

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
    const { t } = useI18n();
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
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
            className={cn(
                'floating-toolbar-inner link-tooltip-editor !rounded-[26px] min-w-[280px] max-w-[calc(100vw-32px)] z-[100]',
                chatComposerPillSurfaceClass
            )}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="relative flex-1 px-2">
                <textarea
                    ref={inputRef}
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    className="block w-full resize-none overflow-hidden bg-transparent border-none outline-none text-sm font-mono text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 placeholder:font-light leading-6 py-1.5"
                    placeholder={t('editor.linkPlaceholder')}
                    spellCheck={false}
                    autoComplete="off"
                    style={{ overflowWrap: 'anywhere' }}
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
                        className="toolbar-btn link-tooltip-action-btn active shrink-0"
                    >
                        <Icon size="md" name="common.check" />
                    </motion.button>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
