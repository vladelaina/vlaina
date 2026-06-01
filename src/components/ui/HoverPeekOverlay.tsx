import { useState, useRef, useEffect, ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { SPRING_PREMIUM } from '@/lib/animations';
import { themeDomStyleTokens, themeMotionTokens, themeUiFeedbackTokens } from '@/styles/themeTokens';

interface HoverPeekOverlayProps {
    children: ReactNode;
    isEnabled: boolean;
    width?: number | string;
    triggerWidth?: number;
    className?: string;
    style?: React.CSSProperties;
    onPeekChange?: (isPeeking: boolean) => void;
}

export function HoverPeekOverlay({
    children,
    isEnabled,
    width = themeDomStyleTokens.hoverPeekDefaultWidthPx,
    triggerWidth = themeDomStyleTokens.hoverPeekTriggerWidthPx,
    className,
    style,
    onPeekChange
}: HoverPeekOverlayProps) {
    const [isPeeking, setIsPeeking] = useState(false);
    const peekTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        onPeekChange?.(isPeeking);
    }, [isPeeking, onPeekChange]);

    useEffect(() => {
        return () => {
            if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
        };
    }, []);

    if (!isEnabled) return null;

    return (
        <>
            <div
                className="fixed top-0 left-0 bottom-0 z-[var(--vlaina-z-40)]"
                style={{ width: triggerWidth }}
                onMouseEnter={(e) => {
                    if (e.buttons > 0) return;

                    peekTimerRef.current = setTimeout(() => {
                        setIsPeeking(true);
                    }, themeUiFeedbackTokens.hoverPeekOpenDelayMs);
                }}
                onMouseLeave={() => {
                    if (peekTimerRef.current) {
                        clearTimeout(peekTimerRef.current);
                        peekTimerRef.current = null;
                    }
                }}
            />

            <AnimatePresence>
                {isPeeking && (
                    <motion.aside
                        initial={{ x: themeMotionTokens.hoverPeekInitialX, opacity: themeMotionTokens.opacityHidden }}
                        animate={{ x: themeMotionTokens.hoverPeekVisibleX, opacity: themeMotionTokens.opacityVisible }}
                        exit={{ x: themeMotionTokens.hoverPeekInitialX, opacity: themeMotionTokens.opacityHidden }}
                        transition={SPRING_PREMIUM}
                        className={cn(
                            "fixed top-12 left-3 bottom-3 z-[var(--vlaina-z-50)]",
                            "shadow-[var(--vlaina-shadow-2xl)] border border-[var(--vlaina-color-subtle-border)] rounded-2xl",
                            "overflow-hidden",
                            className
                        )}
                        style={{ width, ...style }}
                        onMouseLeave={() => setIsPeeking(false)}
                    >
                        {children}
                    </motion.aside>
                )}
            </AnimatePresence>
        </>
    );
}
