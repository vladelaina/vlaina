import { useRef, useCallback, useEffect, useState } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { NodeSelection } from '@milkdown/kit/prose/state';
import { cn } from '@/lib/utils';
import { getContainerStyle, computeAspectRatio } from './utils/styleUtils';
import { ImageContent } from './components/ImageContent';
import { ImageDragOverlay } from './components/ImageDragOverlay';
import { ImageBlockChrome } from './components/ImageBlockChrome';
import { useImageBlockState } from './hooks/useImageBlockState';
import { useImageActions } from './hooks/useImageActions';
import { useImageBlockFrame } from './hooks/useImageBlockFrame';
import { useImageDrag } from './hooks/useImageDrag';
import { useImageResize } from './hooks/useImageResize';
import { useImageMediaLifecycle } from './hooks/useImageMediaLifecycle';
import { useBlockDragState } from './hooks/useBlockDragState';
import { useNearViewport } from './hooks/useNearViewport';
import type { CropperViewportState } from './types';

const WRAPPER_ALIGNMENT_CLASSES: Record<'left' | 'center' | 'right', string> = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
};

interface ImageBlockProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
}

interface LockedEditFrame {
    width: number;
    height: number;
    left: number;
}

export const ImageBlockView = ({ node, view, getPos }: ImageBlockProps) => {
    const latestStateRef = useRef<CropperViewportState | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [lockedEditFrame, setLockedEditFrame] = useState<LockedEditFrame | null>(null);
    const [mediaLoadError, setMediaLoadError] = useState(false);
    const isBlockDragging = useBlockDragState();
    const isNearViewport = useNearViewport(containerRef);

    const handleStateChange = useCallback((state: CropperViewportState) => {
        latestStateRef.current = state;
    }, []);

    const {
        nodeSrc,
        nodeAlt,
        width,
        setWidth,
        height,
        setHeight,
        alignment,
        setAlignment,
        captionInput,
        setCaptionInput,
        isHovered,
        setIsHovered,
        isEditingCaption,
        setIsEditingCaption,
        isActive,
        setIsActive,
        isReady,
        setIsReady,
        naturalRatio,
        setNaturalRatio,
        cropParams,
        setCropParams,
        baseSrc,
        resolvedSrc,
        isRemoteImageSource,
        isLoading,
        loadError,
        isImageLoadDeferred,
        notesPath,
        currentNotePath,
        updateNodeAttrs,
        markImageUserInput,
    } = useImageBlockState({ node, view, getPos, shouldLoadImage: isNearViewport });

    const {
        isSaving,
        handleSave,
        handleCopy,
        handleDownload,
        handleDelete,
        restoreIfNeeded,
    } = useImageActions({
        node,
        view,
        getPos,
        baseSrc,
        resolvedSrc,
        notesPath,
        currentNotePath,
        updateNodeAttrs,
        markImageUserInput,
        setCropParams,
        setIsActive,
        setHeight,
    });

    const {
        setDragDimensions,
        finalContainerSize,
        handleMouseEnter,
        handleMouseLeave,
    } = useImageBlockFrame({
        height,
        isEditingCaption,
        isActive,
        isHoverDisabled: isBlockDragging,
        setIsHovered,
        containerRef,
    });

    const { handleResizeStart } = useImageResize({
        containerRef,
        width,
        height,
        setWidth,
        setHeight,
        setDragDimensions,
        updateNodeAttrs,
        markImageUserInput,
        restoreIfNeeded,
    });

    const { onMediaLoaded } = useImageMediaLifecycle({
        width,
        nodeSrc,
        nodeAlt,
        containerRef,
        setWidth,
        setCaptionInput,
        setNaturalRatio,
        setIsReady,
        updateNodeAttrs,
    });

    const {
        isDragging,
        dragPosition,
        dragSize,
        handlePointerDown,
    } = useImageDrag({
        view,
        getPos,
        containerRef,
        isActive,
        loadError: !!loadError,
        currentAlignment: alignment,
    });

    const computedAspectRatio = computeAspectRatio(height, cropParams, naturalRatio);
    const lockedEditSize = lockedEditFrame
        ? { width: lockedEditFrame.width, height: lockedEditFrame.height }
        : null;
    const activeContainerSize = isActive && lockedEditSize ? lockedEditSize : finalContainerSize;
    const containerStyle = getContainerStyle(isDragging, dragPosition, dragSize, {
        width,
        height,
        isActive,
        isReady,
        computedAspectRatio,
        activeSize: lockedEditSize,
    });
    const positionedContainerStyle = isActive && lockedEditFrame && !isDragging
        ? {
            ...containerStyle,
            marginLeft: `${lockedEditFrame.left}px`,
        }
        : containerStyle;
    const hasLoadError = !!loadError || mediaLoadError;

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

    const handleAlign = useCallback(async (align: 'left' | 'center' | 'right') => {
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
        finalContainerSize,
        markImageUserInput,
        restoreIfNeeded,
        setIsActive,
        setHeight,
    ]);

    const handleSelect = useCallback((event: React.MouseEvent) => {
        const target = event.target as HTMLElement;
        if (
            target.closest('button')
            || target.closest('input')
            || target.closest('[data-resize-handle]')
            || isActive
        ) {
            return;
        }

        const pos = getPos();
        if (pos === undefined) return;

        const selection = NodeSelection.create(view.state.doc, pos);
        view.dispatch(view.state.tr.setSelection(selection));
        view.focus();
    }, [getPos, isActive, view]);

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

    return (
        <>
            <ImageDragOverlay
                isDragging={isDragging}
                dragPosition={dragPosition}
                dragSize={dragSize}
                resolvedSrc={resolvedSrc}
                cropParams={cropParams}
                overrideState={latestStateRef.current}
            />

            <div
                className={cn(
                    'w-full flex group/image',
                    isActive && lockedEditFrame ? 'justify-start' : WRAPPER_ALIGNMENT_CLASSES[alignment],
                    isDragging && 'hidden',
                )}
            >
                <div
                    ref={containerRef}
                    data-dragging={isDragging ? 'true' : undefined}
                    draggable={false}
                    className={cn(
                        'relative flex flex-col leading-none text-[0px] select-none',
                        (isHovered || isEditingCaption || isActive) && !isBlockDragging ? 'z-10' : '',
                    )}
                    style={positionedContainerStyle}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onPointerDown={handlePointerDown}
                    onClick={handleSelect}
                    onDragStart={(e) => e.preventDefault()}
                >
                    <ImageContent
                        isLoading={isLoading}
                        loadError={hasLoadError}
                        resolvedSrc={resolvedSrc}
                        isRemoteImageSource={isRemoteImageSource}
                        isDeferred={isImageLoadDeferred}
                        isReady={isReady}
                        cropParams={cropParams}
                        containerSize={activeContainerSize}
                        isSaving={isSaving}
                        isActive={isActive}
                        onSave={handleSave}
                        onCancel={() => {
                            setIsActive(false);
                            setHeight(undefined);
                        }}
                        onResizeStart={handleResizeStart}
                        onMediaLoaded={onMediaLoaded}
                        onMediaErrorChange={setMediaLoadError}
                        onStateChange={handleStateChange}
                    />

                    <ImageBlockChrome
                        nodeAlt={nodeAlt}
                        captionInput={captionInput}
                        isEditingCaption={isEditingCaption}
                        isHovered={isHovered && !isBlockDragging}
                        isActive={isActive}
                        isDragging={isDragging || isBlockDragging}
                        loadError={hasLoadError}
                        alignment={alignment}
                        onCaptionChange={setCaptionInput}
                        onCaptionSubmit={handleCaptionSubmit}
                        onCaptionCancel={handleCaptionCancel}
                        onCaptionEditStart={() => setIsEditingCaption(true)}
                        onAlign={handleAlign}
                        onEdit={handleEdit}
                        onCopy={handleCopy}
                        onDownload={handleDownload}
                        onDelete={handleDelete}
                    />
                </div>
            </div>
        </>
    );
};
