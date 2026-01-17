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
const CHECKBOX_WIDTH = 20;

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

                    // Check if the click is within the checkbox area (left side of the LI)
                    const liRect = taskLi.getBoundingClientRect();
                    const clickX = event.clientX - liRect.left;

                    // Only toggle if clicking in the checkbox area
                    if (clickX > CHECKBOX_WIDTH) return false;

                    // Prevent default to stop cursor movement
                    event.preventDefault();

                    // Find the position in the document
                    const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
                    if (!pos) return false;

                    const { state } = view;
                    const $pos = state.doc.resolve(pos.pos);

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
