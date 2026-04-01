import { useCallback, useState } from 'react';
import type { Alignment } from '../types';
import type { DragSession } from './imageDragSession';
import { getDragPosition } from './imageDragSession';

interface UseImageDragPreviewReturn {
    isDragging: boolean;
    dragPosition: { x: number; y: number } | null;
    dragSize: { width: number; height: number } | null;
    dragAlignment: Alignment;
    startPreview: (session: DragSession, alignment: Alignment) => void;
    updatePreviewPosition: (session: DragSession, clientX: number, clientY: number) => void;
    setPreviewAlignment: (alignment: Alignment) => void;
    resetPreview: () => void;
}

export function useImageDragPreview(): UseImageDragPreviewReturn {
    const [isDragging, setIsDragging] = useState(false);
    const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
    const [dragSize, setDragSize] = useState<{ width: number; height: number } | null>(null);
    const [dragAlignment, setDragAlignment] = useState<Alignment>('center');

    const resetPreview = useCallback(() => {
        document.documentElement.classList.remove('dragging-image');
        setIsDragging(false);
        setDragPosition(null);
        setDragSize(null);
        setDragAlignment('center');
    }, []);

    const startPreview = useCallback((session: DragSession, alignment: Alignment) => {
        document.documentElement.classList.add('dragging-image');
        setIsDragging(true);
        setDragPosition({ x: session.initialLeft, y: session.initialTop });
        setDragSize({ width: session.sourceWidth, height: session.sourceHeight });
        setDragAlignment(alignment);
    }, []);

    const updatePreviewPosition = useCallback((session: DragSession, clientX: number, clientY: number) => {
        setDragPosition(getDragPosition(session, clientX, clientY));
    }, []);

    return {
        isDragging,
        dragPosition,
        dragSize,
        dragAlignment,
        startPreview,
        updatePreviewPosition,
        setPreviewAlignment: setDragAlignment,
        resetPreview,
    };
}
