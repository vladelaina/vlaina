import React from 'react';
import { cn } from '@/lib/utils';

interface ResizeHandlesProps {
    onResizeStart: (direction: 'left' | 'right') => (e: React.MouseEvent) => void;
    isVisible: boolean;
}

export const ResizeHandles: React.FC<ResizeHandlesProps> = ({ onResizeStart, isVisible }) => {
    return (
        <div className={cn(
            "absolute inset-0 pointer-events-none transition-opacity duration-200",
            isVisible ? "opacity-100" : "opacity-0"
        )}>
            <div
                className="absolute left-0 top-1/2 -translate-y-1/2 -ml-3 h-12 w-1.5 cursor-ew-resize flex items-center justify-center hover:bg-[var(--neko-accent)] bg-[var(--neko-border)] rounded-full transition-all pointer-events-auto shadow-sm"
                onMouseDown={onResizeStart('left')}
            />
            <div
                className="absolute right-0 top-1/2 -translate-y-1/2 -mr-3 h-12 w-1.5 cursor-ew-resize flex items-center justify-center hover:bg-[var(--neko-accent)] bg-[var(--neko-border)] rounded-full transition-all pointer-events-auto shadow-sm"
                onMouseDown={onResizeStart('right')}
            />
        </div>
    );
};
