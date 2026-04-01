import { useRef, useCallback, useEffect } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import {
    setDragState,
    clearDragState,
} from '../imageDragPlugin';
import type { Alignment } from '../types';
import { moveImageNode } from '../commands/imageNodeCommands';
import { getPlaceholderMargin } from '../utils/imageDragPlaceholder';
import { calculateDropPosition, calculateAlignmentFromPosition } from '../utils/imageDropPosition';
import {
    beginDragSession,
    createDragSession,
    getFinalTargetPos,
    LONG_PRESS_DELAY_MS,
    shouldCommitDragSession,
    type DragSession,
} from './imageDragSession';
import { useImageDragPreview } from './useImageDragPreview';

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
}

export function useImageDrag({
    view,
    getPos,
    containerRef,
    isActive,
    loadError,
    currentAlignment,
}: UseImageDragOptions): UseImageDragReturn {
    const {
        isDragging,
        dragPosition,
        dragSize,
        dragAlignment,
        startPreview,
        updatePreviewPosition,
        setPreviewAlignment,
        resetPreview,
    } = useImageDragPreview();

    const dragSessionRef = useRef<DragSession | null>(null);
    const dragCleanupRef = useRef<(() => void) | null>(null);

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

        const finalTargetPos = getFinalTargetPos(session);
        if (finalTargetPos === null) return;

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
        if (!beginDragSession(session, currentAlignment)) return;

        startPreview(session, currentAlignment);
        syncPluginDragState(session);
    }, [currentAlignment, startPreview, syncPluginDragState]);

    const finishSession = useCallback((session: DragSession, shouldCommit: boolean) => {
        clearLongPressTimeout(session);

        if (shouldCommit && shouldCommitDragSession(session)) {
            const { sourcePos } = session;
            const finalTargetPos = getFinalTargetPos(session);
            if (sourcePos !== null && finalTargetPos !== null) {
                moveImageNode(view, {
                    sourcePos,
                    targetPos: finalTargetPos,
                    alignment: session.alignment,
                });
            }
        }

        clearDragState(view);
        resetPreview();

        if (dragSessionRef.current === session) {
            dragSessionRef.current = null;
        }
        dragCleanupRef.current = null;
    }, [clearLongPressTimeout, resetPreview, view]);

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

        const session = createDragSession({
            sourcePos,
            clientX: e.clientX,
            clientY: e.clientY,
            initialLeft: containerRect?.left || 0,
            initialTop: containerRect?.top || 0,
            sourceWidth,
            sourceHeight,
            alignment: currentAlignment,
        });

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

            updatePreviewPosition(active, moveEvent.clientX, moveEvent.clientY);

            const alignment = calculateAlignmentFromPosition(view, moveEvent.clientX);
            active.alignment = alignment;
            setPreviewAlignment(alignment);
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
        updatePreviewPosition,
        setPreviewAlignment,
        syncPluginDragState,
        updatePlaceholderMargin,
        view,
        finishSession,
    ]);

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
    };
}
