import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import type { Alignment } from './types';
import { calculateAlignmentFromPosition, calculateDropPosition } from './utils/imageDropPosition';
import { createPlaceholderDecoration } from './utils/imageDragPlaceholder';

interface ImageDragState {
    sourcePos: number | null;
    targetPos: number | null;
    isDragging: boolean;
    imageNaturalWidth: number;
    imageNaturalHeight: number;
    editorView: EditorView | null;
    alignment: Alignment;
}

const initialState: ImageDragState = {
    sourcePos: null,
    targetPos: null,
    isDragging: false,
    imageNaturalWidth: 0,
    imageNaturalHeight: 0,
    editorView: null,
    alignment: 'center',
};

export const imageDragPluginKey = new PluginKey<ImageDragState>('imageDragPlugin');

export function setDragState(view: EditorView, state: Partial<ImageDragState>) {
    const tr = view.state.tr.setMeta(imageDragPluginKey, { ...state, editorView: view });
    view.dispatch(tr);
}

export function clearDragState(view: EditorView) {
    setDragState(view, {
        sourcePos: null,
        targetPos: null,
        isDragging: false,
        editorView: null,
        alignment: 'center',
    });
}

export function getDragState(view: EditorView): ImageDragState {
    return imageDragPluginKey.getState(view.state) || initialState;
}

export { calculateAlignmentFromPosition, calculateDropPosition };

export const imageDragPlugin = $prose(() => {
    return new Plugin({
        key: imageDragPluginKey,

        state: {
            init(): ImageDragState {
                return { ...initialState };
            },

            apply(tr, value): ImageDragState {
                const meta = tr.getMeta(imageDragPluginKey);
                if (meta) {
                    return { ...value, ...meta };
                }
                return value;
            },
        },

        props: {
            decorations(state) {
                const pluginState = imageDragPluginKey.getState(state);

                if (!pluginState?.isDragging || pluginState.targetPos === null || !pluginState.editorView) {
                    return DecorationSet.empty;
                }

                if (pluginState.targetPos < 0 || pluginState.targetPos > state.doc.content.size) {
                    return DecorationSet.empty;
                }

                const decoration = createPlaceholderDecoration(
                    pluginState.targetPos,
                    pluginState.editorView,
                    pluginState.imageNaturalWidth,
                    pluginState.imageNaturalHeight,
                    pluginState.alignment
                );

                return DecorationSet.create(state.doc, [decoration]);
            },
        },
    });
});
