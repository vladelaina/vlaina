import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import Cropper from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCroppedImg } from '@/lib/assets/imageLoader';
import { useNotesStore } from '@/stores/useNotesStore';
import { useToastStore } from '@/stores/useToastStore';
import { NoteIcon } from './NoteIcon';
import { PremiumSlider } from '@/components/ui/premium-slider';
import { CustomEmoji } from '@/stores/notes/slices/customEmojiSlice';
import { DeletableItem } from '@/components/ui/deletable-item';

interface UploadTabProps {
    onSelect: (value: string) => void;
    onPreview?: (url: string | null) => void;
    onClose: () => void;
}

export function UploadTab({ onSelect, onPreview, onClose }: UploadTabProps) {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [originalFile, setOriginalFile] = useState<File | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);

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

        try {
            setIsUploading(true);

            // 1. Generate Timestamp Name
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
            const finalName = `icon_${timestamp[0]}_${timestamp[1].split('Z')[0]}`;

            let fileToUpload: File;

            if (shouldPreserve && originalFile) {
                // For GIFs/WebP, preserve original file (animation/quality)
                const ext = isGif ? 'gif' : 'webp';
                fileToUpload = new File([originalFile], `${finalName}.${ext}`, { type: originalFile.type });
            } else {
                // 2. Get cropped blob
                const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
                if (!croppedBlob) throw new Error('Failed to crop image');

                // 3. Convert to File
                fileToUpload = new File([croppedBlob], `${finalName}.png`, { type: 'image/png' });
            }

            // 4. Upload to 'icons' folder
            const result = await uploadAsset(fileToUpload, 'icons');
            if (!result.success || !result.path) {
                throw new Error(result.error || 'Upload failed');
            }

            // 5. Construct asset URL
            const assetUrl = `img:${result.path}`;

            // 6. Always Add to library
            const newEmoji: CustomEmoji = {
                // Use filename as ID to match file-system based loading
                id: fileToUpload.name,
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



    // Helper to handle library item click
    const handleLibraryItemClick = (url: string) => {
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
                        {/* High-Performance Slider (Hidden for GIFs) */}
                        {!isGif && (
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
                        )}

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
                                "relative group border border-dashed rounded-lg px-3 py-2 flex items-center gap-3 cursor-pointer transition-all duration-300",
                                "hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 hover:border-[#1e96eb]/50",
                                isDragActive ? "border-[#1e96eb] bg-[#1e96eb]/5 scale-[0.99]" : "border-zinc-200 dark:border-zinc-800"
                            )}
                        >
                            <div className="p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-md transition-colors group-hover:bg-[#1e96eb]/10 group-hover:text-[#1e96eb] text-zinc-400">
                                <Upload className="size-3.5" />
                            </div>

                            <div className="flex flex-col items-start gap-0.5">
                                <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-[#1e96eb] transition-colors leading-none mt-0.5">
                                    Upload from device
                                </span>
                                <span className="text-[9px] text-zinc-400 leading-none">
                                    Supports <span className="font-medium text-zinc-500 dark:text-zinc-400">PNG</span>, <span className="font-medium text-[#1e96eb]">GIF</span> & <span className="font-medium text-[#1e96eb]">WebP</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Library Grid */}
                    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-900 px-3">
                        <div className="flex-1 overflow-y-auto neko-scrollbar pr-1 grid grid-cols-7 gap-2 content-start pb-2">
                            {workspaceEmojis.map((emoji) => (
                                <DeletableItem
                                    key={emoji.id}
                                    id={emoji.id}
                                    onDelete={(id) => removeWorkspaceEmoji(id)}
                                    className="relative aspect-square flex items-center justify-center cursor-pointer transition-all active:scale-95"
                                >
                                    <div
                                        className="w-full h-full"
                                        onClick={() => handleLibraryItemClick(emoji.url)}
                                        onMouseEnter={() => onPreview?.(emoji.url)}
                                        onMouseLeave={() => onPreview?.(null)}
                                    >
                                        <NoteIcon
                                            icon={emoji.url}
                                            size={44}
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                </DeletableItem>
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
