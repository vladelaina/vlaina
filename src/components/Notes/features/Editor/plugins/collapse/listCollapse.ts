/**
 * List Collapse Plugin
 * 
 * Adds collapse/expand functionality to bullet lists, ordered lists, and task lists.
 * Shows a toggle triangle on the first item of each list.
 */

import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import {
    collapsedState,
    createCollapseToggleButton,
    COLLAPSED_CONTENT_CLASS,
    COLLAPSE_TOGGLE_EVENT
} from './collapseUtils';

const LIST_COLLAPSE_KEY = new PluginKey('listCollapse');
const COLLAPSE_TYPE = 'list';

interface ListInfo {
    pos: number;
    node: ProseMirrorNode;
    endPos: number;
    firstItemPos: number;
    childItems: Array<{ pos: number; endPos: number }>;
}

/**
 * Find all lists in the document
 */
function findLists(doc: ProseMirrorNode): ListInfo[] {
    const lists: ListInfo[] = [];

    doc.descendants((node, pos) => {
        if (node.type.name === 'bullet_list' || node.type.name === 'ordered_list') {
            const childItems: Array<{ pos: number; endPos: number }> = [];
            let firstItemPos = pos + 1;
            let currentOffset = 1;

            node.forEach((child, offset) => {
                const itemPos = pos + 1 + offset;
                if (child.type.name === 'list_item') {
                    if (childItems.length === 0) {
                        firstItemPos = itemPos;
                    }
                    childItems.push({
                        pos: itemPos,
                        endPos: itemPos + child.nodeSize,
                    });
                }
                currentOffset += child.nodeSize;
            });

            // Only add lists with more than one item (collapsing makes sense)
            if (childItems.length > 1) {
                lists.push({
                    pos,
                    node,
                    endPos: pos + node.nodeSize,
                    firstItemPos,
                    childItems,
                });
            }
        }
        return true; // Continue traversing
    });

    return lists;
}

/**
 * List Collapse Plugin
 */
export const listCollapsePlugin = $prose(() => {
    return new Plugin({
        key: LIST_COLLAPSE_KEY,

        state: {
            init() {
                return DecorationSet.empty;
            },
            apply(tr, oldState, _oldEditorState, newEditorState) {
                if (tr.docChanged || tr.getMeta(LIST_COLLAPSE_KEY)) {
                    const decorations: Decoration[] = [];
                    const lists = findLists(newEditorState.doc);

                    lists.forEach((listInfo) => {
                        const isCollapsed = collapsedState.isCollapsed(COLLAPSE_TYPE, listInfo.pos);
                        const hasContent = listInfo.childItems.length > 1;

                        // Add toggle button at the start of the list
                        const button = createCollapseToggleButton(
                            COLLAPSE_TYPE,
                            listInfo.pos,
                            isCollapsed,
                            hasContent
                        );

                        // Position button at the first list item
                        decorations.push(
                            Decoration.widget(listInfo.firstItemPos, button, {
                                side: -1,
                                key: `list-toggle-${listInfo.pos}`,
                            })
                        );

                        // If collapsed, hide all items except the first
                        if (isCollapsed && hasContent) {
                            for (let i = 1; i < listInfo.childItems.length; i++) {
                                const item = listInfo.childItems[i];
                                decorations.push(
                                    Decoration.node(item.pos, item.endPos, {
                                        class: COLLAPSED_CONTENT_CLASS,
                                    })
                                );
                            }
                        }
                    });

                    return DecorationSet.create(newEditorState.doc, decorations);
                }

                return oldState.map(tr.mapping, tr.doc);
            },
        },

        props: {
            decorations(state) {
                return this.getState(state);
            },
        },

        view(editorView) {
            const handleToggle = (e: Event) => {
                const detail = (e as CustomEvent).detail;
                if (detail.type === COLLAPSE_TYPE) {
                    const tr = editorView.state.tr.setMeta(LIST_COLLAPSE_KEY, true);
                    editorView.dispatch(tr);
                }
            };

            document.addEventListener(COLLAPSE_TOGGLE_EVENT, handleToggle);

            return {
                destroy() {
                    document.removeEventListener(COLLAPSE_TOGGLE_EVENT, handleToggle);
                },
            };
        },
    });
});
