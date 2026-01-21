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
    const [imageSrc, setImageSrc] = useState(node.attrs.src);

    // --- Editor State ---
    const [isEditing, setIsEditing] = useState(false);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
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
    useEffect(() => {
        let isMounted = true;
        const resolveImage = async () => {
            const rawSrc = node.attrs.src;
            if (!rawSrc) return;

            // Direct URL/Blob Check
            if (rawSrc.startsWith('http') || rawSrc.startsWith('data:') || rawSrc.startsWith('blob:')) {
                if (isMounted) setImageSrc(rawSrc);
                return;
            }

            // FS Path Resolution
            try {
                let fullPath = '';
                if (rawSrc.startsWith('./') || rawSrc.startsWith('../')) {
                    if (currentNotePath) {
                        const pathParts = currentNotePath.replace(/\\/g, '/').split('/');
                        pathParts.pop(); // Remove filename
                        fullPath = await joinPath(pathParts.join('/') || notesPath, rawSrc);
                    }
                } else {
                    fullPath = await joinPath(notesPath, rawSrc);
                }

                if (fullPath) {
                    const blobUrl = await loadImageAsBlob(fullPath);
                    if (isMounted) setImageSrc(blobUrl);
                }
            } catch (err) {
                console.error('Failed to load image:', rawSrc, err);
                if (isMounted) setImageSrc(rawSrc);
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
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleEditStart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (containerRef.current) {
            const { width, height } = containerRef.current.getBoundingClientRect();
            setCropSize({ width, height });
        }
        setIsEditing(true);
        setIsHovered(false); // Hide standard toolbar
    };

    const handleEditCancel = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsEditing(false);
        setZoom(1);
        setCrop({ x: 0, y: 0 });
    };

    const handleEditSave = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!croppedAreaPixels) return;

        try {
            setIsSaving(true);
            const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, 0); // 0 = no resize/limit
            if (!croppedBlob) throw new Error('Failed to crop');

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
            const fileName = `edited_${timestamp[0]}_${timestamp[1].split('Z')[0]}.png`;
            const file = new File([croppedBlob], fileName, { type: 'image/png' });

            const result = await uploadAsset(file, 'covers', currentNotePath);

            if (result.success && result.path) {
                const pos = getPos();
                if (pos !== undefined) {
                    const tr = view.state.tr.setNodeMarkup(pos, undefined, {
                        ...node.attrs,
                        src: result.path
                    });
                    view.dispatch(tr);
                }
                setIsEditing(false);
                // addToast('Image updated', 'success'); // Removed as per user request for quieter UI
            } else {
                throw new Error(result.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Save failed:', error);
            addToast('Failed to save image', 'error');
        } finally {
            setIsSaving(false);
        }
    };

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

    return (
        <div className="w-full flex my-6 group/image">
            <div
                className={cn(
                    "relative select-none transition-all duration-200 ease-out",
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
                    <div className="relative w-full h-full rounded-xl overflow-hidden shadow-sm border border-[var(--neko-accent)] bg-black/5 aspect-auto min-h-[200px]">
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            cropSize={cropSize} // Force crop area to match container
                            aspect={undefined}
                            onCropChange={setCrop}
                            onCropComplete={onCropComplete}
                            onZoomChange={setZoom}
                            showGrid={false}
                            zoomWithScroll={true}
                            zoomSpeed={0.5}
                            minZoom={1}
                            maxZoom={5}
                            restrictPosition={false}
                            style={{
                                containerStyle: { borderRadius: '0.75rem' },
                                mediaStyle: { borderRadius: '0.75rem' }
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
                    /* VIEW MODE: Normal Image */
                    <img
                        src={imageSrc}
                        alt={node.attrs.alt}
                        className={cn(
                            "w-full h-auto rounded-xl shadow-sm border border-[var(--neko-border)] bg-[var(--neko-bg-secondary)] transition-all duration-200",
                        )}
                        draggable={false}
                    />
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

                        {/* Toolbar */}
                        <div className={cn(
                            "absolute -bottom-9 right-0 z-20 transition-all duration-200 floating-toolbar-inner shadow-sm border border-[var(--neko-border)] bg-[var(--neko-bg-primary)] rounded-lg transform origin-top-right",
                            (isHovered || isEditingCaption) ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
                        )}>
                            <div className="toolbar-group">
                                <ToolbarButton icon={<AlignLeft size={16} />} onClick={handleAlign('left')} label="Left" active={alignment === 'left'} />
                                <ToolbarButton icon={<AlignCenter size={16} />} onClick={handleAlign('center')} label="Center" active={alignment === 'center'} />
                                <ToolbarButton icon={<AlignRight size={16} />} onClick={handleAlign('right')} label="Right" active={alignment === 'right'} />
                            </div>
                            <div className="toolbar-divider" />
                            <div className="toolbar-group">
                                <ToolbarButton icon={<Pencil size={16} />} onClick={handleEditStart} label="Edit" />
                                <ToolbarButton icon={<Copy size={16} />} onClick={handleCopy} label="Copy" />
                                <ToolbarButton icon={<Download size={16} />} onClick={handleDownload} label="Download" />
                                <ToolbarButton icon={<Trash2 size={16} />} onClick={handleDelete} label="Delete" danger />
                            </div>
                        </div>

                        {/* Caption */}
                        <div className={cn(
                            "absolute -top-9 right-0 max-w-full z-20 transition-all duration-200 floating-toolbar-inner shadow-sm border border-[var(--neko-border)] bg-[var(--neko-bg-primary)] rounded-lg",
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
