import React, { useRef, useState, useEffect, useMemo } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { cn } from '@/lib/utils';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useToastStore } from '@/stores/useToastStore';

// Internal Components
import { ImageToolbar } from './components/ImageToolbar';
import { ImageCaption } from './components/ImageCaption';
import { ImageCropper } from './components/ImageCropper';

// Hooks & Utils
import { useLocalImage } from './hooks/useLocalImage';
import { parseCropFragment, generateCropFragment, CropParams } from './utils/cropUtils';

interface ImageBlockProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
}

type Alignment = 'left' | 'center' | 'right';

export const ImageBlockView = ({ node, view, getPos }: ImageBlockProps) => {
    // --- State ---
    const [width, setWidth] = useState(node.attrs.width || '100%');
    // Height state for vertical resizing
    const [height, setHeight] = useState<number | undefined>(undefined);
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

    // --- Data Resolution ---
    const { baseSrc, params: initialParams } = useMemo(() => parseCropFragment(node.attrs.src || ''), [node.attrs.src]);
    const { resolvedSrc } = useLocalImage(baseSrc, notesPath, currentNotePath);

    // Sync crop params state with URL changes
    useEffect(() => {
        setCropParams(initialParams);
    }, [initialParams]);

    // --- Handlers ---

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
        
        // Start manual resizing mode (set explicit height to lock current dimensions)
        if (!height && containerRef.current) {
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
            // Check if it's a proportional resize (Sides or Corners)
            const isProportional = direction === 'left' || direction === 'right' || direction === 'bottom-left' || direction === 'bottom-right';
            
            if (isProportional) {
                // Horizontal Resize (Width %) -> Aspect Locked Height
                const isLeftSided = direction === 'left' || direction === 'bottom-left';
                const delta = isLeftSided ? startX - moveEvent.clientX : moveEvent.clientX - startX;
                
                const newWidthPx = startWidth + delta * 2; // Center scaling simulation
                const newWidthPercent = Math.min(100, Math.max(10, (newWidthPx / parentWidth) * 100));
                
                setWidth(`${newWidthPercent}%`);
                
                const newHeight = newWidthPx / aspectRatio;
                setHeight(newHeight);
                
            } else {
                // Vertical Resize (Height px) -> Change Aspect Ratio (Crop)
                const delta = moveEvent.clientY - startY;
                const newHeight = Math.max(50, startHeight + delta); 
                setHeight(newHeight);
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
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
    
    const containerStyle = {
        width: width,
        maxWidth: '100%',
        height: height ? height : 'auto',
        aspectRatio: height ? 'auto' : (cropParams ? `${cropParams.ratio}` : (naturalRatio ? `${naturalRatio}` : 'auto')),
        transition: (isActive || height) ? 'none' : 'width 0.1s ease-out',
        display: 'block', // Prevent inline-block whitespace issues
    };

    return (
        <div className="w-full flex my-2 justify-center group/image select-none">
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
                <ImageCropper
                    imageSrc={resolvedSrc}
                    initialCropParams={cropParams}
                    containerSize={{
                        width: containerRef.current?.offsetWidth || 0,
                        height: height || containerRef.current?.offsetHeight || 0
                    }}
                    onSave={handleSave}
                    onCancel={() => {
                        setIsActive(false);
                        setHeight(undefined);
                    }}
                    isSaving={isSaving}
                    isActive={isActive}
                    onResizeStart={handleResizeStart}
                    onMediaLoaded={(media) => setNaturalRatio(media.naturalWidth / media.naturalHeight)}
                />

                {/* Caption - Always visible on hover/active */}
                {(isHovered || isEditingCaption || isActive) && (
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
                    onAlign={(align) => setAlignment(align)}
                    onEdit={() => setIsActive(true)} // Keep edit button as an explicit trigger too
                    onCopy={handleCopy}
                    onDownload={handleDownload}
                    onDelete={handleDelete}
                    isVisible={(isHovered || isEditingCaption) && !isActive} // Hide when active (clean view)
                />
            </div>
        </div>
    );
};
