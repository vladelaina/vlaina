/**
 * Task List Click Plugin
 * 
 * Handles click events on task list items to toggle their checked state.
 * Since Milkdown renders task lists using data attributes (data-item-type="task", data-checked)
 * rather than native checkbox inputs, we need to manually handle the click interaction.
 */

import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';

// Width of the checkbox area (CSS pseudo-element is 16px + 2px border + small margin)
// const CHECKBOX_WIDTH = 20; // Deprecated due to negative margin layout

export const taskListClickPluginKey = new PluginKey('taskListClick');

export const taskListClickPlugin = $prose(() => {
    return new Plugin({
        key: taskListClickPluginKey,
        props: {
            handleDOMEvents: {
                mousedown(view, event) {
                    const target = event.target as HTMLElement;

                    // Check if we clicked on an LI with data-item-type="task"
                    const taskLi = target.closest('li[data-item-type="task"]') as HTMLElement;
                    if (!taskLi) return false;

                    // Check if the click is within the checkbox area
                    // Since we shifted the checkbox using margin-left: -1.5rem (-24px),
                    // the click will occur to the left of the LI's bounding box.
                    const liRect = taskLi.getBoundingClientRect();
                    const clickX = event.clientX - liRect.left;

                    // Checkbox is at roughly -24px relative to LI left edge.
                    // Allow a generous hit area from -30px to 10px (just in case)
                    // The text content starts at padding-left: 0, effectively 0.
                    if (clickX > 5 || clickX < -30) return false;

                    // Prevent default to stop cursor movement
                    event.preventDefault();

                    // Find the position in the document directly from the DOM node
                    // posAtCoords is unreliable for negative margins/pseudo-elements
                    const posInNode = view.posAtDOM(taskLi, 0);
                    if (posInNode === null) return false;

                    const { state } = view;
                    // posAtDOM returns a position *inside* the node usually.
                    // We resolve it to walk up the tree.
                    const $pos = state.doc.resolve(posInNode);

                    // Walk up to find the list_item node
                    for (let depth = $pos.depth; depth > 0; depth--) {
                        const node = $pos.node(depth);
                        if (node.type.name === 'list_item') {
                            // Check if this is indeed a task item (has checked attribute)
                            if (node.attrs.checked !== undefined) {
                                const nodePos = $pos.before(depth);
                                const tr = state.tr.setNodeMarkup(nodePos, undefined, {
                                    ...node.attrs,
                                    checked: !node.attrs.checked,
                                });
                                view.dispatch(tr);
                                // Blur the editor to remove cursor after checkbox toggle
                                (view.dom as HTMLElement).blur();
                                return true;
                            }
                        }
                    }

                    return false;
                },
            },
        },
    });
});