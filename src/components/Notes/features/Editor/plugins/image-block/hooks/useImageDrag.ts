import { useRef, useCallback, useEffect } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import {
    setDragState,
    clearDragState,
} from '../imageDragPlugin';
import type { Alignment } from '../types';
import { moveImageNode } from '../commands/imageNodeCommands';
import { calculateDropPosition, calculateAlignmentFromPosition } from '../utils/imageDropPosition';
import {
    beginDragSession,
    createDragSession,
    getFinalTargetPos,
    LONG_PRESS_DELAY_MS,
    shouldCommitDragSession,
    type DragSession,
} from './imageDragSession';
import {
    getImageDragSourceGeometry,
    markImageUserInput,
    shouldIgnoreImageDragPointerDown,
    updateImageDragPlaceholderMargin,
} from './imageDragStart';
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
        if (shouldIgnoreImageDragPointerDown(e, isActive, loadError)) return;

        const sourcePos = getPos();
        if (sourcePos === undefined) return;
        e.preventDefault();
        markImageUserInput(view);

        const sourceGeometry = getImageDragSourceGeometry(containerRef.current);
        let pendingPointer: { clientX: number; clientY: number } | null = null;
        let dragFrame: number | null = null;

        const session = createDragSession({
            sourcePos,
            clientX: e.clientX,
            clientY: e.clientY,
            ...sourceGeometry,
            alignment: currentAlignment,
        });

        dragSessionRef.current = session;

        const startLongPressIfNeeded = () => {
            const active = dragSessionRef.current;
            if (active !== session || active.phase !== 'pressing') return;
            beginDragging(active);
        };

        const applyDragMove = (active: DragSession, clientX: number, clientY: number) => {
            updatePreviewPosition(active, clientX, clientY);

            const alignment = calculateAlignmentFromPosition(view, clientX);
            active.alignment = alignment;
            setPreviewAlignment(alignment);
            updateImageDragPlaceholderMargin(alignment);

            if (active.sourcePos !== null) {
                const targetPos = calculateDropPosition(view, clientY, active.sourcePos);
                if (targetPos !== null) {
                    active.targetPos = targetPos;
                }
                syncPluginDragState(active);
            }
        };

        const flushPendingDrag = () => {
            dragFrame = null;
            const pointer = pendingPointer;
            pendingPointer = null;
            const active = dragSessionRef.current;
            if (active !== session || active.phase !== 'dragging' || !pointer) {
                return;
            }

            applyDragMove(active, pointer.clientX, pointer.clientY);
        };

        const schedulePendingDrag = () => {
            if (dragFrame !== null) return;
            dragFrame = window.requestAnimationFrame(flushPendingDrag);
        };

        const flushPendingDragNow = () => {
            if (dragFrame !== null) {
                window.cancelAnimationFrame(dragFrame);
                dragFrame = null;
            }

            const pointer = pendingPointer;
            pendingPointer = null;
            const active = dragSessionRef.current;
            if (active !== session || active.phase !== 'dragging' || !pointer) {
                return;
            }

            applyDragMove(active, pointer.clientX, pointer.clientY);
        };

        const cancelPendingDrag = () => {
            if (dragFrame !== null) {
                window.cancelAnimationFrame(dragFrame);
                dragFrame = null;
            }
            pendingPointer = null;
        };

        const onPointerMove = (moveEvent: PointerEvent) => {
            const active = dragSessionRef.current;
            if (active !== session) return;

            if (moveEvent.ctrlKey || moveEvent.metaKey) {
                clearLongPressTimeout(active);
                cancelPendingDrag();
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

            pendingPointer = {
                clientX: moveEvent.clientX,
                clientY: moveEvent.clientY,
            };
            schedulePendingDrag();
        };

        const cleanupListeners = () => {
            window.removeEventListener('pointermove', onPointerMove, true);
            window.removeEventListener('pointerup', onPointerUp, true);
            window.removeEventListener('pointercancel', onPointerCancel, true);
            window.removeEventListener('blur', onPointerCancel, true);
            cancelPendingDrag();
        };

        const onPointerUp = () => {
            flushPendingDragNow();
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
