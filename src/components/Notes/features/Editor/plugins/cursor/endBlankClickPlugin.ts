import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey, Selection } from '@milkdown/kit/prose/state';
import { isClickBelowLastBlock, resolveTailBlankClickAction } from './endBlankClickUtils';

export const endBlankClickPluginKey = new PluginKey('endBlankClick');

const moveCursorToNewTailLine = (view: any): boolean => {
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

export const endBlankClickPlugin = $prose(() => {
    return new Plugin({
        key: endBlankClickPluginKey,
        props: {
            handleDOMEvents: {
                mousedown(view, event) {
                    if (!(event instanceof MouseEvent)) return false;
                    if (event.button !== 0) return false;
                    if (!(event.target instanceof Node)) return false;
                    if (!view.dom.contains(event.target)) return false;
                    if (!isClickBelowLastBlock(view.dom as HTMLElement, event.clientY)) return false;

                    const handled = moveCursorToNewTailLine(view);
                    if (!handled) return false;

                    event.preventDefault();
                    return true;
                },
            },
        },
    });
});
