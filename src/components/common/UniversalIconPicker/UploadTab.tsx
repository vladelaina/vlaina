import { useCallback, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import Cropper from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { DeleteIcon } from '@/components/common/DeleteIcon';
import { cn } from '@/lib/utils';
import { getCroppedImg } from '@/lib/assets/processing/crop';
import { useToastStore } from '@/stores/useToastStore';
import { PremiumSlider } from '@/components/ui/premium-slider';
import { UniversalIcon } from './UniversalIcon';
import { useI18n } from '@/lib/i18n';
import { SidebarContextMenu } from '@/components/layout/sidebar/SidebarContextMenu';
import {
    SidebarContextMenuContent,
    type SidebarMenuEntry,
} from '@/components/layout/sidebar/context-menu/SidebarContextMenuContent';
import type { SidebarMenuPosition } from '@/components/layout/sidebar/context-menu/shared';
import { sanitizeSvgBytes } from '@/lib/markdown/svgSanitizer';
import { themeIconTokens, themeStyleResetTokens } from '@/styles/themeTokens';

export interface CustomIcon {
    id: string;
    url: string;
    name: string;
}

function isSvgFile(file: File): boolean {
    return file.type.split(';')[0]?.trim().toLowerCase() === 'image/svg+xml'
        || /\.svg$/i.test(file.name);
}

async function readUploadPreviewDataUrl(file: File): Promise<string | null> {
    if (isSvgFile(file)) {
        const bytes = sanitizeSvgBytes(new Uint8Array(await file.arrayBuffer()));
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new TextDecoder().decode(bytes))}`;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            resolve(typeof reader.result === 'string' ? reader.result : null);
        });
        reader.addEventListener('error', () => reject(reader.error));
        reader.readAsDataURL(file);
    });
}

interface UploadTabProps {
    onSelect: (value: string) => void;
    onPreview?: (url: string | null) => void;
    onClose: () => void;
    customIcons?: CustomIcon[];
    onUploadFile?: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
    onDeleteCustomIcon?: (id: string) => void | Promise<void>;
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
    const { t } = useI18n();
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [originalFile, setOriginalFile] = useState<File | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [contextMenu, setContextMenu] = useState<{
        icon: CustomIcon;
        position: SidebarMenuPosition;
    } | null>(null);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles && acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            setOriginalFile(file);
            readUploadPreviewDataUrl(file)
                .then((dataUrl) => setImageSrc(dataUrl))
                .catch(() => setImageSrc(null));
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
            useToastStore.getState().addToast(t('icon.uploadUnsupported'), 'error');
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
            useToastStore.getState().addToast(t('icon.failedSave'), 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleLibraryItemClick = (url: string) => {
        onSelect(url);
        onClose();
    };

    const handleLibraryItemContextMenu = (event: React.MouseEvent, icon: CustomIcon) => {
        if (!onDeleteCustomIcon) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        setContextMenu({
            icon,
            position: {
                top: event.clientY,
                left: event.clientX,
            },
        });
    };

    const contextMenuEntries = useMemo<SidebarMenuEntry[]>(() => {
        if (!contextMenu || !onDeleteCustomIcon) {
            return [];
        }

        return [
            {
                key: 'delete',
                icon: <DeleteIcon />,
                label: t('sidebar.delete'),
                danger: true,
                onClick: async () => {
                    onPreview?.(null);
                    await onDeleteCustomIcon(contextMenu.icon.id);
                    setContextMenu(null);
                },
            },
        ];
    }, [contextMenu, onDeleteCustomIcon, onPreview, t]);

    return (
        <div className="h-[var(--vlaina-size-320px)] flex flex-col relative">
            <input {...getInputProps()} />
            {imageSrc ? (
                <div className="flex flex-col flex-1 px-5 pt-3 pb-6">
                    <div
                        {...getRootProps({ onClick: (e) => e.stopPropagation() })}
                        className="relative flex-1 bg-[var(--vlaina-color-inverse-surface)] rounded-lg overflow-hidden mb-6 group/cropper flex items-center justify-center h-[var(--vlaina-size-180px)]"
                    >
                        {shouldPreserve ? (
                            <>
                                <img
                                    src={imageSrc}
                                    className="max-w-full max-h-full object-contain"
                                    alt="Preview"
                                />
                                <div className="absolute bottom-3 left-3 bg-[var(--vlaina-color-overlay)] text-[var(--vlaina-color-inverse-text)] text-[var(--vlaina-font-10)] px-2 py-1 rounded-full backdrop-blur-[var(--vlaina-backdrop-blur-sm)] border border-[var(--vlaina-color-panel-border)] flex items-center gap-1.5 pointer-events-none">
                                    <span className="relative flex h-2 w-2">
                                        <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-[var(--vlaina-opacity-75)] animate-ping", isGif ? "bg-[var(--vlaina-color-status-success-fg)]" : "bg-[var(--vlaina-color-status-info-fg)]")}></span>
                                        <span className={cn("relative inline-flex rounded-full h-2 w-2", isGif ? "bg-[var(--vlaina-color-status-success-fg)]" : "bg-[var(--vlaina-color-status-info-fg)]")}></span>
                                    </span>
                                    {isGif ? t('icon.animationPreserved') : t('icon.originalFormat')}
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
                                "absolute top-3 right-3 z-[var(--vlaina-z-10)] p-2",
                                "text-[var(--vlaina-color-text-soft)] hover:text-[var(--vlaina-color-inverse-text)] transition-all",
                                "opacity-[var(--vlaina-opacity-0)] group-hover/cropper:opacity-[var(--vlaina-opacity-100)]",
                                "active:scale-[var(--vlaina-scale-95)]"
                            )}
                        >
                            <Icon name="common.upload" size="md" />
                        </button>
                    </div>

                    <div className="flex flex-col gap-6">
                        {!isGif && (
                            <div className="flex items-center gap-4">
                                <span className="text-[var(--vlaina-font-11)] font-medium uppercase tracking-wider text-[var(--vlaina-text-tertiary)] w-10">{t('icon.zoom')}</span>
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
                                {t('common.cancel')}
                            </button>
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={isUploading}
                                className="bg-[var(--vlaina-accent)] hover:bg-[var(--vlaina-accent-hover)] text-[var(--vlaina-color-white)] px-8 h-9 rounded-full font-medium shadow-[var(--vlaina-shadow-sm)] transition-all active:scale-[var(--vlaina-scale-95)] inline-flex items-center justify-center min-w-[var(--vlaina-size-80px)]"
                            >
                                {isUploading ? (
                                    <svg
                                        className="animate-spin w-[var(--vlaina-size-18px)] h-[var(--vlaina-size-18px)] text-current"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill={themeStyleResetTokens.fillNone}
                                        viewBox={themeIconTokens.viewBoxDefault}
                                    >
                                        <circle
                                            className="opacity-[var(--vlaina-opacity-25)]"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke={themeStyleResetTokens.currentColor}
                                            strokeWidth={themeIconTokens.strokeUploadSpinner}
                                        />
                                        <path
                                            className="opacity-[var(--vlaina-opacity-100)]"
                                            fill={themeStyleResetTokens.currentColor}
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                ) : t('app.unsavedDraftsCancel')}
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
                                "relative group border border-dashed rounded-lg px-3 py-2.5 flex items-center gap-2.5 cursor-pointer transition-all duration-[var(--vlaina-duration-300)]",
                                "hover:bg-[var(--vlaina-hover)] hover:border-[var(--vlaina-color-accent-border-hover)]",
                                isDragActive ? "border-[var(--vlaina-accent)] bg-[var(--vlaina-accent-light)] scale-[var(--vlaina-scale-99)]" : "border-[var(--vlaina-border)]"
                            )}
                        >
                            <div className="p-1.5 bg-[var(--vlaina-bg-tertiary)] rounded-md transition-colors group-hover:bg-[var(--vlaina-accent-light)] group-hover:text-[var(--vlaina-accent)] text-[var(--vlaina-text-tertiary)] shrink-0">
                                <Icon size="sm" name="common.upload" />
                            </div>

                            <span className="text-[var(--vlaina-font-10)] text-[var(--vlaina-text-tertiary)] leading-none">
                                {t('icon.supports')} <span className="font-medium text-[var(--vlaina-text-secondary)]">PNG</span>, <span className="font-medium text-[var(--vlaina-accent)]">GIF</span> & <span className="font-medium text-[var(--vlaina-accent)]">WebP</span>
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col min-h-0 bg-[var(--vlaina-bg-primary)] px-3">
                        <div className="flex-1 overflow-y-auto app-scrollbar pr-1 grid grid-cols-7 gap-2 content-start pb-2">
                            {customIcons.map((emoji) => (
                                <div
                                    key={emoji.id}
                                    className="relative aspect-square flex items-center justify-center cursor-pointer transition-all active:scale-[var(--vlaina-scale-95)]"
                                    onClick={() => handleLibraryItemClick(emoji.url)}
                                    onContextMenu={(event) => handleLibraryItemContextMenu(event, emoji)}
                                    onMouseEnter={() => onPreview?.(emoji.url)}
                                    onMouseLeave={() => onPreview?.(null)}
                                >
                                    <UniversalIcon
                                        icon={emoji.url}
                                        size={themeIconTokens.sizeUploadPreview}
                                        className="w-full h-full object-contain"
                                        imageLoader={imageLoader}
                                    />
                                </div>
                            ))}
                            {customIcons.length === 0 && (
                                <div className="col-span-7 py-8 text-center text-xs text-muted-foreground italic">
                                    {t('icon.uploadImageForNoteIcon')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {contextMenu && (
                <SidebarContextMenu
                    isOpen
                    onClose={() => setContextMenu(null)}
                    position={contextMenu.position}
                >
                    <SidebarContextMenuContent entries={contextMenuEntries} />
                </SidebarContextMenu>
            )}
        </div>
    );
}
