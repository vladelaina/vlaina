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
import {
    themeLinkTooltipTokens,
    themeMotionTokens,
    themeRenderingTokens,
    themeTextAreaTokens,
} from '@/styles/themeTokens';
import {
    LINK_TOOLTIP_MIN_WIDTH,
    useLinkTooltipContentWidth,
} from '../hooks/useLinkTooltipContentWidth';
import { MAX_LINK_TOOLTIP_URL_CHARS } from '../hooks/useLinkState';

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
    const { maxWidth, minWidth } = useLinkTooltipContentWidth(containerRef);
    const [editorWidth, setEditorWidth] = useState(LINK_TOOLTIP_MIN_WIDTH);

    usePredictedTextareaHeight(inputRef, {
        value: editUrl,
        minHeight: themeTextAreaTokens.minHeightPx,
        maxHeight: themeTextAreaTokens.unboundedMaxHeightPx,
    });

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

        const shellPadding = themeLinkTooltipTokens.editorShellPaddingPx;
        const actionWidth = editUrl.length > 0 ? themeLinkTooltipTokens.editorActionWidthPx : 0;
        const nextWidth = Math.min(
            maxWidth,
            Math.max(minWidth, naturalWidth + shellPadding + actionWidth)
        );

        setEditorWidth(nextWidth);
    }, [editUrl, maxWidth, minWidth]);

    useEffect(() => {
        if (!autoFocus && isNewLink) {
            return;
        }

        const timer = setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.select();
            }
        }, themeLinkTooltipTokens.editorAutofocusDelayMs);
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
            initial={{
                opacity: themeMotionTokens.opacityHidden,
                y: themeMotionTokens.linkEditorY,
                scale: themeMotionTokens.linkEditorInitialScale,
            }}
            animate={{
                opacity: themeMotionTokens.opacityVisible,
                y: themeMotionTokens.linkEditorVisibleY,
                scale: themeMotionTokens.linkEditorVisibleScale,
            }}
            style={{
                width: `${editorWidth}px`,
            }}
            className={cn(
                'floating-toolbar-inner link-tooltip-editor !rounded-[var(--vlaina-radius-26px)] z-[var(--vlaina-z-100)]',
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
                    maxLength={MAX_LINK_TOOLTIP_URL_CHARS}
                    className="block w-full resize-none overflow-hidden bg-transparent border-none outline-none text-sm font-mono text-[var(--vlaina-text-primary)] placeholder:text-[var(--vlaina-text-tertiary)] placeholder:font-light leading-6 py-1.5"
                    placeholder={t('editor.linkPlaceholder')}
                    spellCheck={false}
                    autoComplete="off"
                    style={{ overflowWrap: themeRenderingTokens.overflowWrapAnywhere }}
                />
            </div>

            <AnimatePresence>
                {editUrl.length > 0 && (
                    <motion.button
                        initial={{
                            opacity: themeMotionTokens.opacityHidden,
                            x: themeMotionTokens.linkEditorActionInitialX,
                            scale: themeMotionTokens.linkEditorActionInitialScale,
                        }}
                        animate={{
                            opacity: themeMotionTokens.opacityVisible,
                            x: themeMotionTokens.linkEditorActionVisibleX,
                            scale: themeMotionTokens.linkEditorActionVisibleScale,
                        }}
                        exit={{
                            opacity: themeMotionTokens.opacityHidden,
                            x: themeMotionTokens.linkEditorActionExitX,
                            scale: themeMotionTokens.linkEditorActionInitialScale,
                        }}
                        whileTap={{ scale: themeMotionTokens.linkEditorActionTapScale }}
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
