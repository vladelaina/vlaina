import { useEffect, useMemo, useState } from 'react';
import { parseImageSource, type CropParams } from '../utils/imageSourceFragment';
import { getImageAlignment, getImageWidth } from '../utils/imageNodeAttrs';
import type { Alignment } from '../types';

interface ImageNodeLike {
    attrs: Record<string, unknown>;
}

interface UseImageNodeStateResult {
    nodeSrc: string;
    nodeAlt: string;
    width: string;
    setWidth: React.Dispatch<React.SetStateAction<string>>;
    alignment: Alignment;
    setAlignment: React.Dispatch<React.SetStateAction<Alignment>>;
    captionInput: string;
    setCaptionInput: React.Dispatch<React.SetStateAction<string>>;
    cropParams: CropParams | null;
    setCropParams: React.Dispatch<React.SetStateAction<CropParams | null>>;
    baseSrc: string;
}

export function useImageNodeState(node: ImageNodeLike): UseImageNodeStateResult {
    const nodeSrc = typeof node.attrs.src === 'string' ? node.attrs.src : '';
    const nodeAlt = typeof node.attrs.alt === 'string' ? node.attrs.alt : '';
    const parsedSource = useMemo(() => parseImageSource(nodeSrc), [nodeSrc]);
    const canonicalAlignment = getImageAlignment(node.attrs);
    const canonicalWidth = getImageWidth(node.attrs) || 'auto';

    const [width, setWidth] = useState(canonicalWidth);
    const [alignment, setAlignment] = useState<Alignment>(canonicalAlignment);
    const [captionInput, setCaptionInput] = useState(nodeAlt);
    const [cropParams, setCropParams] = useState<CropParams | null>(parsedSource.crop);

    useEffect(() => {
        setCropParams(parsedSource.crop);
    }, [parsedSource.crop]);

    useEffect(() => {
        const nextAlignment = getImageAlignment(node.attrs);
        if (alignment !== nextAlignment) {
            setAlignment(nextAlignment);
        }

        const nextWidth = getImageWidth(node.attrs) || 'auto';
        if (width !== nextWidth) {
            setWidth(nextWidth);
        }
    }, [node.attrs.src, node.attrs.align, node.attrs.width, alignment, width]);

    return {
        nodeSrc,
        nodeAlt,
        width,
        setWidth,
        alignment,
        setAlignment,
        captionInput,
        setCaptionInput,
        cropParams,
        setCropParams,
        baseSrc: parsedSource.baseSrc,
    };
}
