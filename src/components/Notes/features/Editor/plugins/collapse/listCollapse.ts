import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import {
    createCollapseToggleButton,
    COLLAPSED_CONTENT_CLASS,
    isCollapseToggleTarget
} from './collapseUtils';

type ListCollapseActionType = 'toggle' | 'expand' | 'collapse';

interface ListCollapseAction {
    type: ListCollapseActionType;
    pos: number;
}

interface ListCollapsePluginState {
    decorations: DecorationSet;
    collapsedItems: Set<number>;
}

const LIST_COLLAPSE_KEY = new PluginKey<ListCollapsePluginState>('listCollapse');
const COLLAPSE_TYPE = 'list-item';
const ORDERED_MARKER_BASE_CHARS = 2;
const MAX_LIST_COLLAPSE_ITEMS = 1000;

function getOrderedListMarkerExtraOffset(node: any): string {
    if (node.attrs?.listType !== 'ordered') return '';

    const label = typeof node.attrs?.label === 'string' ? node.attrs.label.trim() : '';
    const markerChars = label.length;
    if (markerChars <= ORDERED_MARKER_BASE_CHARS) return '';

    return `${markerChars - ORDERED_MARKER_BASE_CHARS}ch`;
}

function parseListCollapseAction(meta: unknown): ListCollapseAction | null {
    if (!meta || typeof meta !== 'object') return null;

    const candidate = meta as { type?: unknown; pos?: unknown };
    if (candidate.type !== 'toggle' && candidate.type !== 'expand' && candidate.type !== 'collapse') {
        return null;
    }
    if (typeof candidate.pos !== 'number' || !Number.isFinite(candidate.pos)) return null;

    return {
        type: candidate.type,
        pos: candidate.pos,
    };
}

function applyListCollapseAction(
    current: Set<number>,
    action: ListCollapseAction,
): Set<number> {
    const next = new Set<number>(current);
    switch (action.type) {
        case 'toggle':
            if (next.has(action.pos)) {
                next.delete(action.pos);
            } else {
                next.add(action.pos);
            }
            break;
        case 'expand':
            next.delete(action.pos);
            break;
        case 'collapse':
            next.add(action.pos);
            break;
    }
    return next;
}

function remapCollapsedListItems(
    current: Set<number>,
    tr: { docChanged?: boolean; mapping?: { map: (pos: number, assoc?: number) => number } },
    doc: { nodeAt: (pos: number) => { type?: { name?: string } } | null },
): Set<number> {
    if (!tr.docChanged || !tr.mapping || current.size === 0) return new Set<number>(current);

    const mapped = new Set<number>();
    current.forEach((pos) => {
        const mappedPos = tr.mapping!.map(pos, -1);
        const node = doc.nodeAt(mappedPos);
        if (node?.type?.name === 'list_item') {
            mapped.add(mappedPos);
        }
    });

    return mapped;
}

function buildListCollapseDecorations(
    doc: any,
    collapsedItems: Set<number>,
    dispatchToggle: (view: EditorView, pos: number) => void,
): DecorationSet {
    const decorations: Decoration[] = [];
    let decoratedItems = 0;

    doc.descendants((node: any, pos: number) => {
        if (decoratedItems >= MAX_LIST_COLLAPSE_ITEMS) return false;
        if (node.type.name !== 'list_item') return true;

        let hasNestedList = false;
        let nestedListPos = -1;
        let nestedListEnd = -1;

        node.forEach((child: any, offset: number) => {
            if (child.type.name === 'bullet_list' || child.type.name === 'ordered_list') {
                hasNestedList = true;
                nestedListPos = pos + 1 + offset;
                nestedListEnd = nestedListPos + child.nodeSize;
            }
        });

        if (!hasNestedList) return true;
        decoratedItems += 1;

        const isCollapsed = hasNestedList && collapsedItems.has(pos);
        const markerExtraOffset = getOrderedListMarkerExtraOffset(node);
        decorations.push(
            Decoration.widget(pos + 1, (view) => {
                const button = createCollapseToggleButton({
                    collapseType: COLLAPSE_TYPE,
                    collapsed: isCollapsed,
                    hasContent: hasNestedList,
                    onToggle: () => {
                        dispatchToggle(view, pos);
                    },
                });

                if (markerExtraOffset) {
                    button.style.setProperty('--vlaina-list-marker-extra', markerExtraOffset);
                }

                return button;
            }, {
                side: -1,
                key: `list-toggle-${pos}-${isCollapsed ? '1' : '0'}-${hasNestedList ? '1' : '0'}`,
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

        return true;
    });

    return DecorationSet.create(doc, decorations);
}

function dispatchListCollapseToggle(view: EditorView, pos: number) {
    view.dispatch(view.state.tr.setMeta(LIST_COLLAPSE_KEY, {
        type: 'toggle',
        pos,
    } satisfies ListCollapseAction));
}

export const listCollapsePlugin = $prose(() => {
    return new Plugin<ListCollapsePluginState>({
        key: LIST_COLLAPSE_KEY,

        state: {
            init(_config, state) {
                const collapsedItems = new Set<number>();
                return {
                    collapsedItems,
                    decorations: buildListCollapseDecorations(
                        state.doc,
                        collapsedItems,
                        dispatchListCollapseToggle,
                    ),
                };
            },
            apply(tr, oldPluginState, _oldEditorState, newEditorState) {
                const metaAction = parseListCollapseAction(tr.getMeta(LIST_COLLAPSE_KEY));
                if (!tr.docChanged && !metaAction) return oldPluginState;

                let collapsedItems = tr.docChanged
                    ? remapCollapsedListItems(oldPluginState.collapsedItems, tr, newEditorState.doc)
                    : new Set<number>(oldPluginState.collapsedItems);

                if (metaAction) {
                    collapsedItems = applyListCollapseAction(collapsedItems, metaAction);
                }

                return {
                    collapsedItems,
                    decorations: buildListCollapseDecorations(
                        newEditorState.doc,
                        collapsedItems,
                        dispatchListCollapseToggle,
                    ),
                };
            },
        },

        props: {
            decorations(state) {
                return this.getState(state)?.decorations ?? DecorationSet.empty;
            },
        },
    });
});
