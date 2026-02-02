import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { cn } from '@/lib/utils';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useToastStore } from '@/stores/useToastStore';
import { MdBrokenImage } from 'react-icons/md';

// Internal Components
import { ImageToolbar } from './components/ImageToolbar';
import { ImageCaption } from './components/ImageCaption';
import { ImageCropper } from './components/ImageCropper';

// Hooks & Utils
import { useLocalImage } from './hooks/useLocalImage';
import { parseCropFragment, generateCropFragment, CropParams } from './utils/cropUtils';
import { ensureImageFileExists } from './utils/fileUtils';
import { setDragState, clearDragState, calculateDropPosition } from './imageDragPlugin';

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

    // Drag State
    const [isDragging, setIsDragging] = useState(false);
    const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
    const [dragSize, setDragSize] = useState<{ width: number; height: number } | null>(null);

    // --- Stores ---
    const notesPath = useNotesStore(s => s.notesPath);
    const currentNotePath = useNotesStore(s => s.currentNote?.path);
    const { addToast } = useToastStore();

    // --- Refs ---
    const containerRef = useRef<HTMLDivElement>(null);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const dragCleanupRef = useRef<(() => void) | null>(null);

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
    const { resolvedSrc, error: loadError } = useLocalImage(baseSrc, notesPath, currentNotePath);

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
            
            if (resolvedSrc) {
                const response = await fetch(resolvedSrc);
                const blob = await response.blob();
                
                await navigator.clipboard.write([
                    new ClipboardItem({
                        [blob.type]: blob
                    })
                ]);
            } else {
                // Fallback for missing resolved src (unlikely if restoreIfNeeded worked)
                await navigator.clipboard.writeText(node.attrs.src);
            }
        } catch (err) {
            console.error('Failed to copy image:', err);
            // Fallback to text copy if image copy fails (e.g. format not supported)
            try {
                await navigator.clipboard.writeText(node.attrs.src);
            } catch (e) { /* ignore */ }
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

    // --- Drag Handlers ---
    const LONG_PRESS_DELAY = 300;

    // Reference to track target position during drag
    const dragTargetPosRef = useRef<number | null>(null);

    const moveNodeToPosition = useCallback((targetPos: number) => {
        const pos = getPos();
        console.log('[ImageDrag] moveNodeToPosition called:', { targetPos, pos });

        if (pos === undefined || targetPos === null) return;

        const { state, dispatch } = view;

        // Resolve pos to find the parent paragraph
        // Images in Milkdown are P > Image, so we need to move the whole paragraph
        const $pos = state.doc.resolve(pos);
        const parentPos = $pos.before($pos.depth);
        const parentNode = $pos.node($pos.depth);

        console.log('[ImageDrag] Moving:', { parentPos, depth: $pos.depth, nodeSize: parentNode?.nodeSize });

        if (!parentNode) return;

        const nodeSize = parentNode.nodeSize;

        // Don't move if target is the same position or right after current node
        if (targetPos === parentPos || targetPos === parentPos + nodeSize) {
            console.log('[ImageDrag] Skip move - same position');
            return;
        }

        // Validate the target position can accept the node
        const $targetPos = state.doc.resolve(targetPos);
        const targetParent = $targetPos.parent;
        const targetIndex = $targetPos.index();

        // Check if we can insert the paragraph at the target position
        if (!targetParent.canReplaceWith(targetIndex, targetIndex, parentNode.type)) {
            console.log('[ImageDrag] Cannot insert at target position, finding valid position...');
            // Try to find a valid position by moving up to the top level
            let validTargetPos: number | null = null;
            for (let d = $targetPos.depth; d >= 1; d--) {
                const ancestorPos = $targetPos.before(d);
                const ancestor = $targetPos.node(d);
                const ancestorParent = d > 1 ? $targetPos.node(d - 1) : state.doc;
                const ancestorIndex = d > 1 ? $targetPos.index(d - 1) : $targetPos.index(0);

                if (ancestorParent.canReplaceWith(ancestorIndex, ancestorIndex, parentNode.type)) {
                    // Found a valid position - insert at the boundary of this ancestor
                    const ancestorRect = view.nodeDOM(ancestorPos) as HTMLElement | null;
                    if (ancestorRect) {
                        // Insert after the ancestor
                        validTargetPos = ancestorPos + ancestor.nodeSize;
                        console.log('[ImageDrag] Found valid position at depth', d, 'pos:', validTargetPos);
                        break;
                    }
                }
            }
            if (validTargetPos === null) {
                console.log('[ImageDrag] No valid position found, aborting');
                return;
            }
            targetPos = validTargetPos;
        }

        const tr = state.tr;
        tr.setMeta('addToHistory', true);
        tr.setMeta('scrollIntoView', false);

        if (targetPos > parentPos) {
            tr.insert(targetPos, parentNode);
            tr.delete(parentPos, parentPos + nodeSize);
        } else {
            tr.delete(parentPos, parentPos + nodeSize);
            tr.insert(targetPos, parentNode);
        }

        dispatch(tr);
    }, [view, getPos]);

    const handleDragHandlePointerDown = (e: React.PointerEvent) => {
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

        // Get initial position of the container
        const containerRect = containerRef.current?.getBoundingClientRect();
        const initialLeft = containerRect?.left || 0;
        const initialTop = containerRect?.top || 0;

        const onPointerMove = (moveEvent: PointerEvent) => {
            const elapsed = Date.now() - startTime;

            if (!isLongPressTriggered && elapsed >= LONG_PRESS_DELAY) {
                isLongPressTriggered = true;
                setIsDragging(true);
                setDragSize({ width: sourceWidth, height: sourceHeight });

                // Initialize drag state in plugin
                if (sourcePos !== undefined) {
                    setDragState(view, {
                        isDragging: true,
                        sourcePos: sourcePos,
                        targetPos: null,
                        sourceHeight: sourceHeight,
                    });
                }
            }

            if (isLongPressTriggered) {
                // Calculate new position based on mouse movement
                const deltaX = moveEvent.clientX - startX;
                const deltaY = moveEvent.clientY - startY;
                setDragPosition({
                    x: initialLeft + deltaX,
                    y: initialTop + deltaY,
                });

                // Calculate and update drop position
                if (sourcePos !== undefined) {
                    const targetPos = calculateDropPosition(view, moveEvent.clientY, sourcePos);
                    dragTargetPosRef.current = targetPos;

                    setDragState(view, {
                        targetPos: targetPos,
                    });
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
            console.log('[ImageDrag] onPointerUp:', { isLongPressTriggered, targetPos });

            // Clear drag state in plugin
            clearDragState(view);

            setIsDragging(false);
            setDragPosition(null);
            setDragSize(null);
            dragTargetPosRef.current = null;
            dragCleanupRef.current = null;

            // Move node to target position if we have a valid target
            if (isLongPressTriggered && targetPos !== null) {
                moveNodeToPosition(targetPos);
            }
        };

        dragCleanupRef.current = onPointerUp;

        longPressTimeoutRef.current = setTimeout(() => {
            if (!isLongPressTriggered) {
                isLongPressTriggered = true;
                setIsDragging(true);
                setDragSize({ width: sourceWidth, height: sourceHeight });

                // Set initial drag position
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                    setDragPosition({ x: rect.left, y: rect.top });
                }

                // Initialize drag state in plugin
                if (sourcePos !== undefined) {
                    setDragState(view, {
                        isDragging: true,
                        sourcePos: sourcePos,
                        targetPos: null,
                        sourceHeight: sourceHeight,
                    });
                }
            }
        }, LONG_PRESS_DELAY);

        window.addEventListener('pointermove', onPointerMove, true);
        window.addEventListener('pointerup', onPointerUp, true);
    };

    const handleDragHandlePointerUp = () => {};
    const handleDragHandlePointerCancel = () => {};

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

    // --- Styles ---
    const alignmentClasses = { left: 'mr-auto', center: 'mx-auto', right: 'ml-auto' };

    const computedAspectRatio = height ? 'auto' : (cropParams ? `${cropParams.ratio}` : (naturalRatio ? `${naturalRatio}` : 'auto'));

    const containerStyle: React.CSSProperties = isDragging && dragPosition && dragSize ? {
        // Fixed positioning when dragging
        position: 'fixed',
        left: dragPosition.x,
        top: dragPosition.y,
        width: dragSize.width,
        height: dragSize.height,
        zIndex: 9999,
        pointerEvents: 'none',
        opacity: 0.9,
        transform: 'scale(0.95)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        transition: 'none',
    } : {
        width: width,
        maxWidth: '100%',
        height: height ? height : 'auto',
        aspectRatio: computedAspectRatio,
        transition: (isActive || height) ? 'none' : 'width 0.1s ease-out, opacity 0.2s ease-out',
        display: 'block',
        opacity: isReady ? 1 : 0,
    };

    const finalContainerSize = dragDimensions || {
        width: observedSize.width || containerRef.current?.offsetWidth || 0,
        height: height || observedSize.height || containerRef.current?.offsetHeight || 0
    };

    return (
        <div className="w-full flex my-2 justify-center group/image">
            {/* Placeholder when dragging */}
            {isDragging && (
                <div
                    style={{
                        width: dragSize?.width || 'auto',
                        height: dragSize?.height || 100,
                        opacity: 0.3,
                        border: '2px dashed #ccc',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(0,0,0,0.05)',
                    }}
                />
            )}
            <div
                ref={containerRef}
                data-dragging={isDragging ? "true" : undefined}
                draggable={false}
                className={cn(
                    "relative flex flex-col leading-none text-[0px] select-none",
                    !isDragging && alignmentClasses[alignment],
                    (isHovered || isEditingCaption || isActive) ? "z-10" : "",
                    isDragging && "cursor-grabbing"
                )}
                style={containerStyle}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onPointerDown={handleDragHandlePointerDown}
                onPointerUp={handleDragHandlePointerUp}
                onPointerCancel={handleDragHandlePointerCancel}
                onDragStart={(e) => e.preventDefault()}
            >
                {loadError ? (
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

                {/* Caption - Visible on hover/active but NOT during cropping or dragging */}
                {(isHovered || isEditingCaption) && !isActive && !loadError && !isDragging && (
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
                    isVisible={(isHovered || isEditingCaption) && !isActive && !isDragging}
                />
            </div>
        </div>
    );
};