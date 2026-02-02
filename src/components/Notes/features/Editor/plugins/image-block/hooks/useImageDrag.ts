import { useRef, useState, useCallback, useEffect } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { setDragState, clearDragState, calculateDropPosition } from '../imageDragPlugin';

interface UseImageDragOptions {
    view: EditorView;
    getPos: () => number | undefined;
    containerRef: React.RefObject<HTMLDivElement | null>;
    imageNaturalSize: { width: number; height: number };
    isActive: boolean;
    loadError: boolean;
}

interface UseImageDragReturn {
    isDragging: boolean;
    dragPosition: { x: number; y: number } | null;
    dragSize: { width: number; height: number } | null;
    handlePointerDown: (e: React.PointerEvent) => void;
    handlePointerUp: () => void;
    handlePointerCancel: () => void;
}

const LONG_PRESS_DELAY = 300;

export function useImageDrag({
    view,
    getPos,
    containerRef,
    imageNaturalSize,
    isActive,
    loadError,
}: UseImageDragOptions): UseImageDragReturn {
    const [isDragging, setIsDragging] = useState(false);
    const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
    const [dragSize, setDragSize] = useState<{ width: number; height: number } | null>(null);

    const dragTargetPosRef = useRef<number | null>(null);
    const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const dragCleanupRef = useRef<(() => void) | null>(null);

    const moveNodeToPosition = useCallback((targetPos: number) => {
        const pos = getPos();
        if (pos === undefined || targetPos === null) return;

        const { state, dispatch } = view;
        const $pos = state.doc.resolve(pos);
        const parentPos = $pos.before($pos.depth);
        const parentNode = $pos.node($pos.depth);

        if (!parentNode) return;

        const nodeSize = parentNode.nodeSize;
        if (targetPos === parentPos || targetPos === parentPos + nodeSize) return;

        const $targetPos = state.doc.resolve(targetPos);
        const targetParent = $targetPos.parent;
        const targetIndex = $targetPos.index();

        let finalTargetPos = targetPos;

        if (!targetParent.canReplaceWith(targetIndex, targetIndex, parentNode.type)) {
            let validTargetPos: number | null = null;
            for (let d = $targetPos.depth; d >= 1; d--) {
                const ancestorPos = $targetPos.before(d);
                const ancestor = $targetPos.node(d);
                const ancestorParent = d > 1 ? $targetPos.node(d - 1) : state.doc;
                const ancestorIndex = d > 1 ? $targetPos.index(d - 1) : $targetPos.index(0);

                if (ancestorParent.canReplaceWith(ancestorIndex, ancestorIndex, parentNode.type)) {
                    const ancestorDom = view.nodeDOM(ancestorPos) as HTMLElement | null;
                    if (ancestorDom) {
                        validTargetPos = ancestorPos + ancestor.nodeSize;
                        break;
                    }
                }
            }
            if (validTargetPos === null) return;
            finalTargetPos = validTargetPos;
        }

        const tr = state.tr;
        tr.setMeta('addToHistory', true);
        tr.setMeta('scrollIntoView', false);
        tr.setMeta('imageDragMove', true);

        if (finalTargetPos > parentPos) {
            tr.delete(parentPos, parentPos + nodeSize);
            const adjustedTarget = tr.mapping.map(finalTargetPos);
            tr.insert(adjustedTarget, parentNode);
        } else {
            tr.insert(finalTargetPos, parentNode);
            const adjustedSource = tr.mapping.map(parentPos);
            tr.delete(adjustedSource, adjustedSource + nodeSize);
        }

        dispatch(tr);
    }, [view, getPos]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (isActive || loadError) return;

        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input') || target.closest('[data-resize-handle]')) {
            return;
        }

        const startX = e.clientX;
        const startY = e.clientY;
        const startTime = Date.now();
        let isLongPressTriggered = false;
        const sourcePos = getPos();
        const sourceHeight = containerRef.current?.offsetHeight || 100;
        const sourceWidth = containerRef.current?.offsetWidth || 200;

        const containerRect = containerRef.current?.getBoundingClientRect();
        const initialLeft = containerRect?.left || 0;
        const initialTop = containerRect?.top || 0;

        const onPointerMove = (moveEvent: PointerEvent) => {
            const elapsed = Date.now() - startTime;

            if (!isLongPressTriggered && elapsed >= LONG_PRESS_DELAY) {
                isLongPressTriggered = true;
                setIsDragging(true);
                setDragPosition({ x: initialLeft, y: initialTop });
                setDragSize({ width: sourceWidth, height: sourceHeight });

                if (sourcePos !== undefined) {
                    setDragState(view, {
                        isDragging: true,
                        sourcePos: sourcePos,
                        targetPos: null,
                        imageNaturalWidth: imageNaturalSize.width,
                        imageNaturalHeight: imageNaturalSize.height,
                    });
                }
            }

            if (isLongPressTriggered) {
                const deltaX = moveEvent.clientX - startX;
                const deltaY = moveEvent.clientY - startY;
                setDragPosition({ x: initialLeft + deltaX, y: initialTop + deltaY });

                if (sourcePos !== undefined) {
                    const targetPos = calculateDropPosition(view, moveEvent.clientY, sourcePos);
                    dragTargetPosRef.current = targetPos;
                    setDragState(view, { targetPos });
                }
            }
        };

        const onPointerUp = () => {
            window.removeEventListener('pointermove', onPointerMove, true);
            window.removeEventListener('pointerup', onPointerUp, true);

            if (longPressTimeoutRef.current) {
                clearTimeout(longPressTimeoutRef.current);
                longPressTimeoutRef.current = undefined;
            }

            const targetPos = dragTargetPosRef.current;
            clearDragState(view);
            setIsDragging(false);
            setDragPosition(null);
            setDragSize(null);
            dragTargetPosRef.current = null;
            dragCleanupRef.current = null;

            if (isLongPressTriggered && targetPos !== null) {
                moveNodeToPosition(targetPos);
            }
        };

        dragCleanupRef.current = onPointerUp;

        longPressTimeoutRef.current = setTimeout(() => {
            if (!isLongPressTriggered) {
                isLongPressTriggered = true;
                setIsDragging(true);
                setDragPosition({ x: initialLeft, y: initialTop });
                setDragSize({ width: sourceWidth, height: sourceHeight });

                if (sourcePos !== undefined) {
                    setDragState(view, {
                        isDragging: true,
                        sourcePos: sourcePos,
                        targetPos: null,
                        imageNaturalWidth: imageNaturalSize.width,
                        imageNaturalHeight: imageNaturalSize.height,
                    });
                }
            }
        }, LONG_PRESS_DELAY);

        window.addEventListener('pointermove', onPointerMove, true);
        window.addEventListener('pointerup', onPointerUp, true);
    }, [view, getPos, containerRef, imageNaturalSize, isActive, loadError, moveNodeToPosition]);

    const handlePointerUp = useCallback(() => {}, []);
    const handlePointerCancel = useCallback(() => {}, []);

    useEffect(() => {
        return () => {
            if (longPressTimeoutRef.current) {
                clearTimeout(longPressTimeoutRef.current);
            }
            if (dragCleanupRef.current) {
                dragCleanupRef.current();
            }
        };
    }, []);

    return {
        isDragging,
        dragPosition,
        dragSize,
        handlePointerDown,
        handlePointerUp,
        handlePointerCancel,
    };
}
