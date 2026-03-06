import { Selection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';

export interface TailBlankClickAction {
    insertParagraph: boolean;
    targetPos: number;
    bias: 1 | -1;
}

export const isClickBelowLastBlock = (
    editorDom: HTMLElement,
    clientY: number,
): boolean => {
    const lastElement = editorDom.lastElementChild as HTMLElement | null;
    if (!lastElement) return false;
    const lastRect = lastElement.getBoundingClientRect();
    return clientY > lastRect.bottom;
};

export const resolveTailBlankClickAction = (state: {
    doc: {
        content: { size: number };
        lastChild: { type?: { name?: string }; content?: { size: number } } | null;
        type: { schema: { nodes: { paragraph?: unknown } } };
    };
}): TailBlankClickAction | null => {
    const docEnd = state.doc.content.size;
    const lastNode = state.doc.lastChild;
    const paragraphType = state.doc.type.schema.nodes.paragraph;

    if (lastNode?.type?.name === 'paragraph' && lastNode.content?.size === 0) {
        return {
            insertParagraph: false,
            targetPos: Math.max(0, docEnd - 1),
            bias: -1,
        };
    }

    if (paragraphType) {
        return {
            insertParagraph: true,
            targetPos: docEnd + 1,
            bias: 1,
        };
    }

    return null;
};

export const dispatchTailBlankClickAction = (view: EditorView): boolean => {
    const { state } = view;
    const action = resolveTailBlankClickAction(state);
    if (!action) return false;

    let tr = state.tr;
    if (action.insertParagraph) {
        const docEnd = state.doc.content.size;
        const paragraphType = state.doc.type.schema.nodes.paragraph;
        if (!paragraphType) return false;
        tr = tr.insert(docEnd, paragraphType.create());
    }

    tr = tr.setSelection(Selection.near(tr.doc.resolve(action.targetPos), action.bias));
    view.dispatch(tr.scrollIntoView());
    view.focus();
    return true;
};
