import { useState, useEffect, useCallback, useMemo } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { parseImageSource, CropParams } from '../utils/cropUtils';
import { getImageAlignment, getImageWidth } from '../utils/imageNodeAttrs';
import { applyImageNodeAttrsAtPos } from '../commands/imageNodeCommands';
import { useLocalImage } from './useLocalImage';
import type { Alignment, ImageNodeAttrs } from '../types';

interface UseImageBlockStateProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
}

export function useImageBlockState({ node, view, getPos }: UseImageBlockStateProps) {
    const nodeSrc = typeof node.attrs.src === 'string' ? node.attrs.src : '';
    const parsedSource = useMemo(() => parseImageSource(nodeSrc), [nodeSrc]);
    const canonicalAlignment = getImageAlignment(node.attrs);
    const canonicalWidth = getImageWidth(node.attrs);

    const [width, setWidth] = useState(canonicalWidth || 'auto');
    const [alignment, setAlignment] = useState<Alignment>(canonicalAlignment);
    const [captionInput, setCaptionInput] = useState(node.attrs.alt || '');

    const [height, setHeight] = useState<number | undefined>(undefined);
    const [isHovered, setIsHovered] = useState(false);
    const [isEditingCaption, setIsEditingCaption] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [isReady, setIsReady] = useState(!!canonicalWidth);

    const [naturalRatio, setNaturalRatio] = useState<number | null>(null);
    const [cropParams, setCropParams] = useState<CropParams | null>(null);

    const notesPath = useNotesStore(s => s.notesPath);
    const currentNotePath = useNotesStore(s => s.currentNote?.path);

    const baseSrc = parsedSource.baseSrc;
    const initialParams = parsedSource.crop;
    const { resolvedSrc, isLoading, error: loadError } = useLocalImage(baseSrc, notesPath, currentNotePath);

    useEffect(() => {
        setCropParams(initialParams);
    }, [initialParams]);

    useEffect(() => {
        if (loadError) setIsReady(true);
    }, [loadError]);

    useEffect(() => {
        const newAlignment = getImageAlignment(node.attrs);
        if (alignment !== newAlignment) setAlignment(newAlignment);
        
        const newWidth = getImageWidth(node.attrs) || 'auto';
        if (width !== newWidth) setWidth(newWidth);
    }, [node.attrs.src, node.attrs.align, node.attrs.width, alignment, width]);

    const updateNodeAttrs = useCallback((attrs: ImageNodeAttrs) => {
        const pos = getPos();
        if (pos === undefined) return;
        applyImageNodeAttrsAtPos(view, pos, attrs);
    }, [view, getPos]);

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
        cropParams, setCropParams,
        baseSrc, resolvedSrc, isLoading, loadError,
        notesPath, currentNotePath,
        updateNodeAttrs
    };
}
