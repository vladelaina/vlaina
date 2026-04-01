import { useEffect, useCallback } from 'react';
import { EditorView } from '@milkdown/kit/prose/view';
import { Node } from '@milkdown/kit/prose/model';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { applyImageNodeAttrsAtPos } from '../commands/imageNodeCommands';
import { useLocalImage } from './useLocalImage';
import { useImageNodeState } from './useImageNodeState';
import { useImageUiState } from './useImageUiState';
import type { ImageNodeAttrs } from '../types';

interface UseImageBlockStateProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
}

export function useImageBlockState({ node, view, getPos }: UseImageBlockStateProps) {
    const nodeState = useImageNodeState(node);
    const uiState = useImageUiState(nodeState.width);
    const { setIsReady } = uiState;

    const notesPath = useNotesStore(s => s.notesPath);
    const currentNotePath = useNotesStore(s => s.currentNote?.path);
    const { resolvedSrc, isLoading, error: loadError } = useLocalImage(nodeState.baseSrc, notesPath, currentNotePath);

    useEffect(() => {
        if (loadError) {
            setIsReady(true);
        }
    }, [loadError, setIsReady]);

    const updateNodeAttrs = useCallback((attrs: ImageNodeAttrs) => {
        const pos = getPos();
        if (pos === undefined) return;
        applyImageNodeAttrsAtPos(view, pos, attrs);
    }, [view, getPos]);

    return {
        ...nodeState,
        ...uiState,
        resolvedSrc,
        isLoading,
        loadError,
        notesPath,
        currentNotePath,
        updateNodeAttrs,
    };
}
