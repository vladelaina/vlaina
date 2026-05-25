import type { EditorView } from '@milkdown/kit/prose/view';

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

export function canInsertImageNodeAtSelection(view: EditorView): boolean {
    const imageNode = createImageNode(view, './image.png');
    if (!imageNode) return false;

    try {
        const tr = view.state.tr.replaceSelectionWith(imageNode);
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
        view.dom.dispatchEvent(new CustomEvent('vlaina:image-user-input', { bubbles: true }));
        view.dispatch(view.state.tr.replaceSelectionWith(imageNode).scrollIntoView());
        return true;
    } catch (error) {
        return false;
    }
}
