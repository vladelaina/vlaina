import { useState, useRef, useEffect, ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { SPRING_PREMIUM } from '@/lib/animations';

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
    width = 260,
    triggerWidth = 48,
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
            {/* Trigger Zone */}
            <div
                className="fixed top-0 left-0 bottom-0 z-[40]"
                style={{ width: triggerWidth }}
                onMouseEnter={(e) => {
                    if (e.buttons > 0) return;

                    peekTimerRef.current = setTimeout(() => {
                        setIsPeeking(true);
                    }, 75);
                }}
                onMouseLeave={() => {
                    if (peekTimerRef.current) {
                        clearTimeout(peekTimerRef.current);
                        peekTimerRef.current = null;
                    }
                }}
            />

            {/* Floating Content */}
            <AnimatePresence>
                {isPeeking && (
                    <motion.aside
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -20, opacity: 0 }}
                        transition={SPRING_PREMIUM}
                        className={cn(
                            "fixed top-12 left-3 bottom-3 z-[50]",
                            "shadow-2xl border border-black/5 dark:border-white/5 rounded-2xl",
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