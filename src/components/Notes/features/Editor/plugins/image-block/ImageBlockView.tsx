import { useRef, useCallback } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
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

export const ImageBlockView = ({ node, view, getPos }: ImageBlockProps) => {
    const latestStateRef = useRef<CropperViewportState | null>(null);

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
        isLoading,
        loadError,
        notesPath,
        currentNotePath,
        updateNodeAttrs,
    } = useImageBlockState({ node, view, getPos });

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
        setCropParams,
        setIsActive,
        setHeight,
    });

    const {
        containerRef,
        setDragDimensions,
        finalContainerSize,
        handleMouseEnter,
        handleMouseLeave,
    } = useImageBlockFrame({
        height,
        isEditingCaption,
        isActive,
        setIsHovered,
    });

    const { handleResizeStart } = useImageResize({
        containerRef,
        width,
        height,
        setWidth,
        setHeight,
        setDragDimensions,
        updateNodeAttrs,
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
    const containerStyle = getContainerStyle(isDragging, dragPosition, dragSize, {
        width,
        height,
        isActive,
        isReady,
        computedAspectRatio,
    });

    const handleCaptionSubmit = useCallback(async () => {
        setIsEditingCaption(false);
        if (captionInput !== nodeAlt) {
            await restoreIfNeeded();
            updateNodeAttrs({ alt: captionInput });
        }
    }, [captionInput, nodeAlt, restoreIfNeeded, setIsEditingCaption, updateNodeAttrs]);

    const handleCaptionCancel = useCallback(() => {
        setIsEditingCaption(false);
        setCaptionInput(nodeAlt);
    }, [nodeAlt, setCaptionInput, setIsEditingCaption]);

    const handleAlign = useCallback(async (align: 'left' | 'center' | 'right') => {
        await restoreIfNeeded();
        setAlignment(align);
        updateNodeAttrs({ align });
    }, [restoreIfNeeded, setAlignment, updateNodeAttrs]);

    const handleEdit = useCallback(async () => {
        await restoreIfNeeded();
        setIsActive(true);
    }, [restoreIfNeeded, setIsActive]);

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
                    WRAPPER_ALIGNMENT_CLASSES[alignment],
                    isDragging && 'hidden',
                )}
            >
                <div
                    ref={containerRef}
                    data-dragging={isDragging ? 'true' : undefined}
                    draggable={false}
                    className={cn(
                        'relative flex flex-col leading-none text-[0px] select-none',
                        (isHovered || isEditingCaption || isActive) ? 'z-10' : '',
                    )}
                    style={containerStyle}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onPointerDown={handlePointerDown}
                    onDragStart={(e) => e.preventDefault()}
                >
                    <ImageContent
                        isLoading={isLoading}
                        loadError={!!loadError}
                        resolvedSrc={resolvedSrc}
                        isReady={isReady}
                        cropParams={cropParams}
                        containerSize={finalContainerSize}
                        isSaving={isSaving}
                        isActive={isActive}
                        onSave={handleSave}
                        onCancel={() => {
                            setIsActive(false);
                            setHeight(undefined);
                        }}
                        onResizeStart={handleResizeStart}
                        onMediaLoaded={onMediaLoaded}
                        onStateChange={handleStateChange}
                    />

                    <ImageBlockChrome
                        nodeAlt={nodeAlt}
                        captionInput={captionInput}
                        isEditingCaption={isEditingCaption}
                        isHovered={isHovered}
                        isActive={isActive}
                        isDragging={isDragging}
                        loadError={!!loadError}
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
