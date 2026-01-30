import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PremiumSlider } from '@/components/ui/premium-slider';
import { getCroppedImg } from '@/lib/assets/imageLoader';
import { cn } from '@/lib/utils';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useToastStore } from '@/stores/useToastStore';

interface ImageEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageSrc: string;
    onSave: (newSrc: string) => void;
}

export function ImageEditorModal({ isOpen, onClose, imageSrc, onSave }: ImageEditorModalProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const { uploadAsset, currentNote } = useNotesStore();
    const { addToast } = useToastStore();


    const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSave = async () => {
        if (!croppedAreaPixels) return;

        try {
            setIsSaving(true);

            // 1. Get cropped blob
            const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
            if (!croppedBlob) throw new Error('Failed to crop image');

            // 2. Generate new file
            // Use existing filename/type if possible or default to png
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
            const fileName = `edited_image_${timestamp[0]}_${timestamp[1].split('Z')[0]}.png`;

            const fileToUpload = new File([croppedBlob], fileName, { type: 'image/png' });

            // 3. Upload Asset
            const result = await uploadAsset(fileToUpload, 'covers', currentNote?.path);

            if (result.success && result.path) {
                onSave(result.path);
                onClose();
                addToast('Image updated successfully', 'success');
            } else {
                throw new Error(result.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Failed to save edited image:', error);
            addToast('Failed to save image. Please try again.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-[var(--neko-bg-primary)] border-[var(--neko-border)]">
                <DialogHeader className="p-4 border-b border-[var(--neko-border)]">
                    <DialogTitle className="text-sm font-medium">Edit Image</DialogTitle>
                </DialogHeader>

                <div className="p-0">
                    {/* Cropper Area */}
                    <div className="relative h-[400px] w-full bg-black/5">
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={undefined} // Free aspect ratio
                            onCropChange={setCrop}
                            onCropComplete={onCropComplete}
                            onZoomChange={setZoom}
                            showGrid={false}
                            zoomWithScroll={true}
                            zoomSpeed={0.5}
                            minZoom={1}
                            maxZoom={5}
                            restrictPosition={false} // Allow moving image freely
                        />
                    </div>

                    {/* Controls */}
                    <div className="p-4 space-y-4">
                        <div className="flex items-center gap-4">
                            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--neko-text-tertiary)] w-10">Zoom</span>
                            <PremiumSlider
                                min={1}
                                max={5}
                                step={0.1}
                                value={zoom}
                                onChange={(val: number) => setZoom(val)}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-4 border-t border-[var(--neko-border)] flex justify-between sm:justify-between items-center bg-[var(--neko-bg-secondary)]/30">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="text-[var(--neko-text-secondary)] hover:text-[var(--neko-text-primary)]"
                    >
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving}
                        className={cn(
                            "bg-[var(--neko-accent)] hover:bg-[var(--neko-accent-hover)] text-white px-6 rounded-lg font-medium shadow-sm transition-all active:scale-95",
                            isSaving && "opacity-70 cursor-not-allowed"
                        )}
                    >
                        {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}