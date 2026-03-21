import { useRef, useState, useCallback, useEffect } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import {
    setDragState,
    clearDragState,
} from '../imageDragPlugin';
import type { Alignment } from '../types';
import { moveImageNode } from '../commands/imageNodeCommands';
import { getPlaceholderMargin } from '../utils/imageDragPlaceholder';
import { calculateDropPosition, calculateAlignmentFromPosition } from '../utils/imageDropPosition';

const LONG_PRESS_DELAY_MS = 300;

type DragPhase = 'idle' | 'pressing' | 'dragging';

interface DragSession {
    phase: DragPhase;
    sourcePos: number | null;
    startX: number;
    startY: number;
    startTime: number;
    initialLeft: number;
    initialTop: number;
    sourceWidth: number;
    sourceHeight: number;
    targetPos: number | null;
    alignment: Alignment;
    longPressTimeoutId?: ReturnType<typeof setTimeout>;
}

interface UseImageDragOptions {
    view: EditorView;
    getPos: () => number | undefined;
    containerRef: React.RefObject<HTMLDivElement | null>;
    isActive: boolean;
    loadError: boolean;
    currentAlignment: Alignment;
}

interface UseImageDragReturn {
    isDragging: boolean;
    dragPosition: { x: number; y: number } | null;
    dragSize: { width: number; height: number } | null;
    dragAlignment: Alignment;
    handlePointerDown: (e: React.PointerEvent) => void;
    handlePointerUp: () => void;
    handlePointerCancel: () => void;
}

