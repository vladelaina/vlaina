import { useCallback, useState } from 'react';
import { useToastStore } from '@/stores/useToastStore';
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

interface UseImageActionsProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
    baseSrc: string;
    resolvedSrc?: string;
    notesPath: string;
    currentNotePath?: string;
    updateNodeAttrs: (attrs: ImageNodeAttrs) => void;
    setCropParams: (params: CropParams | null) => void;
    setIsActive: (active: boolean) => void;
    setHeight: (h: number | undefined) => void;
}

export function useImageActions({
    node, view, getPos,
    baseSrc, resolvedSrc,
    notesPath, currentNotePath,
    updateNodeAttrs, setCropParams, setIsActive, setHeight
}: UseImageActionsProps) {
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
            setIsSaving(true);
            await restoreIfNeeded();
            const fragment = generateCropFragment(percentageCrop, ratio);
            setCropParams({ 
                x: percentageCrop.x, 
                y: percentageCrop.y, 
                width: percentageCrop.width, 
                height: percentageCrop.height, 
                ratio 
            });
            updateNodeAttrs({ src: `${baseSrc}#${fragment}` });
            setIsActive(false);
            setHeight(undefined);
        } catch (error) {
            console.error('Save failed:', error);
            addToast('Failed to update view', 'error');
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
            const ext = baseSrc.split('.').pop()?.split('?')[0] || 'png';
            const defaultName = (nodeAlt || 'image') + '.' + ext;
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
