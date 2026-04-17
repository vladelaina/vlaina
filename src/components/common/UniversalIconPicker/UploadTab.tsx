import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDropzone } from 'react-dropzone';
import Cropper from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { getCroppedImg } from '@/lib/assets/processing/crop';
import { useToastStore } from '@/stores/useToastStore';
import { PremiumSlider } from '@/components/ui/premium-slider';
import { DeletableItem } from '@/components/ui/deletable-item';
import { UniversalIcon } from './UniversalIcon';

export interface CustomIcon {
    id: string;
    url: string;
    name: string;
}

const CUSTOM_ICON_COLUMNS = 7;
const CUSTOM_ICON_GAP_PX = 8;
const CUSTOM_ICON_MIN_SIZE_PX = 44;

function CustomIconLibraryGrid({
    customIcons,
    imageLoader,
    onDeleteCustomIcon,
    onPreview,
    onSelect,
}: {
    customIcons: CustomIcon[];
    imageLoader?: (src: string) => Promise<string>;
    onDeleteCustomIcon?: (id: string) => void;
    onPreview?: (url: string | null) => void;
    onSelect: (url: string) => void;
}) {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const rowCount = Math.ceil(customIcons.length / CUSTOM_ICON_COLUMNS);
    const itemSize = useMemo(() => {
        const width = Math.max(0, containerWidth);
        if (width === 0) {
            return CUSTOM_ICON_MIN_SIZE_PX;
        }

        return Math.max(
            CUSTOM_ICON_MIN_SIZE_PX,
            Math.floor((width - CUSTOM_ICON_GAP_PX * (CUSTOM_ICON_COLUMNS - 1)) / CUSTOM_ICON_COLUMNS),
        );
    }, [containerWidth]);
    const rowHeight = itemSize + CUSTOM_ICON_GAP_PX;
    const rows = useMemo(
        () =>
            Array.from({ length: rowCount }, (_, rowIndex) => {
                const start = rowIndex * CUSTOM_ICON_COLUMNS;
                return customIcons.slice(start, start + CUSTOM_ICON_COLUMNS);
            }),
        [customIcons, rowCount],
    );
    const virtualizer = useVirtualizer({
        count: rowCount,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => rowHeight,
        overscan: 5,
    });

    useEffect(() => {
        const node = scrollRef.current;
        if (!node) {
            return;
        }

        const commitWidth = () => {
            const nextWidth = node.clientWidth - 4;
            setContainerWidth((current) => (current === nextWidth ? current : nextWidth));
        };

        commitWidth();

        if (typeof ResizeObserver === 'undefined') {
            return;
        }

        const resizeObserver = new ResizeObserver(() => {
            commitWidth();
        });
        resizeObserver.observe(node);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    useEffect(() => {
        virtualizer.measure();
    }, [rowHeight, virtualizer]);

    if (customIcons.length === 0) {
        return (
            <div className="py-8 text-center text-xs text-muted-foreground italic">
                No saved icons yet
            </div>
        );
    }

    return (
        <div ref={scrollRef} className="flex-1 overflow-y-auto vlaina-scrollbar pr-1">
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    position: 'relative',
                    width: '100%',
                }}
            >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                    const rowIcons = rows[virtualRow.index];
                    if (!rowIcons || rowIcons.length === 0) {
                        return null;
                    }

                    return (
                        <div
                            key={`custom-icon-row-${virtualRow.index}`}
                            style={{
                                height: `${virtualRow.size}px`,
                                left: 0,
                                position: 'absolute',
                                top: 0,
                                transform: `translateY(${virtualRow.start}px)`,
                                width: '100%',
                            }}
                        >
                            <div
                                className="grid grid-cols-7 gap-2"
                                style={{
                                    gridAutoRows: `${itemSize}px`,
                                }}
                            >
                                {rowIcons.map((emoji) => (
                                    <DeletableItem
                                        key={emoji.id}
                                        id={emoji.id}
                                        onDelete={(id) => onDeleteCustomIcon?.(id)}
                                        className="relative aspect-square flex items-center justify-center cursor-pointer transition-all active:scale-95"
                                    >
                                        <div
                                            className="w-full h-full"
                                            onClick={() => onSelect(emoji.url)}
                                            onMouseEnter={() => onPreview?.(emoji.url)}
                                            onMouseLeave={() => onPreview?.(null)}
                                        >
                                            <UniversalIcon
                                                icon={emoji.url}
                                                size={44}
                                                className="w-full h-full object-contain"
                                                imageLoader={imageLoader}
                                            />
                                        </div>
                                    </DeletableItem>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface UploadTabProps {
    onSelect: (value: string) => void;
    onPreview?: (url: string | null) => void;
    onClose: () => void;
    customIcons?: CustomIcon[];
    onUploadFile?: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
    onDeleteCustomIcon?: (id: string) => void;
    imageLoader?: (src: string) => Promise<string>;
}

export function UploadTab({ 
    onSelect, 
    onPreview, 
    onClose,
    customIcons = [],
    onUploadFile,
    onDeleteCustomIcon,
    imageLoader
}: UploadTabProps) {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [originalFile, setOriginalFile] = useState<File | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles && acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            setOriginalFile(file);
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setImageSrc(reader.result?.toString() || null);
            });
            reader.readAsDataURL(file);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept: { 'image/*': [] },
        maxFiles: 1,
        noClick: true
    });

    const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const isGif = originalFile?.type === 'image/gif';
    const isWebP = originalFile?.type === 'image/webp';
    const shouldPreserve = isGif || isWebP;

    const handleSave = async () => {
        if (!imageSrc || (!croppedAreaPixels && !shouldPreserve)) return;
        if (!onUploadFile) {
            useToastStore.getState().addToast('Upload not supported in this context', 'error');
            return;
        }

        try {
            setIsUploading(true);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
            const finalName = `icon_${timestamp[0]}_${timestamp[1].split('Z')[0]}`;

            let fileToUpload: File;

            if (shouldPreserve && originalFile) {
                const ext = isGif ? 'gif' : 'webp';
                fileToUpload = new File([originalFile], `${finalName}.${ext}`, { type: originalFile.type });
            } else {
                const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
                if (!croppedBlob) throw new Error('Failed to crop image');

                fileToUpload = new File([croppedBlob], `${finalName}.png`, { type: 'image/png' });
            }

            const result = await onUploadFile(fileToUpload);
            
            if (!result.success || !result.url) {
                throw new Error(result.error || 'Upload failed');
            }

            onSelect(result.url);
            onClose();

        } catch (e) {
            console.error(e);
            useToastStore.getState().addToast('Failed to save icon. Please try again.', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleLibraryItemClick = (url: string) => {
        onSelect(url);
        onClose();
    };

    return (
        <div className="h-[320px] flex flex-col relative">
            <input {...getInputProps()} />
            {imageSrc ? (
                <div className="flex flex-col flex-1 px-5 pt-3 pb-6">
                    <div
                        {...getRootProps({ onClick: (e) => e.stopPropagation() })}
                        className="relative flex-1 bg-zinc-950 rounded-lg overflow-hidden mb-6 group/cropper flex items-center justify-center h-[180px]"
                    >
                        {shouldPreserve ? (
                            <>
                                <img
                                    src={imageSrc}
                                    className="max-w-full max-h-full object-contain"
                                    alt="Preview"
                                />
                                <div className="absolute bottom-3 left-3 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-sm border border-white/10 flex items-center gap-1.5 pointer-events-none">
                                    <span className="relative flex h-2 w-2">
                                        <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping", isGif ? "bg-green-400" : "bg-blue-400")}></span>
                                        <span className={cn("relative inline-flex rounded-full h-2 w-2", isGif ? "bg-green-500" : "bg-blue-500")}></span>
                                    </span>
                                    {isGif ? "Animation Preserved" : "Original Format"}
                                </div>
                            </>
                        ) : (
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                                showGrid={false}
                                zoomWithScroll={true}
                                zoomSpeed={0.5}
                                minZoom={1}
                                maxZoom={3}
                            />
                        )}

                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                open();
                            }}
                            className={cn(
                                "absolute top-3 right-3 z-10 p-2",
                                "text-white/40 hover:text-white transition-all",
                                "opacity-0 group-hover/cropper:opacity-100",
                                "active:scale-95"
                            )}
                        >
                            <Icon name="common.upload" size="md" />
                        </button>
                    </div>

                    <div className="flex flex-col gap-6">
                        {!isGif && (
                            <div className="flex items-center gap-4">
                                <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--vlaina-text-tertiary)] w-10">Zoom</span>
                                <PremiumSlider
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    value={zoom}
                                    onChange={(val: number) => setZoom(val)}
                                />
                            </div>
                        )}

                        <div className="flex justify-between items-center mt-2">
                            <button
                                type="button"
                                onClick={() => setImageSrc(null)}
                                className="text-sm font-medium text-[var(--vlaina-text-secondary)] hover:text-[var(--vlaina-text-primary)] transition-colors"
                            >
                                Back
                            </button>
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={isUploading}
                                className="bg-[#1e96eb] hover:bg-[#1a85d1] text-white px-8 h-9 rounded-full font-medium shadow-sm transition-all active:scale-95 inline-flex items-center justify-center min-w-[80px]"
                            >
                                {isUploading ? (
                                    <svg
                                        className="animate-spin w-[18px] h-[18px] text-current"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                        />
                                        <path
                                            className="opacity-100"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                ) : "Save"}
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col flex-1 min-h-0">
                    <div className="px-3 pt-3 pb-2 flex-shrink-0">
                        <div
                            {...getRootProps()}
                            onClick={open}
                            className={cn(
                                "relative group border border-dashed rounded-lg px-3 py-2 flex items-center gap-3 cursor-pointer transition-all duration-300",
                                "hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 hover:border-[#1e96eb]/50",
                                isDragActive ? "border-[#1e96eb] bg-[#1e96eb]/5 scale-[0.99]" : "border-zinc-200 dark:border-zinc-800"
                            )}
                        >
                            <div className="p-1.5 bg-[var(--vlaina-bg-tertiary)] rounded-md transition-colors group-hover:bg-[#1e96eb]/10 group-hover:text-[#1e96eb] text-[var(--vlaina-text-tertiary)]">
                                <Icon size="md" name="common.upload" />
                            </div>

                            <div className="flex flex-col items-start gap-0.5">
                                <span className="text-[11px] font-medium text-[var(--vlaina-text-primary)] group-hover:text-[#1e96eb] transition-colors leading-none mt-0.5">
                                    Upload from device
                                </span>
                                <span className="text-[9px] text-[var(--vlaina-text-tertiary)] leading-none">
                                    Supports <span className="font-medium text-[var(--vlaina-text-secondary)]">PNG</span>, <span className="font-medium text-[#1e96eb]">GIF</span> & <span className="font-medium text-[#1e96eb]">WebP</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-900 px-3 pb-2">
                        <CustomIconLibraryGrid
                            customIcons={customIcons}
                            imageLoader={imageLoader}
                            onDeleteCustomIcon={onDeleteCustomIcon}
                            onPreview={onPreview}
                            onSelect={handleLibraryItemClick}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
