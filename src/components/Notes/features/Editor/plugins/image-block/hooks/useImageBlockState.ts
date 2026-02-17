import { useState, useEffect, useCallback, useMemo } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { parseImageSource, buildImageSource, CropParams } from '../utils/cropUtils';
import { useLocalImage } from './useLocalImage';
import type { Alignment } from '../types';

interface UseImageBlockStateProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
}

export function useImageBlockState({ node, view, getPos }: UseImageBlockStateProps) {
    const parsedSource = useMemo(() => parseImageSource(node.attrs.src || ''), [node.attrs.src]);

    // Node Attributes
    const [width, setWidth] = useState(parsedSource.width || 'auto');
    const [alignment, setAlignment] = useState<Alignment>(parsedSource.align || 'center');
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
    const baseSrc = parsedSource.baseSrc;
    const initialParams = parsedSource.crop;
    const { resolvedSrc, isLoading, error: loadError } = useLocalImage(baseSrc, notesPath, currentNotePath);

    // Sync from Node
    useEffect(() => {
        setCropParams(initialParams);
    }, [initialParams]);

    useEffect(() => {
        if (loadError) setIsReady(true);
    }, [loadError]);

    useEffect(() => {
        const newAlignment = parsedSource.align || ((node.attrs.align as Alignment) || 'center');
        if (alignment !== newAlignment) setAlignment(newAlignment);
        
        const newWidth = parsedSource.width || node.attrs.width || 'auto';
        if (width !== newWidth) setWidth(newWidth);
    }, [node.attrs.align, node.attrs.width, node.attrs.src, parsedSource.align, parsedSource.width]);

    // Helpers
    const updateNodeAttrs = useCallback((attrs: Record<string, any>) => {
        const pos = getPos();
        if (pos !== undefined) {
            const latestNode = view.state.doc.nodeAt(pos);
            const latestAttrs =
                latestNode && latestNode.type.name === 'image'
                    ? latestNode.attrs
                    : node.attrs;
            const latestParsed = parseImageSource(latestAttrs.src || '');

            const incomingAlign = attrs.align as Alignment | undefined;
            const incomingWidth = attrs.width as string | null | undefined;
            const incomingSrc = typeof attrs.src === 'string' ? attrs.src : undefined;
            const incomingParsed = incomingSrc ? parseImageSource(incomingSrc) : null;

            const mergedAlign = incomingAlign ?? incomingParsed?.align ?? latestParsed.align ?? null;
            const mergedWidth = incomingWidth ?? incomingParsed?.width ?? latestParsed.width ?? null;
            const mergedCrop = incomingParsed?.crop ?? latestParsed.crop ?? null;
            const mergedBaseSrc = incomingParsed?.baseSrc || latestParsed.baseSrc || '';

            const nextAttrs = { ...latestAttrs, ...attrs };
            delete nextAttrs.align;
            delete nextAttrs.width;
            nextAttrs.src = buildImageSource(mergedBaseSrc, {
                crop: mergedCrop,
                align: mergedAlign,
                width: mergedWidth,
            });
            view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, nextAttrs));
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
