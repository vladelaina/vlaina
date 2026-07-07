import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import {
    createCollapseToggleButton,
    COLLAPSED_CONTENT_CLASS,
    isCollapseToggleTarget
} from './collapseUtils';
import {
    STOP_PROSE_SCAN,
    scanProseDescendants,
    type BoundedProseScanNode,
} from '../shared/boundedProseNodeScan';
import {
    MAX_LIST_COLLAPSE_CHILD_SCAN_NODES,
    MAX_LIST_COLLAPSE_ITEMS,
} from './listCollapseConstants';

export interface ListCollapsePluginState {
    decorations: DecorationSet;
    collapsedItems: Set<number>;
}

const COLLAPSE_TYPE = 'list-item';
const ORDERED_MARKER_BASE_CHARS = 2;

function getOrderedListMarkerExtraOffset(node: any): string {
    if (node.attrs?.listType !== 'ordered') return '';

    const label = typeof node.attrs?.label === 'string' ? node.attrs.label.trim() : '';
    const markerChars = label.length;
    if (markerChars <= ORDERED_MARKER_BASE_CHARS) return '';

    return `${markerChars - ORDERED_MARKER_BASE_CHARS}ch`;
}

export function findNestedListCollapseRange(
    node: BoundedProseScanNode,
    pos: number,
): { from: number; to: number } | null {
    if (typeof node.child === 'function' && typeof node.childCount === 'number') {
        const childCount = Math.min(
            Math.max(0, Math.floor(node.childCount)),
            MAX_LIST_COLLAPSE_CHILD_SCAN_NODES,
        );
        let offset = 0;
        for (let index = 0; index < childCount; index += 1) {
            const child = node.child(index) as BoundedProseScanNode | null | undefined;
            if (!child) continue;
            if (child.type?.name === 'bullet_list' || child.type?.name === 'ordered_list') {
                const from = pos + 1 + offset;
                return {
                    from,
                    to: from + (child.nodeSize ?? 0),
                };
            }
            offset += child.nodeSize ?? 0;
        }
        return null;
    }

    if (typeof node.forEach !== 'function') return null;

    let nestedListRange: { from: number; to: number } | null = null;
    let scannedChildren = 0;
    node.forEach((child, offset) => {
        if (nestedListRange || scannedChildren >= MAX_LIST_COLLAPSE_CHILD_SCAN_NODES) {
            return;
        }
        scannedChildren += 1;
        if (child.type?.name === 'bullet_list' || child.type?.name === 'ordered_list') {
            const from = pos + 1 + offset;
            nestedListRange = {
                from,
                to: from + (child.nodeSize ?? 0),
            };
        }
    });

    return nestedListRange;
}

function buildListCollapseDecorations(
    doc: any,
    collapsedItems: Set<number>,
    dispatchToggle: (view: EditorView, pos: number) => void,
): DecorationSet {
    const decorations: Decoration[] = [];
    let decoratedItems = 0;

    scanProseDescendants(doc, (node, pos) => {
        if (decoratedItems >= MAX_LIST_COLLAPSE_ITEMS) return STOP_PROSE_SCAN;
        if (node.type?.name !== 'list_item') return true;
        const nestedListRange = findNestedListCollapseRange(node, pos);

        if (!nestedListRange) return true;
        decoratedItems += 1;

        const isCollapsed = collapsedItems.has(pos);
        const markerExtraOffset = getOrderedListMarkerExtraOffset(node);
        decorations.push(
            Decoration.widget(pos + 1, (view) => {
                const button = createCollapseToggleButton({
                    collapseType: COLLAPSE_TYPE,
                    collapsed: isCollapsed,
                    hasContent: true,
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
                key: `list-toggle-${pos}-${isCollapsed ? '1' : '0'}-1`,
                stopEvent(event) {
                    return isCollapseToggleTarget(event.target);
                },
            })
        );

        if (isCollapsed) {
            decorations.push(
                Decoration.node(nestedListRange.from, nestedListRange.to, {
                    class: COLLAPSED_CONTENT_CLASS,
                })
            );
        }

        return decoratedItems < MAX_LIST_COLLAPSE_ITEMS ? true : STOP_PROSE_SCAN;
    });

    return DecorationSet.create(doc, decorations);
}

export function buildListCollapsePluginState(
    doc: any,
    collapsedItems: Set<number>,
    dispatchToggle: (view: EditorView, pos: number) => void,
): ListCollapsePluginState {
    return {
        collapsedItems,
        decorations: buildListCollapseDecorations(doc, collapsedItems, dispatchToggle),
    };
}
