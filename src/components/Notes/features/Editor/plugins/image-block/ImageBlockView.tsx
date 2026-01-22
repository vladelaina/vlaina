import React, { useRef, useState, useEffect, useMemo } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { cn } from '@/lib/utils';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useToastStore } from '@/stores/useToastStore';

// Internal Components
import { ImageToolbar } from './components/ImageToolbar';
import { ImageCaption } from './components/ImageCaption';
import { ResizeHandles } from './components/ResizeHandles';
import { ImageCropper } from './components/ImageCropper';

// Hooks & Utils
import { useLocalImage } from './hooks/useLocalImage';
import { parseCropFragment, generateCropFragment, getCropViewStyles, CropParams } from './utils/cropUtils';

interface ImageBlockProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
}

type Alignment = 'left' | 'center' | 'right';

export const ImageBlockView = ({ node, view, getPos }: ImageBlockProps) => {
    // --- State ---
    const [width, setWidth] = useState(node.attrs.width || '100%');
    const [alignment, setAlignment] = useState<Alignment>('center');
    const [isHovered, setIsHovered] = useState(false);
    
    // Caption State
    const [isEditingCaption, setIsEditingCaption] = useState(false);
    const [captionInput, setCaptionInput] = useState(node.attrs.alt || '');

    // Editor/Cropper State
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [cropParams, setCropParams] = useState<CropParams | null>(null);

    // --- Stores ---
    const notesPath = useNotesStore(s => s.notesPath);
    const currentNotePath = useNotesStore(s => s.currentNote?.path);
    const { addToast } = useToastStore();

    // --- Refs ---
    const containerRef = useRef<HTMLDivElement>(null);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // --- Data Resolution ---
    const { baseSrc, params: initialParams } = useMemo(() => parseCropFragment(node.attrs.src || ''), [node.attrs.src]);
    const { resolvedSrc } = useLocalImage(baseSrc, notesPath, currentNotePath);

    // Sync crop params state with URL changes
    useEffect(() => {
        setCropParams(initialParams);
    }, [initialParams]);

    // --- Handlers ---

    const handleMouseEnter = () => {
        if (isEditing) return;
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = undefined;
        }
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        if (isEditingCaption || isEditing) return;
        hoverTimeoutRef.current = setTimeout(() => setIsHovered(false), 300);
    };

    const updateNodeAttrs = (attrs: Record<string, any>) => {
        const pos = getPos();
        if (pos !== undefined) {
            view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                ...attrs
            }));
        }
    };

    const handleAlign = (align: Alignment) => {
        setAlignment(align);
    };

    const handleEditStart = () => {
        setIsEditing(true);
        setIsHovered(false);
    };

    const handleEditSave = async (percentageCrop: any, ratio: number) => {
        try {
            setIsSaving(true);
            const fragment = generateCropFragment(percentageCrop, ratio);
            
            // Optimistic update of local state to prevent flicker
            setCropParams({
                x: percentageCrop.x,
                y: percentageCrop.y,
                width: percentageCrop.width,
                height: percentageCrop.height,
                ratio: ratio
            });

            updateNodeAttrs({ src: `${baseSrc}#${fragment}` });
            setIsEditing(false);
        } catch (error) {
            console.error('Save failed:', error);
            addToast('Failed to update view', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleResizeStart = (direction: 'left' | 'right') => (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startWidth = containerRef.current?.offsetWidth || 0;
        const parentWidth = containerRef.current?.parentElement?.offsetWidth || 1;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const delta = direction === 'right' ? moveEvent.clientX - startX : startX - moveEvent.clientX;
            const newWidthPx = startWidth + delta * 2;
            const newWidthPercent = Math.min(100, Math.max(10, (newWidthPx / parentWidth) * 100));
            setWidth(`${newWidthPercent}%`);
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            updateNodeAttrs({ width: width });
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(node.attrs.src);
            addToast('Link copied to clipboard', 'success');
        } catch (err) {
            console.error(err);
        }
    };

    const handleDownload = async () => {
        try {
            const { save } = await import('@tauri-apps/plugin-dialog');
            const { writeFile } = await import('@tauri-apps/plugin-fs');
            const ext = baseSrc.split('.').pop()?.split('?')[0] || 'png';
            const defaultName = (node.attrs.alt || 'image') + '.' + ext;
            const filePath = await save({ defaultPath: defaultName, filters: [{ name: 'Images', extensions: ['png', 'jpg', 'webp'] }] });
            if (!filePath) return;
            const response = await fetch(resolvedSrc);
            const blob = await response.blob();
            await writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
        } catch (err) {
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

    const handleCaptionSubmit = () => {
        setIsEditingCaption(false);
        if (captionInput !== node.attrs.alt) {
            updateNodeAttrs({ alt: captionInput });
        }
    };

    // --- Styles ---
    const alignmentClasses = { left: 'mr-auto', center: 'mx-auto', right: 'ml-auto' };
    const viewStyles = cropParams ? getCropViewStyles(cropParams) : null;

    return (
        <div className="w-full flex my-2 justify-center group/image select-none">
            <div
                ref={containerRef}
                className={cn(
                    "relative flex flex-col leading-none text-[0px]",
                    alignmentClasses[alignment],
                    (isHovered || isEditingCaption || isEditing) ? "z-10" : ""
                )}
                style={{
                    width: width,
                    maxWidth: '100%',
                    aspectRatio: isEditing ? (containerRef.current ? `${containerRef.current.offsetWidth} / ${containerRef.current.offsetHeight}` : 'auto') : 'auto',
                    transition: isEditing ? 'none' : 'width 0.1s ease-out'
                }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {isEditing ? (
                    <ImageCropper
                        imageSrc={resolvedSrc}
                        initialCropParams={cropParams}
                        containerSize={{
                            width: containerRef.current?.offsetWidth || 0,
                            height: containerRef.current?.offsetHeight || 0
                        }}
                        onSave={handleEditSave}
                        onCancel={() => setIsEditing(false)}
                        isSaving={isSaving}
                    />
                ) : (
                    <div className={cn("w-full overflow-hidden transition-all duration-200", cropParams ? "relative" : "")}
                         style={viewStyles?.container}>
                        <img
                            src={resolvedSrc || undefined}
                            alt={node.attrs.alt}
                            className={cn(
                                "block !m-0",
                                !cropParams && "w-full h-auto max-w-none transition-all duration-200",
                                cropParams && "absolute"
                            )}
                            style={viewStyles?.image || {}}
                            draggable={false}
                        />
                    </div>
                )}

                {!isEditing && (
                    <>
                        <ResizeHandles 
                            onResizeStart={handleResizeStart} 
                            isVisible={isHovered} 
                        />
                        
                        <ImageToolbar
                            alignment={alignment}
                            onAlign={handleAlign}
                            onEdit={handleEditStart}
                            onCopy={handleCopy}
                            onDownload={handleDownload}
                            onDelete={handleDelete}
                            isVisible={isHovered || isEditingCaption}
                        />

                        <ImageCaption
                            originalAlt={node.attrs.alt || ''}
                            value={captionInput}
                            isEditing={isEditingCaption}
                            isVisible={isHovered || isEditingCaption}
                            onChange={setCaptionInput}
                            onSubmit={handleCaptionSubmit}
                            onCancel={() => {
                                setIsEditingCaption(false);
                                setCaptionInput(node.attrs.alt || '');
                            }}
                            onEditStart={() => setIsEditingCaption(true)}
                        />
                    </>
                )}
            </div>
        </div>
    );
};