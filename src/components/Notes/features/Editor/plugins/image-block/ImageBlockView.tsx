import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { cn } from '@/lib/utils';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useToastStore } from '@/stores/useToastStore';
import { MdBrokenImage } from 'react-icons/md';

import { ImageToolbar } from './components/ImageToolbar';
import { ImageCaption } from './components/ImageCaption';
import { ImageCropper } from './components/ImageCropper';

import { useLocalImage } from './hooks/useLocalImage';
import { useImageDrag } from './hooks/useImageDrag';
import { useImageResize } from './hooks/useImageResize';
import { parseCropFragment, generateCropFragment, CropParams } from './utils/cropUtils';
import { ensureImageFileExists } from './utils/fileUtils';
import { ALIGNMENT_CLASSES, getContainerStyle, computeAspectRatio } from './utils/styleUtils';
import type { Alignment } from './types';

const HOVER_HIDE_DELAY_MS = 300;

interface ImageBlockProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
}

export const ImageBlockView = ({ node, view, getPos }: ImageBlockProps) => {
    const [width, setWidth] = useState(node.attrs.width || 'auto');
    const [height, setHeight] = useState<number | undefined>(undefined);
    const [dragDimensions, setDragDimensions] = useState<{width: number, height: number} | null>(null);
    const [observedSize, setObservedSize] = useState({ width: 0, height: 0 });
    const [isReady, setIsReady] = useState(!!node.attrs.width);
    const [naturalRatio, setNaturalRatio] = useState<number | null>(null);
    const [imageNaturalSize, setImageNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
    const [alignment, setAlignment] = useState<Alignment>((node.attrs.align as Alignment) || 'center');

    const [isHovered, setIsHovered] = useState(false);
    const [isEditingCaption, setIsEditingCaption] = useState(false);
    const [captionInput, setCaptionInput] = useState(node.attrs.alt || '');
    const [isActive, setIsActive] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [cropParams, setCropParams] = useState<CropParams | null>(null);

    const notesPath = useNotesStore(s => s.notesPath);
    const currentNotePath = useNotesStore(s => s.currentNote?.path);
    const { addToast } = useToastStore();

    const containerRef = useRef<HTMLDivElement>(null);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const { baseSrc, params: initialParams } = useMemo(() => parseCropFragment(node.attrs.src || ''), [node.attrs.src]);
    const { resolvedSrc, isLoading, error: loadError } = useLocalImage(baseSrc, notesPath, currentNotePath);

    const updateNodeAttrs = useCallback((attrs: Record<string, any>) => {
        const pos = getPos();
        if (pos !== undefined) {
            view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs }));
        }
    }, [view, getPos, node.attrs]);

    const restoreIfNeeded = useCallback(async () => {
        if (baseSrc && resolvedSrc) {
            await ensureImageFileExists(baseSrc, resolvedSrc, notesPath, currentNotePath);
        }
    }, [baseSrc, resolvedSrc, notesPath, currentNotePath]);

    const handleAlignmentChange = useCallback((newAlignment: Alignment) => {
        setAlignment(newAlignment);
        updateNodeAttrs({ align: newAlignment });
    }, [updateNodeAttrs]);

    const {
        isDragging,
        dragPosition,
        dragSize,
        dragAlignment,
        handlePointerDown,
        handlePointerUp,
        handlePointerCancel,
    } = useImageDrag({
        view,
        getPos,
        containerRef,
        imageNaturalSize,
        isActive,
        loadError: !!loadError,
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

    useEffect(() => { setCropParams(initialParams); }, [initialParams]);
    useEffect(() => { if (loadError) setIsReady(true); }, [loadError]);

    useEffect(() => {
        const newAlignment = (node.attrs.align as Alignment) || 'center';
        if (alignment !== newAlignment) {
            setAlignment(newAlignment);
        }
        const newWidth = node.attrs.width || 'auto';
        if (width !== newWidth) {
            setWidth(newWidth);
        }
    }, [node.attrs.align, node.attrs.width]);

    // Cleanup hover timeout on unmount
    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
            }
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

    const handleSave = async (percentageCrop: any, ratio: number) => {
        try {
            setIsSaving(true);
            if (baseSrc && resolvedSrc) {
                await ensureImageFileExists(baseSrc, resolvedSrc, notesPath, currentNotePath);
            }
            const fragment = generateCropFragment(percentageCrop, ratio);
            setCropParams({ x: percentageCrop.x, y: percentageCrop.y, width: percentageCrop.width, height: percentageCrop.height, ratio });
            updateNodeAttrs({ src: `${baseSrc}#${fragment}` });
            setIsActive(false);
            setHeight(undefined);
        } catch (error) {
            console.error('Save failed:', error);
            addToast('Failed to update view', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopy = async () => {
        try {
            await restoreIfNeeded();
            if (resolvedSrc) {
                const response = await fetch(resolvedSrc);
                const blob = await response.blob();
                await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            } else {
                await navigator.clipboard.writeText(node.attrs.src || '');
            }
        } catch {
            try { await navigator.clipboard.writeText(node.attrs.src || ''); } catch { /* fallback failed */ }
        }
    };

    const handleDownload = async () => {
        if (!resolvedSrc) return;
        try {
            await restoreIfNeeded();
            const { save } = await import('@tauri-apps/plugin-dialog');
            const { writeFile } = await import('@tauri-apps/plugin-fs');
            const ext = baseSrc.split('.').pop()?.split('?')[0] || 'png';
            const defaultName = (node.attrs.alt || 'image') + '.' + ext;
            const filePath = await save({ defaultPath: defaultName, filters: [{ name: 'Images', extensions: ['png', 'jpg', 'webp'] }] });
            if (!filePath) return;
            const response = await fetch(resolvedSrc);
            const blob = await response.blob();
            await writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
        } catch {
            const link = document.createElement('a');
            link.href = resolvedSrc;
            link.download = node.attrs.alt || 'image';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDelete = () => {
        const pos = getPos();
        if (pos !== undefined) {
            view.dispatch(view.state.tr.delete(pos, pos + node.nodeSize));
        }
    };

    const handleCaptionSubmit = async () => {
        setIsEditingCaption(false);
        if (captionInput !== node.attrs.alt) {
            await restoreIfNeeded();
            updateNodeAttrs({ alt: captionInput });
        }
    };

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

    return (
        <>
            {isDragging && dragPosition && dragSize && (
                <div
                    style={{
                        position: 'fixed',
                        top: dragPosition.y,
                        width: dragSize.width,
                        height: dragSize.height,
                        zIndex: 9999,
                        pointerEvents: 'none',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        ...DRAG_ALIGNMENT_STYLES[dragAlignment],
                    }}
                >
                    <ImageCropper
                        imageSrc={resolvedSrc}
                        initialCropParams={cropParams}
                        containerSize={dragSize}
                        onSave={() => {}}
                        onCancel={() => {}}
                        isSaving={false}
                        isActive={false}
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
                {(isLoading || !resolvedSrc) && !isReady ? (
                    <div className="w-full h-full min-h-[100px] flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 rounded-md">
                        <div className="size-6 border-2 border-gray-300 dark:border-zinc-600 border-t-[var(--neko-accent)] rounded-full animate-spin" />
                    </div>
                ) : loadError ? (
                    <div className="w-full h-full min-h-[100px] flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 border border-dashed border-gray-200 dark:border-zinc-700 rounded-md text-gray-400 dark:text-zinc-500">
                        <MdBrokenImage className="size-8 mb-2 opacity-50" />
                        <span className="text-xs font-medium">Image not found</span>
                    </div>
                ) : (
                    <ImageCropper
                        imageSrc={resolvedSrc}
                        initialCropParams={cropParams}
                        containerSize={finalContainerSize}
                        onSave={handleSave}
                        onCancel={() => { setIsActive(false); setHeight(undefined); }}
                        isSaving={isSaving}
                        isActive={isActive}
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
                )}

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
                    onAlign={async (align) => { await restoreIfNeeded(); handleAlignmentChange(align); }}
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
