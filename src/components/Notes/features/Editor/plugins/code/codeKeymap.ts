import { $prose } from '@milkdown/kit/utils';
import { keymap } from '@milkdown/kit/prose/keymap';
import { TextSelection } from '@milkdown/kit/prose/state';
import { normalizeLanguage } from '../../utils/shiki';

/**
 * Common logic to convert current paragraph to code block
 */
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

// 2. Keymap for Enter (Primary trigger) and Backspace
export const codeEnterKeymap = $prose(() => {
    return keymap({
        'Enter': (state, dispatch) => {
            const { selection } = state;
            
            // CRITICAL: If there's a selection (text is selected), don't handle it
            // Let the default behavior handle it, but only within the code block
            if (!selection.empty) {
                const $from = selection.$from;
                const $to = selection.$to;
                
                // Check if selection is within a code block
                const inCodeBlock = $from.parent.type.name === 'code_block' && 
                                   $to.parent.type.name === 'code_block' &&
                                   $from.parent === $to.parent;
                
                if (inCodeBlock) {
                    // Allow default behavior (delete selection and insert newline)
                    return false;
                }
                
                // If selection spans outside code block, prevent any action
                return true;
            }

            const $from = selection.$from;
            const parent = $from.parent;
            
            if (parent.type.name !== 'paragraph') return false;

            const text = parent.textContent;
            // Match ``` or ```lang
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
            
            // If empty content, delete the block
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

// Export array for convenience
export const codeBlockPlugins = [codeEnterKeymap];