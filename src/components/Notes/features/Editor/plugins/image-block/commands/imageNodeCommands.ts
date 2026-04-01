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

function matchesImageNode(node: ProseNode | null, expectedAttrs: ImageNodeAttrs): node is ProseNode {
    if (!node || node.type.name !== 'image') return false;

    const attrs = node.attrs as ImageNodeAttrs;
    if (typeof expectedAttrs.src === 'string' && attrs.src !== expectedAttrs.src) return false;
    if (expectedAttrs.alt !== undefined && attrs.alt !== expectedAttrs.alt) return false;
    if (expectedAttrs.title !== undefined && attrs.title !== expectedAttrs.title) return false;

    return true;
}

function resolveInsertedImagePos(doc: ProseNode, insertionPos: number, expectedAttrs: ImageNodeAttrs): number | null {
    const candidatePositions = [
        insertionPos,
        insertionPos + 1,
        insertionPos - 1,
        insertionPos + 2,
        insertionPos - 2,
    ];

    for (const candidatePos of candidatePositions) {
        if (candidatePos < 0 || candidatePos > doc.content.size) continue;
        if (matchesImageNode(doc.nodeAt(candidatePos), expectedAttrs)) {
            return candidatePos;
        }
    }

    let resolvedPos: number | null = null;
    const from = Math.max(0, insertionPos - 2);
    const to = Math.min(doc.content.size, insertionPos + 3);

    doc.nodesBetween(from, to, (node, pos) => {
        if (matchesImageNode(node, expectedAttrs)) {
            resolvedPos = pos;
            return false;
        }

        return undefined;
    });

    return resolvedPos;
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
        const insertedImagePos = resolveInsertedImagePos(tr.doc, adjustedTarget, imageNode.attrs as ImageNodeAttrs);
        tr.setNodeMarkup(insertedImagePos ?? adjustedTarget, undefined, updatedAttrs);
    } else {
        const slice = state.doc.slice(sourcePos, sourcePos + imageNodeSize);
        tr.insert(targetPos, slice.content);
        const insertedImagePos = resolveInsertedImagePos(tr.doc, targetPos, imageNode.attrs as ImageNodeAttrs);
        tr.setNodeMarkup(insertedImagePos ?? targetPos, undefined, updatedAttrs);
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
