import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import {
    collapsedState,
    createCollapseToggleButton,
    COLLAPSED_CONTENT_CLASS,
    COLLAPSE_TOGGLE_EVENT,
    isCollapseToggleTarget
} from './collapseUtils';

const LIST_COLLAPSE_KEY = new PluginKey('listCollapse');
const COLLAPSE_TYPE = 'list-item';

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
                    const doc = newEditorState.doc;

                    // Traverse all nodes to find list items
                    doc.descendants((node, pos) => {
                        if (node.type.name === 'list_item') {
                            let hasNestedList = false;
                            let nestedListPos = -1;
                            let nestedListEnd = -1;

                            node.forEach((child, offset) => {
                                if (child.type.name === 'bullet_list' || child.type.name === 'ordered_list') {
                                    hasNestedList = true;
                                    nestedListPos = pos + 1 + offset;
                                    nestedListEnd = nestedListPos + child.nodeSize;
                                }
                            });

                            const isCollapsed = collapsedState.isCollapsed(COLLAPSE_TYPE, pos);

                            const button = createCollapseToggleButton(
                                COLLAPSE_TYPE,
                                pos,
                                isCollapsed,
                                hasNestedList
                            );

                            decorations.push(
                                Decoration.widget(pos + 1, button, {
                                    side: -1,
                                    key: `list-toggle-${pos}`,
                                    stopEvent(event) {
                                        return isCollapseToggleTarget(event.target);
                                    },
                                })
                            );

                            if (isCollapsed && hasNestedList) {
                                decorations.push(
                                    Decoration.node(nestedListPos, nestedListEnd, {
                                        class: COLLAPSED_CONTENT_CLASS,
                                    })
                                );
                            }
                        }
                        return true;
                    });

                    return DecorationSet.create(doc, decorations);
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