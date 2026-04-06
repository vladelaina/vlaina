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
        console.error('[ImageUpload] Image node type not found in schema');
        return false;
    }

    try {
        view.dispatch(view.state.tr.replaceSelectionWith(imageNode).scrollIntoView());
        return true;
    } catch (error) {
        console.error('[ImageUpload] Failed to insert image node:', error);
        return false;
    }
}
