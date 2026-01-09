import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';

// ============================================================================
// Heading Plugin
// ============================================================================
// Handles special backspace behavior for first empty paragraph

/**
 * Plugin to delete first empty paragraph on backspace
 * When cursor is at position 1 in an empty first paragraph, delete it
 */
const firstParagraphPlugin = $prose(() => {
    return new Plugin({
        key: new PluginKey('firstParagraph'),
        props: {
            handleKeyDown(view, event) {
                if (event.key !== 'Backspace') return false;
                
                const { selection, doc } = view.state;
                const { from, empty } = selection;
                
                // Only handle when cursor is at position 1 with empty selection
                if (from !== 1 || !empty) return false;
                
                const firstNode = doc.firstChild;
                if (!firstNode) return false;
                
                // Check if first node is an empty paragraph
                const isEmptyParagraph = 
                    firstNode.type.name === 'paragraph' && 
                    firstNode.content.size === 0;
                
                if (isEmptyParagraph && doc.childCount > 1) {
                    // Delete the empty first paragraph
                    const tr = view.state.tr.delete(0, firstNode.nodeSize);
                    view.dispatch(tr);
                    return true;
                }
                
                return false;
            }
        }
    });
});

export const headingPlugin = [
    firstParagraphPlugin
];