export function useImageDrag({
    view,
    getPos,
    containerRef,
    isActive,
    loadError,
    currentAlignment,
}: UseImageDragOptions): UseImageDragReturn {
    const [isDragging, setIsDragging] = useState(false);
    const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
    const [dragSize, setDragSize] = useState<{ width: number; height: number } | null>(null);
    const [dragAlignment, setDragAlignment] = useState<Alignment>('center');

    const dragSessionRef = useRef<DragSession | null>(null);
    const dragCleanupRef = useRef<(() => void) | null>(null);

    const resetVisualState = useCallback(() => {
        document.documentElement.classList.remove('dragging-image');
        setIsDragging(false);
        setDragPosition(null);
        setDragSize(null);
        setDragAlignment('center');
    }, []);

    const clearLongPressTimeout = useCallback((session: DragSession) => {
        if (session.longPressTimeoutId) {
            clearTimeout(session.longPressTimeoutId);
            session.longPressTimeoutId = undefined;
        }
    }, []);

    const updatePlaceholderMargin = useCallback((alignment: Alignment) => {
        const placeholder = document.querySelector('.image-drag-placeholder') as HTMLElement | null;
        if (!placeholder) return;
        placeholder.style.margin = getPlaceholderMargin(alignment);
    }, []);

    const syncPluginDragState = useCallback((session: DragSession) => {
        if (session.sourcePos === null) return;

        const finalTargetPos = session.targetPos !== null ? session.targetPos : session.sourcePos;
        setDragState(view, {
            isDragging: session.phase === 'dragging',
            sourcePos: session.sourcePos,
            targetPos: finalTargetPos,
            alignment: session.alignment,
            imageNaturalWidth: session.sourceWidth,
            imageNaturalHeight: session.sourceHeight,
            editorView: view,
        });
    }, [view]);

    const beginDragging = useCallback((session: DragSession) => {
        if (session.phase !== 'pressing') return;

        session.phase = 'dragging';
        session.alignment = currentAlignment;

        document.documentElement.classList.add('dragging-image');
        setIsDragging(true);
        setDragPosition({ x: session.initialLeft, y: session.initialTop });
        setDragSize({ width: session.sourceWidth, height: session.sourceHeight });
        setDragAlignment(currentAlignment);

        if (session.sourcePos !== null) {
            session.targetPos = session.sourcePos;
            syncPluginDragState(session);
        }
    }, [currentAlignment, syncPluginDragState]);

    const finishSession = useCallback((session: DragSession, shouldCommit: boolean) => {
        clearLongPressTimeout(session);

        if (shouldCommit && session.phase === 'dragging' && session.sourcePos !== null) {
            const finalTargetPos = session.targetPos !== null ? session.targetPos : session.sourcePos;
            moveImageNode(view, {
                sourcePos: session.sourcePos,
                targetPos: finalTargetPos,
                alignment: session.alignment,
            });
        }

        clearDragState(view);
        resetVisualState();

        if (dragSessionRef.current === session) {
            dragSessionRef.current = null;
        }
        dragCleanupRef.current = null;
    }, [clearLongPressTimeout, resetVisualState, view]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (isActive || loadError) return;
        if (!e.isPrimary || e.button !== 0) return;

        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input') || target.closest('[data-resize-handle]')) {
            return;
        }

        if (e.ctrlKey || e.metaKey) {
            return;
        }

        const sourcePos = getPos();
        if (sourcePos === undefined) return;
        const containerRect = containerRef.current?.getBoundingClientRect();
        const sourceWidth = containerRef.current?.offsetWidth || 200;
        const sourceHeight = containerRef.current?.offsetHeight || 100;

        const session: DragSession = {
            phase: 'pressing',
            sourcePos,
            startX: e.clientX,
            startY: e.clientY,
            startTime: Date.now(),
            initialLeft: containerRect?.left || 0,
            initialTop: containerRect?.top || 0,
            sourceWidth,
            sourceHeight,
            targetPos: sourcePos,
            alignment: currentAlignment,
        };

        dragSessionRef.current = session;

        const startLongPressIfNeeded = () => {
            const active = dragSessionRef.current;
            if (active !== session || active.phase !== 'pressing') return;
            beginDragging(active);
        };

        const onPointerMove = (moveEvent: PointerEvent) => {
            const active = dragSessionRef.current;
            if (active !== session) return;

            if (moveEvent.ctrlKey || moveEvent.metaKey) {
                clearLongPressTimeout(active);
                return;
            }

            if (active.phase === 'pressing') {
                const elapsed = Date.now() - active.startTime;
                if (elapsed >= LONG_PRESS_DELAY_MS) {
                    beginDragging(active);
                }
            }

            if (active.phase !== 'dragging') {
                return;
            }

            const deltaX = moveEvent.clientX - active.startX;
            const deltaY = moveEvent.clientY - active.startY;
            setDragPosition({ x: active.initialLeft + deltaX, y: active.initialTop + deltaY });

            const alignment = calculateAlignmentFromPosition(view, moveEvent.clientX);
            active.alignment = alignment;
            setDragAlignment(alignment);
            updatePlaceholderMargin(alignment);

            if (active.sourcePos !== null) {
                const targetPos = calculateDropPosition(view, moveEvent.clientY, active.sourcePos);
                if (targetPos !== null) {
                    active.targetPos = targetPos;
                }
                syncPluginDragState(active);
            }
        };

        const cleanupListeners = () => {
            window.removeEventListener('pointermove', onPointerMove, true);
            window.removeEventListener('pointerup', onPointerUp, true);
            window.removeEventListener('pointercancel', onPointerCancel, true);
            window.removeEventListener('blur', onPointerCancel, true);
        };

        const onPointerUp = () => {
            cleanupListeners();
            finishSession(session, true);
        };

        const onPointerCancel = () => {
            cleanupListeners();
            finishSession(session, false);
        };

        dragCleanupRef.current = () => {
            cleanupListeners();
            finishSession(session, false);
        };

        session.longPressTimeoutId = setTimeout(startLongPressIfNeeded, LONG_PRESS_DELAY_MS);

        window.addEventListener('pointermove', onPointerMove, true);
        window.addEventListener('pointerup', onPointerUp, true);
        window.addEventListener('pointercancel', onPointerCancel, true);
        window.addEventListener('blur', onPointerCancel, true);
    }, [
        isActive,
        loadError,
        getPos,
        containerRef,
        currentAlignment,
        clearLongPressTimeout,
        beginDragging,
        syncPluginDragState,
        updatePlaceholderMargin,
        view,
        finishSession,
    ]);

    const handlePointerUp = useCallback(() => {}, []);
    const handlePointerCancel = useCallback(() => {}, []);

    useEffect(() => {
        return () => {
            if (dragCleanupRef.current) {
                dragCleanupRef.current();
            } else {
                const session = dragSessionRef.current;
                if (session) {
                    finishSession(session, false);
                }
            }
        };
    }, [finishSession]);

    return {
        isDragging,
        dragPosition,
        dragSize,
        dragAlignment,
        handlePointerDown,
        handlePointerUp,
        handlePointerCancel,
    };
}
