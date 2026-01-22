import React, { useRef, useState, useEffect, useCallback } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { Trash2, Copy, Download, AlignLeft, AlignCenter, AlignRight, Pencil, Check, X } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { cn } from '@/lib/utils';
import { PremiumSlider } from '@/components/ui/premium-slider';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useToastStore } from '@/stores/useToastStore';
import { loadImageAsBlob, getCroppedImg } from '@/lib/assets/imageLoader';
import { joinPath } from '@/lib/storage/adapter';

interface ImageBlockProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
}

type Alignment = 'left' | 'center' | 'right';

export const ImageBlockView = ({ node, view, getPos }: ImageBlockProps) => {
    // --- Basic Visual State ---
    const [width, setWidth] = useState(node.attrs.width || '100%');
    const [alignment, setAlignment] = useState<Alignment>('center');
    const [isHovered, setIsHovered] = useState(false);
    const [isEditingCaption, setIsEditingCaption] = useState(false);
    const [captionInput, setCaptionInput] = useState(node.attrs.alt || '');

    // --- Image Source State ---
    // Initialize without fragment to avoid broken links during first render
    const [imageSrc, setImageSrc] = useState(() => {
        const src = node.attrs.src || '';
        return src.split('#')[0];
    });

    // Track if the cropper is ready (image loaded)
    const [isCropperReady, setIsCropperReady] = useState(false);

    // --- Editor State ---
    const [isEditing, setIsEditing] = useState(false);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [minZoomLimit, setMinZoomLimit] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [cropSize, setCropSize] = useState<{ width: number, height: number } | undefined>(undefined);

    // --- Hooks & Stores ---
    const notesPath = useNotesStore(s => s.notesPath);
    const currentNotePath = useNotesStore(s => s.currentNote?.path);
    const uploadAsset = useNotesStore(s => s.uploadAsset);
    const { addToast } = useToastStore();

    const containerRef = useRef<HTMLDivElement>(null);
    const captionInputRef = useRef<HTMLInputElement>(null);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // --- Path Resolution ---
    const [cropParams, setCropParams] = useState<{ x: number, y: number, width: number, height: number, ratio: number } | null>(null);
    const originalAspectRatioRef = useRef<number>(1);

    useEffect(() => {
        let isMounted = true;
        const resolveImage = async () => {
            const rawSrc = node.attrs.src;
            if (!rawSrc) return;

            console.log('--- RESOLVE IMAGE ---');
            console.log('Raw Src:', rawSrc);

            // Extract crop parameters from URL fragment (e.g., #c=10,10,80,80)
            const [baseSrc, fragment] = rawSrc.split('#');
            if (fragment && fragment.startsWith('c=')) {
                const parts = fragment.substring(2).split(',').map(Number);
                if (parts.length >= 4) {
                    // 5th value is the original aspect ratio (default to 1 for backward compat)
                    const ratio = parts.length >= 5 ? parts[4] : 1;
                    setCropParams({ x: parts[0], y: parts[1], width: parts[2], height: parts[3], ratio });
                }
            } else {
                setCropParams(null);
            }

            // Direct URL/Blob Check
            if (baseSrc.startsWith('http') || baseSrc.startsWith('data:') || baseSrc.startsWith('blob:')) {
                if (isMounted) setImageSrc(baseSrc);
                return;
            }

            // FS Path Resolution
            try {
                let fullPath = '';
                if (baseSrc.startsWith('./') || baseSrc.startsWith('../')) {
                    if (currentNotePath) {
                        const pathParts = currentNotePath.replace(/\\/g, '/').split('/');
                        pathParts.pop(); // Remove filename
                        fullPath = await joinPath(pathParts.join('/') || notesPath, baseSrc);
                    }
                } else {
                    fullPath = await joinPath(notesPath, baseSrc);
                }

                console.log('Resolving FS Path:', fullPath);

                if (fullPath) {
                    const blobUrl = await loadImageAsBlob(fullPath);
                    console.log('Blob URL generated:', blobUrl);
                    if (isMounted) setImageSrc(blobUrl);
                }
            } catch (err) {
                console.error('Failed to load image:', baseSrc, err);
                if (isMounted) setImageSrc(baseSrc);
            }
        };
        resolveImage();
        return () => { isMounted = false; };
    }, [node.attrs.src, notesPath, currentNotePath]);

    // --- Width Sync ---
    useEffect(() => {
        if (node.attrs.width) setWidth(node.attrs.width);
    }, [node.attrs.width]);

    // --- Focus Caption ---
    useEffect(() => {
        if (isEditingCaption && captionInputRef.current) {
            captionInputRef.current.focus();
        }
    }, [isEditingCaption]);


    // --- Handlers: Editor ---

    const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
        // console.log('Raw Crop Data:', _croppedArea, croppedAreaPixels);
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleEditStart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            // Set crop size to match the container exactly
            // This makes the "viewport" equal to the element size
            setCropSize({ width: rect.width, height: rect.height });

            if (cropParams) {
                // Restore Zoom:
                const initialZoom = 100 / cropParams.width;
                setZoom(initialZoom);
                // Position will be restored in onMediaLoaded after image loads
            } else {
                setZoom(1);
                setCrop({ x: 0, y: 0 });
            }
        }

        setIsEditing(true);
        setIsHovered(false);
    };

    const handleEditCancel = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsEditing(false);
        setZoom(1);
        setMinZoomLimit(1);
        setCrop({ x: 0, y: 0 });
    };

    const handleEditSave = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!croppedAreaPixels) return;

        try {
            setIsSaving(true);

            const baseSrc = node.attrs.src.split('#')[0];

            // Use the percentage crop data from the ref
            const c = lastPercentageCrop.current;

            if (c) {
                // Use 2 decimal places for better precision to avoid gaps
                // Include original aspect ratio as 5th parameter
                const ratio = originalAspectRatioRef.current;
                const fragment = `c=${Number(c.x.toFixed(2))},${Number(c.y.toFixed(2))},${Number(c.width.toFixed(2))},${Number(c.height.toFixed(2))},${ratio.toFixed(4)}`;

                // 关键：先更新本地 cropParams 状态，避免等待 useEffect 解析导致的闪烁
                setCropParams({
                    x: Number(c.x.toFixed(2)),
                    y: Number(c.y.toFixed(2)),
                    width: Number(c.width.toFixed(2)),
                    height: Number(c.height.toFixed(2)),
                    ratio: ratio
                });

                const pos = getPos();
                if (pos !== undefined) {
                    const tr = view.state.tr.setNodeMarkup(pos, undefined, {
                        ...node.attrs,
                        src: `${baseSrc}#${fragment}`
                    });
                    view.dispatch(tr);
                }
            }
            setIsEditing(false);
        } catch (error) {
            console.error('Save failed:', error);
            addToast('Failed to update view', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const lastPercentageCrop = useRef<any>(null);
    const onCropChangeComplete = useCallback((percentageCrop: any, pixelCrop: any) => {
        lastPercentageCrop.current = percentageCrop;
        setCroppedAreaPixels(pixelCrop);
    }, []);

    // --- Handlers: Standard ---
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
            const pos = getPos();
            if (pos !== undefined) {
                view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, width: width }));
            }
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const handleCopy = async (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        try { await navigator.clipboard.writeText(node.attrs.src); } catch (err) { console.error(err); }
    };

    const handleDownload = async (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        try {
            const { save } = await import('@tauri-apps/plugin-dialog');
            const { writeFile } = await import('@tauri-apps/plugin-fs');
            const ext = node.attrs.src.split('.').pop()?.split('?')[0] || 'png';
            const defaultName = (node.attrs.alt || 'image') + '.' + ext;
            const filePath = await save({ defaultPath: defaultName, filters: [{ name: 'Images', extensions: ['png', 'jpg', 'webp'] }] });
            if (!filePath) return;
            const response = await fetch(imageSrc);
            const blob = await response.blob();
            await writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
        } catch (err) {
            const link = document.createElement('a');
            link.href = imageSrc;
            link.download = node.attrs.alt || 'image';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        const pos = getPos();
        if (pos !== undefined) view.dispatch(view.state.tr.delete(pos, pos + node.nodeSize));
    };

    const handleCaptionSubmit = () => {
        setIsEditingCaption(false);
        const pos = getPos();
        if (pos !== undefined && captionInput !== node.attrs.alt) {
            view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, alt: captionInput }));
        }
    };

    const handleCaptionKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') { e.preventDefault(); handleCaptionSubmit(); }
        else if (e.key === 'Escape') { e.preventDefault(); setIsEditingCaption(false); setCaptionInput(node.attrs.alt || ''); }
    };

    const handleAlign = (align: Alignment) => (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        setAlignment(align);
    };

    const alignmentClasses = { left: 'mr-auto', center: 'mx-auto', right: 'ml-auto' };

    const onMediaLoaded = useCallback((mediaSize: { width: number, height: number, naturalWidth: number, naturalHeight: number }) => {
        // Save original aspect ratio for use when saving
        originalAspectRatioRef.current = mediaSize.naturalWidth / mediaSize.naturalHeight;

        if (!cropSize) return;

        // Calculate the "Fit" ratio (what react-easy-crop uses for Zoom=1)
        const fitRatio = Math.min(
            cropSize.width / mediaSize.naturalWidth,
            cropSize.height / mediaSize.naturalHeight
        );

        // Dimensions of the image when Zoom=1
        const displayedWidthAtZoom1 = mediaSize.naturalWidth * fitRatio;
        const displayedHeightAtZoom1 = mediaSize.naturalHeight * fitRatio;

        // Calculate scale needed to match container dimensions
        const widthScale = cropSize.width / displayedWidthAtZoom1;
        const heightScale = cropSize.height / displayedHeightAtZoom1;

        // To COVER, we need the larger of the two scales
        const coverZoom = Math.max(widthScale, heightScale) * 1.001;

        // Force set the minimum limit
        setMinZoomLimit(coverZoom);

        if (cropParams) {
            // Restore position from saved cropParams
            // cropParams.x, y are percentages of the image that are offset
            // react-easy-crop's crop is in pixels from center
            const currentZoom = 100 / cropParams.width;
            const scaledWidth = displayedWidthAtZoom1 * currentZoom;
            const scaledHeight = displayedHeightAtZoom1 * currentZoom;

            // Calculate the center offset in pixels
            // cropParams.x% of the image is hidden on the left
            // So the visible center is at (cropParams.x + cropParams.width/2)% of the image
            // Image center is at 50%
            // Offset = (50 - (cropParams.x + cropParams.width/2)) * scaledWidth / 100
            const visibleCenterX = cropParams.x + cropParams.width / 2;
            const visibleCenterY = cropParams.y + cropParams.height / 2;
            const cropX = (50 - visibleCenterX) * scaledWidth / 100;
            const cropY = (50 - visibleCenterY) * scaledHeight / 100;

            setCrop({ x: cropX, y: cropY });
        } else {
            setZoom(coverZoom);
        }

        // Mark cropper as ready after all calculations
        setIsCropperReady(true);
    }, [cropSize, cropParams]);

    console.log('--- RENDER CROPPER ---');
    console.log('Zoom:', zoom, 'MinZoom:', minZoomLimit, 'CropSize:', cropSize);

    return (
        <div className="w-full flex my-2 justify-center group/image select-none">
            <div
                className={cn(
                    "relative flex flex-col leading-none text-[0px]",
                    alignmentClasses[alignment],
                    (isHovered || isEditingCaption || isEditing) ? "z-10" : ""
                )}
                ref={containerRef}
                style={{
                    width: width,
                    maxWidth: '100%',
                    aspectRatio: isEditing ? (containerRef.current ? `${containerRef.current.offsetWidth} / ${containerRef.current.offsetHeight}` : 'auto') : 'auto',
                    transition: isEditing ? 'none' : 'width 0.1s ease-out'
                }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {/* --- RENDER CONTENT --- */}
                {isEditing ? (
                    /* EDIT MODE: Inline Cropper */
                    <div
                        className="relative overflow-hidden bg-black/5"
                        style={{
                            width: cropSize?.width,
                            height: cropSize?.height,
                        }}
                    >
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            cropSize={cropSize}
                            aspect={undefined}
                            onCropChange={setCrop}
                            onCropComplete={onCropChangeComplete}
                            onZoomChange={setZoom}
                            onMediaLoaded={onMediaLoaded}
                            showGrid={false}
                            zoomWithScroll={true}
                            zoomSpeed={0.5}
                            minZoom={minZoomLimit}
                            maxZoom={5}
                            restrictPosition={true} // Force fill the crop area
                            objectFit="cover" // Automatically ensure image covers the area
                            style={{
                                containerStyle: { borderRadius: '0' },
                                mediaStyle: { borderRadius: '0' }
                            }}
                        />

                        {/* Floating HUD */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-[var(--neko-bg-primary)]/80 backdrop-blur-md border border-[var(--neko-border)] rounded-full shadow-lg z-50">
                            <div className="w-32 flex items-center">
                                <span className="text-[10px] font-bold text-[var(--neko-text-tertiary)] mr-2 uppercase tracking-wide">Zoom</span>
                                <PremiumSlider
                                    min={1}
                                    max={5}
                                    step={0.1}
                                    value={zoom}
                                    onChange={(v) => setZoom(v)}
                                    className="w-full"
                                />
                            </div>
                            <div className="h-4 w-px bg-[var(--neko-border)]" />
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={handleEditCancel}
                                    className="p-1.5 rounded-full hover:bg-[var(--neko-hover)] text-[var(--neko-text-secondary)] transition-colors"
                                    title="Cancel"
                                >
                                    <X size={16} />
                                </button>
                                <button
                                    onClick={handleEditSave}
                                    disabled={isSaving}
                                    className="p-1.5 rounded-full bg-[var(--neko-accent)] hover:bg-[var(--neko-accent-hover)] text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                    title="Save"
                                >
                                    <Check size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* VIEW MODE: Non-destructive Viewfinder */
                    <div
                        className={cn(
                            "w-full overflow-hidden transition-all duration-200",
                            cropParams ? "relative" : ""
                        )}
                        style={cropParams ? {
                            // Use original aspect ratio to keep container size unchanged
                            aspectRatio: `${cropParams.ratio}`,
                        } : {}}
                    >
                        <img
                            src={imageSrc}
                            alt={node.attrs.alt}
                            className={cn(
                                "block !m-0", // !m-0 to override global .milkdown img margin
                                !cropParams && "w-full h-auto max-w-none transition-all duration-200",
                                cropParams && "absolute w-full h-full object-cover"
                            )}
                            style={cropParams ? {
                                // Use transform scale to zoom in, and translate to pan
                                // Scale factor: 100 / cropWidth (or cropHeight, they should be equal for same aspect ratio)
                                transform: `scale(${100 / cropParams.width}) translate(-${cropParams.x}%, -${cropParams.y}%)`,
                                transformOrigin: 'top left',
                            } : {}}
                            draggable={false}
                        />
                    </div>
                )}

                {/* --- OVERLAYS (Only in View Mode) --- */}
                {!isEditing && (
                    <>
                        {/* Resize Handles */}
                        <div className={cn(
                            "absolute inset-0 pointer-events-none transition-opacity duration-200",
                            isHovered ? "opacity-100" : "opacity-0"
                        )}>
                            <div
                                className="absolute left-0 top-1/2 -translate-y-1/2 -ml-3 h-12 w-1.5 cursor-ew-resize flex items-center justify-center hover:bg-[var(--neko-accent)] bg-[var(--neko-border)] rounded-full transition-all pointer-events-auto shadow-sm"
                                onMouseDown={handleResizeStart('left')}
                            />
                            <div
                                className="absolute right-0 top-1/2 -translate-y-1/2 -mr-3 h-12 w-1.5 cursor-ew-resize flex items-center justify-center hover:bg-[var(--neko-accent)] bg-[var(--neko-border)] rounded-full transition-all pointer-events-auto shadow-sm"
                                onMouseDown={handleResizeStart('right')}
                            />
                        </div>

                        {/* Toolbar - Positioned strictly BELOW the image outside */}
                        <div className={cn(
                            "absolute top-full right-0 mt-1.5 z-20 transition-all duration-200",
                            "flex items-center gap-0.5 p-1 bg-[var(--neko-bg-primary)]/95 backdrop-blur-sm border border-[var(--neko-border)] rounded-lg shadow-sm",
                            "transform origin-top-right",
                            (isHovered || isEditingCaption) ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
                        )}>
                            <div className="flex items-center gap-0.5">
                                <ToolbarButton icon={<AlignLeft size={16} />} onClick={handleAlign('left')} label="Left" active={alignment === 'left'} />
                                <ToolbarButton icon={<AlignCenter size={16} />} onClick={handleAlign('center')} label="Center" active={alignment === 'center'} />
                                <ToolbarButton icon={<AlignRight size={16} />} onClick={handleAlign('right')} label="Right" active={alignment === 'right'} />
                            </div>
                            <div className="w-px h-4 bg-[var(--neko-border)] mx-0.5" />
                            <div className="flex items-center gap-0.5">
                                <ToolbarButton icon={<Pencil size={16} />} onClick={handleEditStart} label="Edit" />
                                <ToolbarButton icon={<Copy size={16} />} onClick={handleCopy} label="Copy" />
                                <ToolbarButton icon={<Download size={16} />} onClick={handleDownload} label="Download" />
                                <ToolbarButton icon={<Trash2 size={16} />} onClick={handleDelete} label="Delete" danger />
                            </div>
                        </div>

                        {/* Caption - Positioned strictly ABOVE the image outside */}
                        <div className={cn(
                            "absolute bottom-full right-0 mb-1.5 max-w-full z-20 transition-all duration-200",
                            "flex items-center gap-0.5 p-1 bg-[var(--neko-bg-primary)]/95 backdrop-blur-sm border border-[var(--neko-border)] rounded-lg shadow-sm",
                            (isHovered || isEditingCaption) ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2 pointer-events-none"
                        )}>
                            {isEditingCaption ? (
                                <input
                                    ref={captionInputRef}
                                    type="text"
                                    value={captionInput}
                                    onChange={(e) => setCaptionInput(e.target.value)}
                                    onBlur={handleCaptionSubmit}
                                    onKeyDown={handleCaptionKeyDown}
                                    className="bg-transparent text-[var(--neko-text-primary)] text-xs font-medium px-2 py-1.5 outline-none min-w-[120px] w-auto"
                                    placeholder="Caption..."
                                    autoFocus
                                />
                            ) : (
                                <div
                                    className={cn(
                                        "text-xs font-medium px-2 py-1.5 cursor-pointer hover:text-[var(--neko-text-primary)] transition-colors flex items-center gap-1.5 min-h-[28px]",
                                        !node.attrs.alt ? "text-[var(--neko-text-tertiary)] italic" : "text-[var(--neko-text-secondary)]"
                                    )}
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditingCaption(true); setCaptionInput(node.attrs.alt || ''); }}
                                >
                                    {!node.attrs.alt && <Pencil size={12} className="opacity-70" />}
                                    {node.attrs.alt || "Caption"}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

function ToolbarButton({ icon, onClick, label, danger, active }: {
    icon: React.ReactNode, onClick: (e: React.MouseEvent) => void, label: string, danger?: boolean, active?: boolean
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "p-1.5 rounded-md hover:bg-[var(--neko-hover)] transition-all",
                "text-[var(--neko-text-tertiary)] hover:text-[var(--neko-text-primary)]",
                active && "bg-[var(--neko-accent-light)] text-[var(--neko-accent)]",
                danger && "hover:bg-red-50 text-red-400 hover:text-red-500"
            )}
            title={label}
        >
            {icon}
        </button>
    );
}
