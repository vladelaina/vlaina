import { useState, useEffect, useCallback, useMemo } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { parseCropFragment, CropParams } from '../utils/cropUtils';
import { useLocalImage } from './useLocalImage';
import type { Alignment } from '../types';

interface UseImageBlockStateProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
}

export function useImageBlockState({ node, view, getPos }: UseImageBlockStateProps) {
    // Node Attributes
    const [width, setWidth] = useState(node.attrs.width || 'auto');
    const [alignment, setAlignment] = useState<Alignment>((node.attrs.align as Alignment) || 'center');
    const [captionInput, setCaptionInput] = useState(node.attrs.alt || '');

    // Visual State
    const [height, setHeight] = useState<number | undefined>(undefined);
    const [isHovered, setIsHovered] = useState(false);
    const [isEditingCaption, setIsEditingCaption] = useState(false);
    const [isActive, setIsActive] = useState(false); // Cropper Active
    const [isReady, setIsReady] = useState(!!node.attrs.width);
    
    // Image Data
    const [naturalRatio, setNaturalRatio] = useState<number | null>(null);
    const [imageNaturalSize, setImageNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
    const [cropParams, setCropParams] = useState<CropParams | null>(null);

    // Global Store
    const notesPath = useNotesStore(s => s.notesPath);
    const currentNotePath = useNotesStore(s => s.currentNote?.path);

    // Source Resolution
    const { baseSrc, params: initialParams } = useMemo(() => parseCropFragment(node.attrs.src || ''), [node.attrs.src]);
    const { resolvedSrc, isLoading, error: loadError } = useLocalImage(baseSrc, notesPath, currentNotePath);

    // Sync from Node
    useEffect(() => {
        setCropParams(initialParams);
    }, [initialParams]);

    useEffect(() => {
        if (loadError) setIsReady(true);
    }, [loadError]);

    useEffect(() => {
        const newAlignment = (node.attrs.align as Alignment) || 'center';
        if (alignment !== newAlignment) setAlignment(newAlignment);
        
        const newWidth = node.attrs.width || 'auto';
        if (width !== newWidth) setWidth(newWidth);
    }, [node.attrs.align, node.attrs.width]);

    // Helpers
    const updateNodeAttrs = useCallback((attrs: Record<string, any>) => {
        const pos = getPos();
        if (pos !== undefined) {
            view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs }));
        }
    }, [view, getPos, node.attrs]);

    return {
        width, setWidth,
        height, setHeight,
        alignment, setAlignment,
        captionInput, setCaptionInput,
        isHovered, setIsHovered,
        isEditingCaption, setIsEditingCaption,
        isActive, setIsActive,
        isReady, setIsReady,
        naturalRatio, setNaturalRatio,
        imageNaturalSize, setImageNaturalSize,
        cropParams, setCropParams,
        baseSrc, resolvedSrc, isLoading, loadError,
        notesPath, currentNotePath,
        updateNodeAttrs
    };
}
