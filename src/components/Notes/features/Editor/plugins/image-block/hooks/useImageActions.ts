import { useCallback, useState } from 'react';
import { useToastStore } from '@/stores/useToastStore';
import { generateCropFragment } from '../utils/cropUtils';
import { ensureImageFileExists } from '../utils/fileUtils';
import { EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';

interface UseImageActionsProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
    baseSrc: string;
    resolvedSrc?: string;
    notesPath: string;
    currentNotePath?: string;
    updateNodeAttrs: (attrs: Record<string, any>) => void;
    setCropParams: (params: any) => void;
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

    const restoreIfNeeded = useCallback(async () => {
        if (baseSrc && resolvedSrc) {
            await ensureImageFileExists(baseSrc, resolvedSrc, notesPath, currentNotePath);
        }
    }, [baseSrc, resolvedSrc, notesPath, currentNotePath]);

    const handleSave = async (percentageCrop: any, ratio: number) => {
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
            } else {
                await navigator.clipboard.writeText(node.attrs.src || '');
            }
        } catch {
            try { await navigator.clipboard.writeText(node.attrs.src || ''); } catch { }
        }
    };

    const handleDownload = async () => {
        if (!resolvedSrc) return;
        try {
            await restoreIfNeeded();
            const { save } = await import('@tauri-apps/plugin-dialog');
            const { writeFile } = await import('@tauri-apps/plugin-fs');
            const ext = baseSrc.split('.').pop()?.split('?')[0] || 'png';
            const defaultName = (node.attrs.alt || 'image') + '.' + ext;
            const filePath = await save({ defaultPath: defaultName, filters: [{ name: 'Images', extensions: ['png', 'jpg', 'webp'] }] });
            if (!filePath) return;
            const response = await fetch(resolvedSrc);
            const blob = await response.blob();
            await writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
        } catch {
            const link = document.createElement('a');
            link.href = resolvedSrc;
            link.download = node.attrs.alt || 'image';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDelete = () => {
        const pos = getPos();
        if (pos !== undefined) {
            view.dispatch(view.state.tr.delete(pos, pos + node.nodeSize));
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
