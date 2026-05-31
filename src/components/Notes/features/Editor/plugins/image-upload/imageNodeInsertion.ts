import type { EditorView } from '@milkdown/kit/prose/view';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { Transaction } from '@milkdown/kit/prose/state';
import { replaceVisibleBlockSelectionWithCursor } from '../cursor/blockSelectionReplacement';
import { markEditorImageUserInput } from '../shared/userInputEvents';

export function buildImageNodeAttrs(src: string) {
    const fileName = src.split('/').pop() || src;
    const alt = fileName.replace(/\.[^/.]+$/, '');

    return {
        src,
        alt,
        align: 'center' as const,
        width: null,
    };
}

function createImageNode(view: EditorView, src: string) {
    const imageNodeType = view.state.schema.nodes.image;
    if (!imageNodeType) return null;
    return imageNodeType.create(buildImageNodeAttrs(src));
}

function replaceSelectionWithImageNode(view: EditorView, imageNode: ProseNode): Transaction {
    return replaceVisibleBlockSelectionWithCursor(view).replaceSelectionWith(imageNode);
}

export function canInsertImageNodeAtSelection(view: EditorView): boolean {
    const imageNode = createImageNode(view, './image.png');
    if (!imageNode) return false;

    try {
        const tr = replaceSelectionWithImageNode(view, imageNode);
        return tr.docChanged;
    } catch {
        return false;
    }
}

export function insertImageNodeAtSelection(view: EditorView, src: string): boolean {
    const imageNode = createImageNode(view, src);
    if (!imageNode) {
        return false;
    }

    try {
        markEditorImageUserInput(view);
        view.dispatch(replaceSelectionWithImageNode(view, imageNode).scrollIntoView());
        return true;
    } catch (error) {
        return false;
    }
}
