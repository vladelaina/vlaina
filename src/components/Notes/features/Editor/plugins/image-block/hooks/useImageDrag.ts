import { useRef, useState, useCallback, useEffect } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { setDragState, clearDragState, calculateDropPosition, calculateAlignmentFromPosition, imageDragPluginKey } from '../imageDragPlugin';
import type { Alignment } from '../types';

const LONG_PRESS_DELAY_MS = 300;

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
    dragAlignment: Alignment;
    handlePointerDown: (e: React.PointerEvent) => void;
    handlePointerUp: () => void;
    handlePointerCancel: () => void;
}

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
    const [dragAlignment, setDragAlignment] = useState<Alignment>('center');

    const dragTargetPosRef = useRef<number | null>(null);
    const dragAlignmentRef = useRef<Alignment>('center');
    const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const dragCleanupRef = useRef<(() => void) | null>(null);

    const moveNodeToPosition = useCallback((targetPos: number, newAlignment?: Alignment) => {
        const pos = getPos();
        if (pos === undefined || targetPos === null) return;

        const { state, dispatch } = view;
        const imageNode = state.doc.nodeAt(pos);
        if (!imageNode || imageNode.type.name !== 'image') {
            return;
        }

        const imageNodeSize = imageNode.nodeSize;
        if (targetPos === pos || targetPos === pos + imageNodeSize) {
            return;
        }

        const currentWidth = imageNode.attrs.width;
        const containerWidth = containerRef.current?.offsetWidth;
        const parentWidth = containerRef.current?.parentElement?.offsetWidth;
        
        let preservedWidth = currentWidth;
        if (!preservedWidth && containerWidth && parentWidth) {
            const calculatedPercent = (containerWidth / parentWidth) * 100;
            preservedWidth = `${Math.min(100, calculatedPercent)}%`;
        }
        
        if (!preservedWidth) {
            preservedWidth = null;
        }

        const updatedAttrs = {
            ...imageNode.attrs,
            align: (newAlignment || imageNode.attrs.align || 'center') as Alignment,
            width: preservedWidth
        };

        const tr = state.tr;
        tr.setMeta('addToHistory', true);
        tr.setMeta('scrollIntoView', false);
        tr.setMeta('imageDragMove', true);
        tr.setMeta(imageDragPluginKey, {
            sourcePos: null,
            targetPos: null,
            isDragging: false,
            editorView: null,
            alignment: 'center',
        });

        if (targetPos > pos) {
            const slice = state.doc.slice(pos, pos + imageNodeSize);
            tr.delete(pos, pos + imageNodeSize);
            const adjustedTarget = tr.mapping.map(targetPos);
            tr.insert(adjustedTarget, slice.content);
            const insertedPos = adjustedTarget;
            tr.setNodeMarkup(insertedPos, undefined, updatedAttrs);
        } else {
            const slice = state.doc.slice(pos, pos + imageNodeSize);
            tr.insert(targetPos, slice.content);
            tr.setNodeMarkup(targetPos, undefined, updatedAttrs);
            const adjustedSource = tr.mapping.map(pos);
            tr.delete(adjustedSource, adjustedSource + imageNodeSize);
        }

        dispatch(tr);
    }, [view, getPos, containerRef]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (isActive || loadError) return;

        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input') || target.closest('[data-resize-handle]')) {
            return;
        }

        if (e.ctrlKey || e.metaKey) {
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

        const triggerDragStart = () => {
            isLongPressTriggered = true;
            document.documentElement.classList.add('dragging-image');
            setIsDragging(true);
            setDragPosition({ x: initialLeft, y: initialTop });
            setDragSize({ width: sourceWidth, height: sourceHeight });

            if (sourcePos !== undefined) {
                setDragState(view, {
                    isDragging: true,
                    sourcePos: sourcePos,
                    targetPos: sourcePos,
                    imageNaturalWidth: imageNaturalSize.width,
                    imageNaturalHeight: imageNaturalSize.height,
                    editorView: view,
                    alignment: 'center',
                });
            }
        };

        const onPointerMove = (moveEvent: PointerEvent) => {
            if (moveEvent.ctrlKey || moveEvent.metaKey) {
                if (longPressTimeoutRef.current) {
                    clearTimeout(longPressTimeoutRef.current);
                    longPressTimeoutRef.current = undefined;
                }
                return;
            }

            const elapsed = Date.now() - startTime;

            if (!isLongPressTriggered && elapsed >= LONG_PRESS_DELAY_MS) {
                triggerDragStart();
            }

            if (isLongPressTriggered) {
                const deltaX = moveEvent.clientX - startX;
                const deltaY = moveEvent.clientY - startY;
                setDragPosition({ x: initialLeft + deltaX, y: initialTop + deltaY });

                const alignment = calculateAlignmentFromPosition(view, moveEvent.clientX);
                dragAlignmentRef.current = alignment;
                setDragAlignment(alignment);

                const placeholder = document.querySelector('.image-drag-placeholder') as HTMLElement;
                if (placeholder) {
                    const marginMap = {
                        left: '8px auto 8px 0',
                        center: '8px auto',
                        right: '8px 0 8px auto',
                    };
                    placeholder.style.margin = marginMap[alignment];
                }

                if (sourcePos !== undefined) {
                    const targetPos = calculateDropPosition(view, moveEvent.clientY, sourcePos);
                    if (targetPos !== null) {
                        dragTargetPosRef.current = targetPos;
                    }
                    const finalTargetPos = dragTargetPosRef.current !== null ? dragTargetPosRef.current : sourcePos;
                    
                    setDragState(view, { 
                        isDragging: true,
                        sourcePos: sourcePos,
                        targetPos: finalTargetPos, 
                        alignment,
                        imageNaturalWidth: imageNaturalSize.width,
                        imageNaturalHeight: imageNaturalSize.height,
                        editorView: view,
                    });
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
            const finalAlignment = dragAlignmentRef.current;

            if (isLongPressTriggered && targetPos !== null) {
                moveNodeToPosition(targetPos, finalAlignment);
            }

            clearDragState(view);

            setIsDragging(false);
            setDragPosition(null);
            setDragSize(null);
            setDragAlignment('center');
            dragTargetPosRef.current = null;
            dragAlignmentRef.current = 'center';
            dragCleanupRef.current = null;
        };

        dragCleanupRef.current = onPointerUp;

        longPressTimeoutRef.current = setTimeout(() => {
            if (!isLongPressTriggered) {
                triggerDragStart();
            }
        }, LONG_PRESS_DELAY_MS);

        window.addEventListener('pointermove', onPointerMove, true);
        window.addEventListener('pointerup', onPointerUp, true);
    }, [view, getPos, containerRef, imageNaturalSize, isActive, loadError, moveNodeToPosition]);

    // Empty handlers for React event binding
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
        dragAlignment,
        handlePointerDown,
        handlePointerUp,
        handlePointerCancel,
    };
}
