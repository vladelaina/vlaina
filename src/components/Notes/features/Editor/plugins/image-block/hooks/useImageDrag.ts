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
        const imageNode = state.doc.nodeAt(pos);

        if (!imageNode || imageNode.type.name !== 'image') return;

        const imageNodeSize = imageNode.nodeSize;
        if (targetPos === pos || targetPos === pos + imageNodeSize) return;

        const tr = state.tr;
        tr.setMeta('addToHistory', true);
        tr.setMeta('scrollIntoView', false);
        tr.setMeta('imageDragMove', true);

        const paragraphType = state.schema.nodes.paragraph;
        const newParagraph = paragraphType.create(null, imageNode);

        if (targetPos > pos) {
            tr.delete(pos, pos + imageNodeSize);
            const adjustedTarget = tr.mapping.map(targetPos);
            tr.insert(adjustedTarget, newParagraph);
        } else {
            tr.insert(targetPos, newParagraph);
            const adjustedSource = tr.mapping.map(pos);
            tr.delete(adjustedSource, adjustedSource + imageNodeSize);
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
                document.documentElement.classList.add('dragging-image');
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
            document.documentElement.classList.remove('dragging-image');

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
                document.documentElement.classList.add('dragging-image');
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
