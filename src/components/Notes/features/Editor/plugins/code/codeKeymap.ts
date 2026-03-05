import { $prose } from '@milkdown/kit/utils';
import { keymap } from '@milkdown/kit/prose/keymap';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';
import { normalizeLanguage } from '../../utils/shiki';
import {
    isClickInBottomBlankSpace,
    isCursorAtCodeBlockEnd,
    moveSelectionAfterNode,
} from './codeBlockSelectionUtils';

function convertToCodeBlock(state: any, dispatch: any, lang: string) {
    const { selection, schema } = state;
    const $from = selection.$from;
    const start = $from.start($from.depth) - 1;
    const end = $from.end($from.depth) + 1;
    
    const codeBlockType = schema.nodes.code_block;
    if (!codeBlockType) return false;

    if (dispatch) {
        const normalizedLang = normalizeLanguage(lang) || lang;
        const tr = state.tr;
        const node = codeBlockType.create({ language: normalizedLang });
        tr.replaceWith(start, end, node);
        
        const pos = start + 1;
        tr.setSelection(TextSelection.create(tr.doc, pos));
        
        dispatch(tr);
    }
    return true;
}

function moveCursorAfterCodeBlock(state: any, dispatch: any): boolean {
    const { selection } = state;
    if (!isCursorAtCodeBlockEnd(selection)) return false;

    if (!dispatch) return true;

    const tr = state.tr;
    const { $from } = selection;
    const codeBlockPos = $from.before();
    moveSelectionAfterNode(tr, codeBlockPos, $from.parent.nodeSize);
    dispatch(tr.scrollIntoView());
    return true;
}

export const codeEnterKeymap = $prose(() => {
    return keymap({
        'ArrowDown': (state, dispatch) => {
            return moveCursorAfterCodeBlock(state, dispatch);
        },
        'Enter': (state, dispatch) => {
            const { selection } = state;
            
            if (!selection.empty) {
                const $from = selection.$from;
                const $to = selection.$to;
                
                const inCodeBlock = $from.parent.type.name === 'code_block' && 
                                   $to.parent.type.name === 'code_block' &&
                                   $from.parent === $to.parent;
                
                if (inCodeBlock) {
                    return false;
                }
                
                return true;
            }

            const $from = selection.$from;
            const parent = $from.parent;
            
            if (parent.type.name !== 'paragraph') return false;

            const text = parent.textContent;
            const match = text.match(/^```(\w*)$/);

            if (match) {
                return convertToCodeBlock(state, dispatch, match[1]);
            }
            return false;
        },
        'Backspace': (state, dispatch) => {
            const { selection } = state;
            const { $from, empty } = selection;
            
            if (!empty) return false;
            
            const parent = $from.parent;
            if (parent.type.name !== 'code_block') return false;
            
            if (parent.textContent.length === 0) {
                if (dispatch) {
                    const tr = state.tr;
                    tr.delete($from.before(), $from.after());
                    dispatch(tr);
                }
                return true;
            }
            return false;
        }
    });
});

export const codeBlockBlankAreaClickPlugin = $prose(() => {
    return new Plugin({
        props: {
            handleDOMEvents: {
                mousedown(view, event) {
                    if (!(event instanceof MouseEvent)) return false;
                    if (event.target !== view.dom) return false;

                    const root = view.dom as HTMLElement;
                    if (!isClickInBottomBlankSpace(root, event.clientY)) return false;

                    const tr = view.state.tr;
                    const doc = tr.doc;
                    const lastNode = doc.lastChild;
                    const docEnd = doc.content.size;

                    if (lastNode?.type.name !== 'code_block') return false;
                    moveSelectionAfterNode(tr, docEnd - lastNode.nodeSize, lastNode.nodeSize);

                    view.dispatch(tr.scrollIntoView());
                    view.focus();
                    event.preventDefault();
                    return true;
                }
            }
        }
    });
});

export const codeBlockPlugins = [codeEnterKeymap, codeBlockBlankAreaClickPlugin];
