import { useCallback, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToastStore } from '@/stores/useToastStore';
import { sanitizeFilename } from '@/lib/assets/core/naming';
import { writeTextToClipboard } from '@/lib/clipboard';
import { writeDesktopBinaryFile } from '@/lib/desktop/fs';
import { saveDialog } from '@/lib/storage/dialog';
import { generateCropFragment } from '../utils/imageSourceFragment';
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

export function createImageDownloadDefaultName(alt: string, src: string) {
    const sanitizedBase = sanitizeFilename(alt.replace(/[\u0000-\u001f\u007f]/g, ''))
        .replace(/^\.+|\.+$/g, '') || 'image';
    return `${sanitizedBase}.${getSafeDownloadExtension(src)}`;
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
            const fragment = generateCropFragment(percentageCrop, ratio);
            const nextSrc = `${baseSrc}#${fragment}`;
            setCropParams({ 
                x: percentageCrop.x, 
                y: percentageCrop.y, 
                width: percentageCrop.width, 
                height: percentageCrop.height, 
                ratio 
            });
            updateNodeAttrs({ src: nextSrc });
            setIsActive(false);
            setHeight(undefined);
        } catch (error) {
            console.error('Save failed:', error);
            addToast(t('editor.updateViewFailed'), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopy = async () => {
        try {
            await restoreIfNeeded();
            if (resolvedSrc) {
                const response = await fetch(resolvedSrc);
                const blob = await response.blob();
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
        try {
            await restoreIfNeeded();
            const defaultName = createImageDownloadDefaultName(nodeAlt || 'image', baseSrc);
            const filePath = await saveDialog({ defaultPath: defaultName, filters: [{ name: 'Images', extensions: ['png', 'jpg', 'webp'] }] });
            if (!filePath) return;
            const response = await fetch(resolvedSrc);
            const blob = await response.blob();
            await writeDesktopBinaryFile(filePath, new Uint8Array(await blob.arrayBuffer()));
        } catch {
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
