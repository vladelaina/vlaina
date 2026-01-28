import React, { useRef, useState, useEffect, useMemo } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { cn } from '@/lib/utils';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useToastStore } from '@/stores/useToastStore';
import { ImageOff } from 'lucide-react';

// Internal Components
import { ImageToolbar } from './components/ImageToolbar';
import { ImageCaption } from './components/ImageCaption';
import { ImageCropper } from './components/ImageCropper';

// Hooks & Utils
import { useLocalImage } from './hooks/useLocalImage';
import { parseCropFragment, generateCropFragment, CropParams } from './utils/cropUtils';
import { moveImageToTrash, ensureImageFileExists } from './utils/fileUtils';

interface ImageBlockProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
}

type Alignment = 'left' | 'center' | 'right';

export const ImageBlockView = ({ node, view, getPos }: ImageBlockProps) => {
    // --- State ---
    // Start with 'auto' so the image renders at its natural size (capped by max-width)
    // instead of being forced to 100% width initially. This prevents the "jump" effect.
    const [width, setWidth] = useState(node.attrs.width || 'auto');
    // Height state for vertical resizing
    const [height, setHeight] = useState<number | undefined>(undefined);
    // Real-time dimensions during drag to prevent render lag
    const [dragDimensions, setDragDimensions] = useState<{width: number, height: number} | null>(null);
    // Track real DOM dimensions to handle auto-sizing updates correctly
    const [observedSize, setObservedSize] = useState({ width: 0, height: 0 });
    
    // Visibility state: hide new images until auto-sizing is complete to prevent "jump"
    const [isReady, setIsReady] = useState(!!node.attrs.width);

    // Natural aspect ratio of the loaded image (for initial rendering without crop params)
    const [naturalRatio, setNaturalRatio] = useState<number | null>(null);
    
    const [alignment, setAlignment] = useState<Alignment>('center');
    const [isHovered, setIsHovered] = useState(false);
    
    // Caption State
    const [isEditingCaption, setIsEditingCaption] = useState(false);
    const [captionInput, setCaptionInput] = useState(node.attrs.alt || '');

    // Active State (formerly isEditing) - Controls HUD visibility
    const [isActive, setIsActive] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [cropParams, setCropParams] = useState<CropParams | null>(null);

    // --- Stores ---
    const notesPath = useNotesStore(s => s.notesPath);
    const currentNotePath = useNotesStore(s => s.currentNote?.path);
    const { addToast } = useToastStore();

    // --- Refs ---
    const containerRef = useRef<HTMLDivElement>(null);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // --- Resize Observer ---
    useEffect(() => {
        if (!containerRef.current) return;
        
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                // Use contentRect for precise sub-pixel measurements
                const { width, height } = entry.contentRect;
                
                setObservedSize(prev => {
                    // Only update if dimensions changed significantly to prevent render loops
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

    // --- Data Resolution ---
    const { baseSrc, params: initialParams } = useMemo(() => parseCropFragment(node.attrs.src || ''), [node.attrs.src]);
    const { resolvedSrc, error: loadError, isLoading } = useLocalImage(baseSrc, notesPath, currentNotePath);

    // Sync crop params state with URL changes
    useEffect(() => {
        setCropParams(initialParams);
    }, [initialParams]);

    // Ensure placeholder is visible on error
    useEffect(() => {
        if (loadError) {
            setIsReady(true);
        }
    }, [loadError]);

    // --- Handlers ---

    // Helper to restore file from memory if missing, ensuring actions like Copy/Download work
    const restoreIfNeeded = async () => {
        if (baseSrc && resolvedSrc) {
            await ensureImageFileExists(baseSrc, resolvedSrc, notesPath, currentNotePath);
        }
    };

    const handleMouseEnter = () => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = undefined;
        }
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        if (isEditingCaption || isActive) return;
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

    const handleSave = async (percentageCrop: any, ratio: number) => {
        try {
            setIsSaving(true);

            // Auto-restore: If file was externally deleted but we have it in memory, write it back.
            if (baseSrc && resolvedSrc) {
                await ensureImageFileExists(baseSrc, resolvedSrc, notesPath, currentNotePath);
            }

            const fragment = generateCropFragment(percentageCrop, ratio);
            
            // Optimistic update of local state
            setCropParams({
                x: percentageCrop.x,
                y: percentageCrop.y,
                width: percentageCrop.width,
                height: percentageCrop.height,
                ratio: ratio
            });

            updateNodeAttrs({ src: `${baseSrc}#${fragment}` });
            setIsActive(false);
            setHeight(undefined); // Reset manual height
        } catch (error) {
            console.error('Save failed:', error);
            addToast('Failed to update view', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleResizeStart = (direction: 'left' | 'right' | 'top' | 'bottom' | 'bottom-left' | 'bottom-right') => (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isProportional = direction === 'left' || direction === 'right' || direction === 'bottom-left' || direction === 'bottom-right';

        // Start manual resizing mode (set explicit height to lock current dimensions)
        // Only set height if we're doing a non-proportional resize (vertical crop)
        if (!isProportional && !height && containerRef.current) {
             setHeight(containerRef.current.offsetHeight);
        }

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = containerRef.current?.offsetWidth || 0;
        const startHeight = height || containerRef.current?.offsetHeight || 0;
        const parentWidth = containerRef.current?.parentElement?.offsetWidth || 1;
        
        // Lock aspect ratio for side resizing
        const aspectRatio = startWidth / startHeight;

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (isProportional) {
                // Horizontal Resize (Width %) -> Aspect Locked Height
                const isLeftSided = direction === 'left' || direction === 'bottom-left';
                const delta = isLeftSided ? startX - moveEvent.clientX : moveEvent.clientX - startX;
                
                const newWidthPx = startWidth + delta * 2; // Center scaling simulation
                const newWidthPercent = Math.min(100, Math.max(10, (newWidthPx / parentWidth) * 100));
                
                setWidth(`${newWidthPercent}%`);
                // Calculate expected pixel height for smooth cropper updates
                const expectedHeight = newWidthPx / aspectRatio;
                setDragDimensions({ width: newWidthPx, height: expectedHeight });
                
                // Let CSS aspect-ratio handle the height automatically to prevent sub-pixel gaps
                // const newHeight = newWidthPx / aspectRatio;
                // setHeight(newHeight);
                
            } else {
                // Vertical Resize (Height px) -> Change Aspect Ratio (Crop)
                const delta = moveEvent.clientY - startY;
                const newHeight = Math.max(50, startHeight + delta); 
                setHeight(newHeight);
                setDragDimensions({ width: startWidth, height: newHeight }); // Width roughly constant
            }
        };

        const onMouseUp = async () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            setDragDimensions(null); // Clear optimistic dimensions

            await restoreIfNeeded();

            // Commit changes
            const isProportional = direction === 'left' || direction === 'right' || direction === 'bottom-left' || direction === 'bottom-right';
            
            if (isProportional) {
                updateNodeAttrs({ width: width });
                setHeight(undefined);
            }
            // For vertical resize outside Edit Mode, we don't auto-save aspect ratio to URL
            // because we need the internal Cropper state. 
            // It will remain visual-only until the user clicks Edit -> Save.
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const handleCopy = async () => {
        try {
            await restoreIfNeeded();
            await navigator.clipboard.writeText(node.attrs.src);
            addToast('Link copied to clipboard', 'success');
        } catch (err) {
            console.error(err);
        }
    };

    const handleDownload = async () => {
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
            // Remove from Editor UI immediately
            // The file deletion logic is now handled globally by the imageNodeViewPlugin
            // which listens for ALL node removals (Backspace, Cut, Button Click)
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

    // --- Styles ---
    const alignmentClasses = { left: 'mr-auto', center: 'mx-auto', right: 'ml-auto' };
    
    const computedAspectRatio = height ? 'auto' : (cropParams ? `${cropParams.ratio}` : (naturalRatio ? `${naturalRatio}` : 'auto'));
    
    const containerStyle = {
        width: width,
        maxWidth: '100%',
        height: height ? height : 'auto',
        aspectRatio: computedAspectRatio,
        transition: (isActive || height) ? 'none' : 'width 0.1s ease-out, opacity 0.2s ease-out',
        display: 'block', // Prevent inline-block whitespace issues
        opacity: isReady ? 1 : 0,
    };

    const finalContainerSize = dragDimensions || {
        width: observedSize.width || containerRef.current?.offsetWidth || 0,
        height: height || observedSize.height || containerRef.current?.offsetHeight || 0
    };

    return (
        <div className="w-full flex my-2 justify-center group/image">
            <div
                ref={containerRef}
                className={cn(
                    "relative flex flex-col leading-none text-[0px]",
                    alignmentClasses[alignment],
                    (isHovered || isEditingCaption || isActive) ? "z-10" : ""
                )}
                style={containerStyle}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {loadError ? (
                    <div className="w-full h-full min-h-[100px] flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 border border-dashed border-gray-200 dark:border-zinc-700 rounded-md text-gray-400 dark:text-zinc-500">
                        <ImageOff className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-xs font-medium">Image not found</span>
                    </div>
                ) : (
                    <ImageCropper
                        imageSrc={resolvedSrc}
                        initialCropParams={cropParams}
                        containerSize={finalContainerSize}
                        onSave={handleSave}
                        onCancel={() => {
                            setIsActive(false);
                            setHeight(undefined);
                        }}
                        isSaving={isSaving}
                        isActive={isActive}
                        onResizeStart={handleResizeStart}
                        onMediaLoaded={(media) => {
                            setNaturalRatio(media.naturalWidth / media.naturalHeight);
                            
                            // Smart Default Sizing:
                            if (!node.attrs.width || width === 'auto') {
                                const containerWidth = containerRef.current?.parentElement?.offsetWidth;
                                
                                if (containerWidth) {
                                    const percent = (media.naturalWidth / containerWidth) * 100;
                                    const finalPercent = Math.min(100, percent);
                                    
                                    setWidth(`${finalPercent}%`);
                                    updateNodeAttrs({ width: `${finalPercent}%` });
                                }
                            }

                            // Smart Default Caption:
                            // If alt text is empty, initialize it with the filename (sans extension)
                            if (!node.attrs.alt) {
                                try {
                                    const url = node.attrs.src.split('#')[0];
                                    const filename = url.substring(url.lastIndexOf('/') + 1);
                                    if (filename) {
                                        const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
                                        // Update node attribute and local input state
                                        updateNodeAttrs({ alt: nameWithoutExt });
                                        setCaptionInput(nameWithoutExt);
                                    }
                                } catch (e) {
                                    console.warn('Failed to parse filename for caption', e);
                                }
                            }

                            setIsReady(true);
                        }}
                    />
                )}

                {/* Caption - Visible on hover/active but NOT during cropping */}
                {(isHovered || isEditingCaption) && !isActive && !loadError && (
                    <ImageCaption
                        originalAlt={node.attrs.alt || ''}
                        value={captionInput}
                        isEditing={isEditingCaption}
                        isVisible={true}
                        onChange={setCaptionInput}
                        onSubmit={handleCaptionSubmit}
                        onCancel={() => {
                            setIsEditingCaption(false);
                            setCaptionInput(node.attrs.alt || '');
                        }}
                        onEditStart={() => setIsEditingCaption(true)}
                    />
                )}
                
                {/* Optional: Show toolbar actions on hover even if not active? */}
                {/* For now keeping toolbar visible on hover as before */}
                <ImageToolbar
                    alignment={alignment}
                    onAlign={async (align) => {
                        await restoreIfNeeded();
                        setAlignment(align);
                    }}
                    onEdit={async () => {
                        await restoreIfNeeded();
                        setIsActive(true);
                    }}
                    onCopy={handleCopy}
                    onDownload={handleDownload}
                    onDelete={handleDelete}
                    isVisible={(isHovered || isEditingCaption) && !isActive} // Hide when active (clean view)
                />
            </div>
        </div>
    );
};
