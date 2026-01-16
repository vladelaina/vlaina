import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import Cropper from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Upload, X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCroppedImg } from '@/lib/assets/imageLoader';
import { useNotesStore } from '@/stores/useNotesStore';
import { useToastStore } from '@/stores/useToastStore';
import { NoteIcon } from './NoteIcon';
import { PremiumSlider } from '@/components/ui/premium-slider';
import { CustomEmoji } from '@/stores/notes/slices/customEmojiSlice';

interface UploadTabProps {
    onSelect: (value: string) => void;
    onPreview?: (url: string | null) => void;
    onClose: () => void;
}

export function UploadTab({ onSelect, onPreview, onClose }: UploadTabProps) {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const uploadAsset = useNotesStore(s => s.uploadAsset);
    const addWorkspaceEmoji = useNotesStore(s => s.addWorkspaceEmoji);
    const removeWorkspaceEmoji = useNotesStore(s => s.removeWorkspaceEmoji);
    const workspaceEmojis = useNotesStore(s => s.workspaceEmojis);
    const loadWorkspaceEmojis = useNotesStore(s => s.loadWorkspaceEmojis);

    useEffect(() => {
        loadWorkspaceEmojis();
    }, [loadWorkspaceEmojis]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles && acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
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

    const handleSave = async () => {
        if (!imageSrc || !croppedAreaPixels) return;

        try {
            setIsUploading(true);

            // 1. Generate Timestamp Name
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
            const finalName = `icon_${timestamp[0]}_${timestamp[1].split('Z')[0]}`;

            // 2. Get cropped blob
            const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
            if (!croppedBlob) throw new Error('Failed to crop image');

            // 3. Convert to File
            const file = new File([croppedBlob], `${finalName}.png`, { type: 'image/png' });

            // 4. Upload to 'icons' folder
            const result = await uploadAsset(file, 'icons');
            if (!result.success || !result.path) {
                throw new Error(result.error || 'Upload failed');
            }

            // 5. Construct asset URL (format: "img:icons/filename.png")
            const assetUrl = `img:${result.path}`;

            // 6. Always Add to library
            const newEmoji: CustomEmoji = {
                // Use filename as ID to match file-system based loading
                id: `${finalName}.png`,
                name: finalName,
                url: assetUrl,
                createdAt: Date.now(),
            };
            await addWorkspaceEmoji(newEmoji);

            // 7. Select and Close
            onSelect(assetUrl);
            onClose();

        } catch (e) {
            console.error(e);
            useToastStore.getState().addToast('Failed to save icon. Please try again.', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (deletingId === id) {
            // Second click: Confirm deletion
            await removeWorkspaceEmoji(id);
            setDeletingId(null);
        } else {
            // First click: Enter confirmation state
            setDeletingId(id);
        }
    };

    // Helper to handle library item click
    const handleLibraryItemClick = (url: string) => {
        if (deletingId) return; // Don't select if we're in deleting state
        onSelect(url);
        onClose();
    };

    return (
        <div className="h-[320px] flex flex-col relative">
            <input {...getInputProps()} />
            {imageSrc ? (
                // Cropping Mode - Focused & Minimalist
                <div className="flex flex-col flex-1 px-5 pt-3 pb-6">
                    <div
                        {...getRootProps({ onClick: (e) => e.stopPropagation() })}
                        className="relative flex-1 bg-zinc-950 rounded-lg overflow-hidden mb-6 group/cropper"
                    >
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

                        {/* Direct Re-upload Overlay */}
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
                            <Upload size={14} />
                        </button>
                    </div>

                    <div className="flex flex-col gap-6">
                        {/* High-Performance Slider */}
                        <div className="flex items-center gap-4">
                            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 w-10">Zoom</span>
                            <PremiumSlider
                                min={1}
                                max={3}
                                step={0.1}
                                value={zoom}
                                onChange={(val: number) => setZoom(val)}
                            />
                        </div>

                        <div className="flex justify-between items-center mt-2">
                            <button
                                type="button"
                                onClick={() => setImageSrc(null)}
                                className="text-sm font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
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
                                        className="animate-spin h-4 w-4 text-current"
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
                // Library Mode
                <div className="flex flex-col flex-1 min-h-0">
                    <div className="px-3 pt-3 pb-2 flex-shrink-0">
                        <div
                            {...getRootProps()}
                            onClick={open}
                            className={cn(
                                "h-8 border border-dashed rounded-md flex items-center justify-center cursor-pointer transition-all",
                                "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:border-[#1e96eb]",
                                isDragActive ? "border-[#1e96eb] bg-[#1e96eb]/5" : "border-zinc-200 dark:border-zinc-800"
                            )}
                        >
                            <div className="flex items-center justify-center text-zinc-400">
                                <Upload className="size-4 stroke-[1.5px]" />
                            </div>
                        </div>
                    </div>

                    {/* Library Grid */}
                    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-900 px-3">
                        <div className="flex-1 overflow-y-auto neko-scrollbar pr-1 grid grid-cols-7 gap-2 content-start pb-2">
                            {workspaceEmojis.map((emoji) => (
                                <div
                                    key={emoji.id}
                                    className="relative aspect-square flex items-center justify-center cursor-pointer transition-all active:scale-95 group/item"
                                    onClick={() => handleLibraryItemClick(emoji.url)}
                                    onMouseEnter={() => !deletingId && onPreview?.(emoji.url)}
                                    onMouseLeave={() => {
                                        onPreview?.(null);
                                        if (deletingId === emoji.id) setDeletingId(null);
                                    }}
                                >
                                    <div className={cn(
                                        "w-full h-full transition-all duration-300",
                                        deletingId === emoji.id ? "opacity-40 blur-[0.5px]" : "opacity-100"
                                    )}>
                                        <NoteIcon
                                            icon={emoji.url}
                                            size={44}
                                            className="w-full h-full object-contain"
                                        />
                                    </div>

                                    {/* Deletion Overlay (X / Trash) */}
                                    {deletingId === emoji.id ? (
                                        <div
                                            className="absolute inset-0 flex items-center justify-center cursor-pointer z-30"
                                            onClick={(e) => handleDelete(e, emoji.id)}
                                        >
                                            <div className="text-red-500 transition-all active:scale-90 pointer-events-none">
                                                <Trash2 size={24} strokeWidth={2} />
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={(e) => handleDelete(e, emoji.id)}
                                            className={cn(
                                                "absolute -top-1 -right-1 z-20 p-1.5 transition-all duration-200",
                                                "flex items-center justify-center",
                                                "text-zinc-400 hover:text-red-500 opacity-0 group-hover/item:opacity-100 scale-90 hover:scale-100"
                                            )}
                                        >
                                            <X size={12} strokeWidth={2.5} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {workspaceEmojis.length === 0 && (
                                <div className="col-span-7 py-8 text-center text-xs text-muted-foreground italic">
                                    No saved icons yet
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
