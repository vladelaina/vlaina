import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { DecorationSet } from '@milkdown/kit/prose/view';
import { createHeadingPlaceholderDecorations } from './headingPlaceholder';

const firstParagraphPlugin = $prose(() => {
    return new Plugin({
        key: new PluginKey('firstParagraph'),
        props: {
            handleKeyDown(view, event) {
                if (event.key !== 'Backspace') return false;
                
                const { selection, doc } = view.state;
                const { from, empty } = selection;
                
                if (from !== 1 || !empty) return false;
                
                const firstNode = doc.firstChild;
                if (!firstNode) return false;
                
                const isEmptyParagraph = 
                    firstNode.type.name === 'paragraph' && 
                    firstNode.content.size === 0;
                
                if (isEmptyParagraph && doc.childCount > 1) {
                    const tr = view.state.tr.delete(0, firstNode.nodeSize);
                    view.dispatch(tr);
                    return true;
                }
                
                return false;
            }
        }
    });
});

const headingPlaceholderPlugin = $prose(() => {
    return new Plugin({
        key: new PluginKey('headingPlaceholder'),
        state: {
            init(_config, state) {
                return createHeadingPlaceholderDecorations(state.doc);
            },
            apply(tr, oldDecorations, _oldState, newState) {
                if (tr.docChanged) {
                    return createHeadingPlaceholderDecorations(newState.doc);
                }
                return (oldDecorations as DecorationSet).map(tr.mapping, tr.doc);
            },
        },
        props: {
            decorations(state) {
                return this.getState(state);
            },
        },
    });
});

export const headingPlugin = [
    firstParagraphPlugin,
    headingPlaceholderPlugin,
];
