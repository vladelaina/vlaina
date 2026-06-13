import { useCallback, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToastStore } from '@/stores/useToastStore';
import { sanitizeFilename } from '@/lib/assets/core/naming';
import { writeTextToClipboard } from '@/lib/clipboard';
import { writeDesktopBinaryFile } from '@/lib/desktop/fs';
import { fetchBoundedImageBlobResult, MAX_FETCHED_IMAGE_BYTES } from '@/lib/markdown/fetchBoundedImageBlob';
import { isSvgImageMimeType, rasterizeSvgBlobToPngBlob } from '@/lib/markdown/svgRasterize';
import { saveDialog } from '@/lib/storage/dialog';
import { ensureImageFileExists } from '../utils/fileUtils';
import { EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { deleteImageNodeAtPos } from '../commands/imageNodeCommands';
import type { CropArea, ImageNodeAttrs } from '../types';
import type { CropParams } from '../utils/imageSourceFragment';

const DOWNLOAD_IMAGE_EXTENSIONS = new Set(['gif', 'jpeg', 'jpg', 'png', 'webp']);

function isValidCropArea(value: CropArea): boolean {
    return Number.isFinite(value.x)
        && Number.isFinite(value.y)
        && Number.isFinite(value.width)
        && Number.isFinite(value.height)
        && value.width > 0
        && value.height > 0;
}

function getSafeDownloadExtension(src: string) {
    const extension = src.split('#')[0]?.split('?')[0]?.split('.').pop()?.toLowerCase() ?? '';
    return DOWNLOAD_IMAGE_EXTENSIONS.has(extension) ? extension : 'png';
}

function isLikelySvgImageSource(src: string | null | undefined): boolean {
    const normalized = src?.split('#')[0]?.split('?')[0]?.trim().toLowerCase() ?? '';
    return normalized.endsWith('.svg') || normalized.endsWith('.svgz');
}

function isBlobByteLengthWithinLimit(size: number, maxBytes: number): boolean {
    return Number.isFinite(size) && size >= 0 && size <= maxBytes;
}

async function normalizeActionImageBlob(blob: Blob): Promise<Blob | null> {
    if (!blob.type.startsWith('image/')) {
        return null;
    }

    const outputBlob = isSvgImageMimeType(blob.type)
        ? await rasterizeSvgBlobToPngBlob(blob)
        : blob;

    if (
        !outputBlob ||
        !outputBlob.type.startsWith('image/') ||
        !isBlobByteLengthWithinLimit(outputBlob.size, MAX_FETCHED_IMAGE_BYTES)
    ) {
        return null;
    }

    return outputBlob;
}

export function createImageDownloadDefaultName(alt: string, src: string) {
    const sanitizedBase = sanitizeFilename(alt.replace(/[\u0000-\u001f\u007f]/g, ''))
        .replace(/^\.+|\.+$/g, '') || 'image';
    return `${sanitizedBase}.${getSafeDownloadExtension(src)}`;
}

async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
    if (typeof blob.arrayBuffer === 'function') {
        return new Uint8Array(await blob.arrayBuffer());
    }

    return await new Promise<Uint8Array>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (result instanceof ArrayBuffer) {
                resolve(new Uint8Array(result));
                return;
            }
            reject(new Error('Unable to read image blob.'));
        };
        reader.onerror = () => reject(reader.error ?? new Error('Unable to read image blob.'));
        reader.onabort = () => reject(new Error('Image blob read was aborted.'));
        reader.readAsArrayBuffer(blob);
    });
}

interface UseImageActionsProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
    baseSrc: string;
    resolvedSrc?: string;
    notesPath: string;
    currentNotePath?: string;
    updateNodeAttrs: (attrs: ImageNodeAttrs) => void;
    markImageUserInput: () => void;
    setCropParams: (params: CropParams | null) => void;
    setIsActive: (active: boolean) => void;
    setHeight: (h: number | undefined) => void;
}

export function useImageActions({
    node, view, getPos,
    baseSrc, resolvedSrc,
    notesPath, currentNotePath,
    updateNodeAttrs, markImageUserInput, setCropParams, setIsActive, setHeight
}: UseImageActionsProps) {
    const { t } = useI18n();
    const { addToast } = useToastStore();
    const [isSaving, setIsSaving] = useState(false);
    const nodeSrc = typeof node.attrs.src === 'string' ? node.attrs.src : '';
    const nodeAlt = typeof node.attrs.alt === 'string' ? node.attrs.alt : '';

    const restoreIfNeeded = useCallback(async () => {
        if (baseSrc && resolvedSrc) {
            await ensureImageFileExists(baseSrc, resolvedSrc, notesPath, currentNotePath);
        }
    }, [baseSrc, resolvedSrc, notesPath, currentNotePath]);

    const handleSave = async (percentageCrop: CropArea, ratio: number) => {
        try {
            if (!isValidCropArea(percentageCrop) || !Number.isFinite(ratio) || ratio <= 0) {
                addToast(t('editor.invalidCropState'), 'error');
                return;
            }

            setIsSaving(true);
            markImageUserInput();
            await restoreIfNeeded();
            const cropParams = {
                x: percentageCrop.x, 
                y: percentageCrop.y, 
                width: percentageCrop.width, 
                height: percentageCrop.height, 
                ratio 
            };
            setCropParams(cropParams);
            updateNodeAttrs({ src: baseSrc, crop: cropParams });
            setIsActive(false);
            setHeight(undefined);
        } catch (error) {
            addToast(t('editor.updateViewFailed'), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopy = async () => {
        try {
            await restoreIfNeeded();
            if (resolvedSrc) {
                const result = await fetchBoundedImageBlobResult(resolvedSrc);
                if (result.status === 'too-large') {
                    return false;
                }
                const blob = await normalizeActionImageBlob(result.blob);
                if (!blob) {
                    return writeTextToClipboard(nodeSrc);
                }
                await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
                return true;
            } else {
                return writeTextToClipboard(nodeSrc);
            }
        } catch {
            try { return await writeTextToClipboard(nodeSrc); } catch { return false; }
        }
    };

    const handleDownload = async () => {
        if (!resolvedSrc) return;
        let allowAnchorFallback = !isLikelySvgImageSource(baseSrc) && !isLikelySvgImageSource(resolvedSrc);
        try {
            await restoreIfNeeded();
            const defaultName = createImageDownloadDefaultName(nodeAlt || 'image', baseSrc);
            const filePath = await saveDialog({ defaultPath: defaultName, filters: [{ name: 'Images', extensions: ['png', 'jpg', 'webp'] }] });
            if (!filePath) return;
            const result = await fetchBoundedImageBlobResult(resolvedSrc);
            if (result.status === 'too-large') return;
            if (isSvgImageMimeType(result.blob.type)) {
                allowAnchorFallback = false;
            }
            const blob = await normalizeActionImageBlob(result.blob);
            if (!blob) return;
            await writeDesktopBinaryFile(filePath, await readBlobBytes(blob));
        } catch {
            if (!allowAnchorFallback) return;
            const link = document.createElement('a');
            link.href = resolvedSrc;
            link.download = nodeAlt || 'image';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDelete = () => {
        const pos = getPos();
        if (pos !== undefined) {
            markImageUserInput();
            deleteImageNodeAtPos(view, pos);
        }
    };

    return {
        isSaving,
        handleSave,
        handleCopy,
        handleDownload,
        handleDelete,
        restoreIfNeeded
    };
}
