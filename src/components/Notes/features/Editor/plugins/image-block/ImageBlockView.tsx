import { useRef, useEffect, useState } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { cn } from '@/lib/utils';
import { ALIGNMENT_CLASSES, getContainerStyle, computeAspectRatio } from './utils/styleUtils';
import { ImageToolbar } from './components/ImageToolbar';
import { ImageCaption } from './components/ImageCaption';
import { ImageCropper } from './components/ImageCropper';
import { ImageContent } from './components/ImageContent';

import { useImageBlockState } from './hooks/useImageBlockState';
import { useImageActions } from './hooks/useImageActions';
import { useImageDrag } from './hooks/useImageDrag';
import { useImageResize } from './hooks/useImageResize';

const HOVER_HIDE_DELAY_MS = 300;

interface ImageBlockProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
}

export const ImageBlockView = ({ node, view, getPos }: ImageBlockProps) => {
    // 1. State
    const {
        width, setWidth,
        height, setHeight,
        alignment, setAlignment,
        captionInput, setCaptionInput,
        isHovered, setIsHovered,
        isEditingCaption, setIsEditingCaption,
        isActive, setIsActive,
        isReady, setIsReady,
        naturalRatio, setNaturalRatio,
        imageNaturalSize, setImageNaturalSize,
        cropParams, setCropParams,
        baseSrc, resolvedSrc, isLoading, loadError,
        notesPath, currentNotePath,
        updateNodeAttrs
    } = useImageBlockState({ node, view, getPos });

    // 2. Actions
    const {
        isSaving, handleSave, handleCopy, handleDownload, handleDelete, restoreIfNeeded
    } = useImageActions({
        node, view, getPos, baseSrc, resolvedSrc, notesPath, currentNotePath,
        updateNodeAttrs, setCropParams, setIsActive, setHeight
    });

    const containerRef = useRef<HTMLDivElement>(null);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const [dragDimensions, setDragDimensions] = useState<{width: number, height: number} | null>(null);
    const [observedSize, setObservedSize] = useState({ width: 0, height: 0 });

    // 3. Resize Logic
    const { handleResizeStart } = useImageResize({
        containerRef, width, height, setWidth, setHeight, setDragDimensions,
        updateNodeAttrs, restoreIfNeeded
    });

    // 4. Drag Logic
    const {
        isDragging, dragPosition, dragSize, dragAlignment,
        handlePointerDown, handlePointerUp, handlePointerCancel,
    } = useImageDrag({
        view, getPos, containerRef, imageNaturalSize, isActive, loadError: !!loadError,
    });

    // 5. Container Size Observer
    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setObservedSize(prev => {
                    if (Math.abs(prev.width - width) > 0.5 || Math.abs(prev.height - height) > 0.5) {
                        return { width, height };
                    }
                    return prev;
                });
            }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    // 6. Hover Logic
    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        };
    }, []);

    const handleMouseEnter = () => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = undefined;
        }
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        if (isEditingCaption || isActive) return;
        hoverTimeoutRef.current = setTimeout(() => setIsHovered(false), HOVER_HIDE_DELAY_MS);
    };

    // 7. Computed Styles
    const computedAspectRatio = computeAspectRatio(height, cropParams, naturalRatio);
    const containerStyle = getContainerStyle(isDragging, dragPosition, dragSize, {
        width, height, isActive, isReady, computedAspectRatio
    });

    const finalContainerSize = dragDimensions || {
        width: observedSize.width || containerRef.current?.offsetWidth || 0,
        height: height || observedSize.height || containerRef.current?.offsetHeight || 0
    };

    const DRAG_ALIGNMENT_STYLES: Record<'left' | 'center' | 'right', React.CSSProperties> = {
        left: { left: dragPosition?.x },
        center: { left: dragPosition?.x },
        right: { left: dragPosition?.x },
    };

    const handleCaptionSubmit = async () => {
        setIsEditingCaption(false);
        if (captionInput !== node.attrs.alt) {
            await restoreIfNeeded();
            updateNodeAttrs({ alt: captionInput });
        }
    };

    return (
        <>
            {isDragging && dragPosition && dragSize && (
                <div
                    style={{
                        position: 'fixed', top: dragPosition.y,
                        width: dragSize.width, height: dragSize.height,
                        zIndex: 9999, pointerEvents: 'none',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        borderRadius: '8px', overflow: 'hidden',
                        ...DRAG_ALIGNMENT_STYLES[dragAlignment],
                    }}
                >
                    <ImageCropper
                        imageSrc={resolvedSrc} initialCropParams={cropParams}
                        containerSize={dragSize}
                        onSave={() => {}} onCancel={() => {}}
                        isSaving={false} isActive={false}
                    />
                </div>
            )}
            
            <div className={cn("w-full flex my-2 justify-center group/image", isDragging && "hidden")}>
                <div
                    ref={containerRef}
                    data-dragging={isDragging ? "true" : undefined}
                    draggable={false}
                    className={cn(
                        "relative flex flex-col leading-none text-[0px] select-none",
                        ALIGNMENT_CLASSES[alignment],
                        (isHovered || isEditingCaption || isActive) ? "z-10" : ""
                    )}
                    style={containerStyle}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
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
                        onCancel={() => { setIsActive(false); setHeight(undefined); }}
                        onResizeStart={handleResizeStart}
                        onMediaLoaded={(media) => {
                            setNaturalRatio(media.naturalWidth / media.naturalHeight);
                            setImageNaturalSize({ width: media.naturalWidth, height: media.naturalHeight });

                            if (node.attrs.width === undefined) {
                                const containerWidth = containerRef.current?.parentElement?.offsetWidth;
                                if (containerWidth) {
                                    const percent = (media.naturalWidth / containerWidth) * 100;
                                    const finalPercent = Math.min(100, percent);
                                    setWidth(`${finalPercent}%`);
                                    updateNodeAttrs({ width: `${finalPercent}%` });
                                }
                            }

                            if (!node.attrs.alt) {
                                try {
                                    const url = node.attrs.src.split('#')[0];
                                    const filename = url.substring(url.lastIndexOf('/') + 1);
                                    if (filename) {
                                        const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
                                        updateNodeAttrs({ alt: nameWithoutExt });
                                        setCaptionInput(nameWithoutExt);
                                    }
                                } catch (e) { /* ignore */ }
                            }
                            setIsReady(true);
                        }}
                    />

                    {(isHovered || isEditingCaption) && !isActive && !loadError && !isDragging && (
                        <ImageCaption
                            originalAlt={node.attrs.alt || ''}
                            value={captionInput}
                            isEditing={isEditingCaption}
                            isVisible={true}
                            onChange={setCaptionInput}
                            onSubmit={handleCaptionSubmit}
                            onCancel={() => { setIsEditingCaption(false); setCaptionInput(node.attrs.alt || ''); }}
                            onEditStart={() => setIsEditingCaption(true)}
                        />
                    )}

                    <ImageToolbar
                        alignment={alignment}
                        onAlign={async (align) => { await restoreIfNeeded(); setAlignment(align); updateNodeAttrs({ align }); }}
                        onEdit={async () => { await restoreIfNeeded(); setIsActive(true); }}
                        onCopy={handleCopy}
                        onDownload={handleDownload}
                        onDelete={handleDelete}
                        isVisible={(isHovered || isEditingCaption) && !isActive && !isDragging}
                    />
                </div>
            </div>
        </>
    );
};