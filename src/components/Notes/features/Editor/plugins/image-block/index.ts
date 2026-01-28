import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Node } from '@milkdown/kit/prose/model';
import { EditorView } from '@milkdown/kit/prose/view';
import { keymap } from '@milkdown/kit/prose/keymap';
import { NodeSelection } from '@milkdown/kit/prose/state';
import { ImageBlockNodeView } from './ImageBlockNodeView';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { moveImageToTrash, restoreImageFromTrash } from './utils/fileUtils';

// Plugin key for identification
const imageNodeViewPluginKey = new PluginKey('imageNodeViewPlugin');

// Create a ProseMirror plugin that attaches a custom NodeView to the 'image' node
export const imageNodeViewPlugin = $prose(() => {
    return new Plugin({
        key: imageNodeViewPluginKey,
        props: {
            nodeViews: {
                // Target the 'image' node from commonmark preset
                image: (node: Node, view: EditorView, getPos: () => number | undefined) => {
                    return new ImageBlockNodeView(node, view, getPos);
                }
            }
        },
        appendTransaction: (transactions, oldState, newState) => {
            const { notesPath, currentNote } = useNotesStore.getState();
            if (!notesPath) return null;

            for (const tr of transactions) {
                if (!tr.docChanged) continue;

                // 1. Detect Deleted Images
                // Iterate steps to map changes back to old doc and find removed nodes
                tr.steps.forEach(step => {
                    step.getMap().forEach((oldStart, oldEnd) => {
                        oldState.doc.nodesBetween(oldStart, oldEnd, (node) => {
                            if (node.type.name === 'image') {
                                const src = node.attrs.src;
                                if (src) {
                                    // Schedule deletion (10s grace period)
                                    moveImageToTrash(src, notesPath, currentNote?.path);
                                }
                            }
                        });
                    });
                });

                // 2. Detect Restored/Inserted Images
                // (e.g., Undo delete, Paste, Drag & Drop)
                for (const step of tr.steps) {
                    // @ts-ignore - access internal slice structure safely
                    const slice = step.slice;
                    if (slice && slice.content) {
                        slice.content.forEach((node: Node) => {
                            if (node.type.name === 'image') {
                                const src = node.attrs.src;
                                if (src) {
                                    // Cancel deletion immediately
                                    restoreImageFromTrash(src, notesPath, currentNote?.path);
                                }
                            }
                        });
                    }
                }
            }
            return null;
        }
    });
});

// Backspace Keymap Plugin to prevent accidental image deletion
export const imageKeymapPlugin = $prose(() => {
    return keymap({
        'Backspace': (state, dispatch) => {
            const { selection } = state;
            const { $from, empty } = selection;

            // Only apply if cursor is collapsed at the start of the current block
            if (!empty || $from.parentOffset > 0) return false;

            // Check if we are in a paragraph (usually)
            if ($from.parent.type.name !== 'paragraph') return false;

            // Calculate previous node index
            const index = $from.index($from.depth - 1);
            const parent = $from.node($from.depth - 1);

            // Need a previous sibling
            if (index === 0) return false;

            const prevNode = parent.child(index - 1);
            
            // Check if previous node is a paragraph containing ONLY an image
            // This is the common structure for block images in Markdown: P > Image
            if (prevNode.type.name === 'paragraph' && 
                prevNode.childCount === 1 && 
                prevNode.firstChild?.type.name === 'image') {
                
                // Found our target scenario: P(Image) | P(Cursor)
                
                if (dispatch) {
                    const tr = state.tr;
                    
                    // 1. If current line is empty, delete it
                    if ($from.parent.content.size === 0) {
                        // Delete the current empty paragraph
                        // Range: start of block to end of block
                        tr.delete($from.before(), $from.after());
                    } else {
                        // If not empty, we normally merge. 
                        // But if merging causes issues, we can just return false here to let default behavior handle valid merges.
                        // User specifically mentioned deleting the "line below" (implying empty or full line deletion).
                        // If it's not empty, let's stick to default merge for now unless requested.
                        return false; 
                    }

                    // 2. Select the image in the previous paragraph
                    // Position of image is: Start of Prev Paragraph + 1
                    // Start of Prev Paragraph = Start of Current Paragraph - Prev Node Size
                    const currBlockStart = $from.start($from.depth); // pos inside start of P2
                    // Wait, $from.before() is pos BEFORE P2 (start of P2 node)
                    
                    const p2Pos = $from.before(); 
                    const p1Pos = p2Pos - prevNode.nodeSize;
                    const imagePos = p1Pos + 1;

                    // Apply selection
                    tr.setSelection(NodeSelection.create(state.doc, imagePos));
                    tr.scrollIntoView();
                    
                    dispatch(tr);
                }
                return true;
            }

            return false;
        }
    });
});

// Export as array for easy spreading in editor config
export const imageBlockPlugin = [imageNodeViewPlugin, imageKeymapPlugin];

