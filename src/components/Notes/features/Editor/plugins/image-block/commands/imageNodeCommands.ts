import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { imageDragPluginKey } from '../imageDragPlugin';
import type { Alignment, ImageNodeAttrs } from '../types';
import { getImageAlignment, mergeImageNodeAttrs } from '../utils/imageNodeAttrs';

function getImageNodeAtPos(view: EditorView, pos: number): ProseNode | null {
    const node = view.state.doc.nodeAt(pos);
    if (!node || node.type.name !== 'image') return null;
    return node;
}

export function applyImageNodeAttrsAtPos(
    view: EditorView,
    pos: number,
    incomingAttrs: ImageNodeAttrs
): boolean {
    const latestNode = getImageNodeAtPos(view, pos);
    if (!latestNode) return false;
    const latestAttrs = latestNode.attrs as ImageNodeAttrs;
    const nextAttrs = mergeImageNodeAttrs(latestAttrs, incomingAttrs);
    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, nextAttrs));
    return true;
}

interface MoveImageNodeOptions {
    sourcePos: number;
    targetPos: number;
    alignment?: Alignment;
}

export function moveImageNode(view: EditorView, options: MoveImageNodeOptions): boolean {
    const { sourcePos, targetPos, alignment } = options;
    const { state, dispatch } = view;
    const imageNode = getImageNodeAtPos(view, sourcePos);
    if (!imageNode) return false;

    const imageNodeSize = imageNode.nodeSize;
    const isSamePosition = targetPos === sourcePos || targetPos === sourcePos + imageNodeSize;
    const currentAlign = getImageAlignment(imageNode.attrs);
    const nextAlign = (alignment || currentAlign || 'center') as Alignment;

    if (isSamePosition && nextAlign === currentAlign) {
        return false;
    }

    const updatedAttrs = mergeImageNodeAttrs(imageNode.attrs, { align: nextAlign });
    const tr = state.tr;

    tr.setMeta('addToHistory', true);
    tr.setMeta('scrollIntoView', false);
    tr.setMeta('imageDragMove', true);
    tr.setMeta(imageDragPluginKey, {
        sourcePos: null,
        targetPos: null,
        isDragging: false,
        editorView: null,
        alignment: 'center',
    });

    if (isSamePosition) {
        tr.setNodeMarkup(sourcePos, undefined, updatedAttrs);
        dispatch(tr);
        return true;
    }

    if (targetPos > sourcePos) {
        const slice = state.doc.slice(sourcePos, sourcePos + imageNodeSize);
        tr.delete(sourcePos, sourcePos + imageNodeSize);
        const adjustedTarget = tr.mapping.map(targetPos);
        tr.insert(adjustedTarget, slice.content);
        tr.setNodeMarkup(adjustedTarget, undefined, updatedAttrs);
    } else {
        const slice = state.doc.slice(sourcePos, sourcePos + imageNodeSize);
        tr.insert(targetPos, slice.content);
        tr.setNodeMarkup(targetPos, undefined, updatedAttrs);
        const adjustedSource = tr.mapping.map(sourcePos);
        tr.delete(adjustedSource, adjustedSource + imageNodeSize);
    }

    dispatch(tr);
    return true;
}

export function deleteImageNodeAtPos(view: EditorView, pos: number): boolean {
    const imageNode = getImageNodeAtPos(view, pos);
    if (!imageNode) return false;
    view.dispatch(view.state.tr.delete(pos, pos + imageNode.nodeSize));
    return true;
}
