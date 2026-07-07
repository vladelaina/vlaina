import { useCallback, useEffect, useState } from 'react';
import type { MouseEvent, RefObject } from 'react';

type ImageAlignment = 'left' | 'center' | 'right';

interface LockedEditFrame {
    width: number;
    height: number;
    left: number;
}

interface ImageBlockViewHandlersOptions {
    captionInput: string;
    nodeAlt: string;
    finalContainerSize: { width: number; height: number };
    containerRef: RefObject<HTMLDivElement | null>;
    isActive: boolean;
    isDragging: boolean;
    isBlockDragging: boolean;
    hasLoadError: boolean;
    resolvedSrc: string | null;
    markImageUserInput: () => void;
    restoreIfNeeded: () => Promise<void>;
    updateNodeAttrs: (attrs: { alt?: string; align?: ImageAlignment }) => void;
    setCaptionInput: (value: string) => void;
    setIsEditingCaption: (value: boolean) => void;
    setAlignment: (value: ImageAlignment) => void;
    setHeight: (value: number | undefined) => void;
    setIsActive: (value: boolean) => void;
    setIsHovered: (value: boolean) => void;
}

export function useImageBlockViewHandlers(options: ImageBlockViewHandlersOptions) {
    const {
        captionInput,
        nodeAlt,
        finalContainerSize,
        containerRef,
        isActive,
        isDragging,
        isBlockDragging,
        hasLoadError,
        resolvedSrc,
        markImageUserInput,
        restoreIfNeeded,
        updateNodeAttrs,
        setCaptionInput,
        setIsEditingCaption,
        setAlignment,
        setHeight,
        setIsActive,
        setIsHovered,
    } = options;
    const [lockedEditFrame, setLockedEditFrame] = useState<LockedEditFrame | null>(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);

    const handleCaptionSubmit = useCallback(async () => {
        setIsEditingCaption(false);
        if (captionInput !== nodeAlt) {
            markImageUserInput();
            await restoreIfNeeded();
            updateNodeAttrs({ alt: captionInput });
        }
    }, [captionInput, markImageUserInput, nodeAlt, restoreIfNeeded, setIsEditingCaption, updateNodeAttrs]);

    const handleCaptionCancel = useCallback(() => {
        setIsEditingCaption(false);
        setCaptionInput(nodeAlt);
    }, [nodeAlt, setCaptionInput, setIsEditingCaption]);

    const handleAlign = useCallback(async (align: ImageAlignment) => {
        markImageUserInput();
        await restoreIfNeeded();
        setAlignment(align);
        updateNodeAttrs({ align });
    }, [markImageUserInput, restoreIfNeeded, setAlignment, updateNodeAttrs]);

    const handleEdit = useCallback(async () => {
        await restoreIfNeeded();
        markImageUserInput();
        if (finalContainerSize.width > 0 && finalContainerSize.height > 0) {
            const elementRect = containerRef.current?.getBoundingClientRect();
            const parentRect = containerRef.current?.parentElement?.getBoundingClientRect();
            const left = elementRect && parentRect
                ? Math.max(0, elementRect.left - parentRect.left)
                : 0;
            const nextSize = {
                width: finalContainerSize.width,
                height: finalContainerSize.height,
                left,
            };
            setLockedEditFrame(nextSize);
            setHeight(nextSize.height);
        }
        setIsActive(true);
    }, [
        containerRef,
        finalContainerSize,
        markImageUserInput,
        restoreIfNeeded,
        setHeight,
        setIsActive,
    ]);

    const handleOpenViewer = useCallback((event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (
            target.closest('button')
            || target.closest('input')
            || target.closest('[data-resize-handle]')
            || isActive
            || isDragging
            || isBlockDragging
            || hasLoadError
            || !resolvedSrc
        ) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        setIsViewerOpen(true);
    }, [hasLoadError, isActive, isBlockDragging, isDragging, resolvedSrc]);

    useEffect(() => {
        if (!isBlockDragging) return;
        setIsHovered(false);
        setIsEditingCaption(false);
    }, [isBlockDragging, setIsHovered, setIsEditingCaption]);

    useEffect(() => {
        if (!isActive && lockedEditFrame) {
            setLockedEditFrame(null);
        }
    }, [isActive, lockedEditFrame]);

    return {
        lockedEditFrame,
        isViewerOpen,
        setIsViewerOpen,
        handleCaptionSubmit,
        handleCaptionCancel,
        handleAlign,
        handleEdit,
        handleOpenViewer,
    };
}
