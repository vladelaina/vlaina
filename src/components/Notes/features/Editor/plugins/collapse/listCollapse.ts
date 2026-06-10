import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import {
    createCollapseToggleButton,
    COLLAPSED_CONTENT_CLASS,
    isCollapseToggleTarget
} from './collapseUtils';
import {
    STOP_PROSE_SCAN,
    scanProseDescendants,
} from '../shared/boundedProseNodeScan';
import {
    getTransactionChangedRanges,
    transactionTouchesDecorations,
} from '../shared/transactionStepText';

type ListCollapseActionType = 'toggle' | 'expand' | 'collapse';

interface ListCollapseAction {
    type: ListCollapseActionType;
    pos: number;
}

export interface ListCollapsePluginState {
    decorations: DecorationSet;
    collapsedItems: Set<number>;
}

const LIST_COLLAPSE_KEY = new PluginKey<ListCollapsePluginState>('listCollapse');
const COLLAPSE_TYPE = 'list-item';
const ORDERED_MARKER_BASE_CHARS = 2;
export const MAX_LIST_COLLAPSE_ITEMS = 1000;
export const MAX_LIST_COLLAPSE_CHILD_SCAN_NODES = 2000;

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

export function findNestedListCollapseRange(
    node: {
        child?: (index: number) => { nodeSize?: number; type?: { name?: string } } | null | undefined;
        childCount?: number;
        forEach?: (callback: (child: { nodeSize?: number; type?: { name?: string } }, offset: number) => void) => void;
    },
    pos: number,
): { from: number; to: number } | null {
    if (typeof node.child === 'function' && typeof node.childCount === 'number') {
        const childCount = Math.min(
            Math.max(0, Math.floor(node.childCount)),
            MAX_LIST_COLLAPSE_CHILD_SCAN_NODES,
        );
        let offset = 0;
        for (let index = 0; index < childCount; index += 1) {
            const child = node.child(index);
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

const LIST_COLLAPSE_STRUCTURE_NODE_NAMES = new Set(['bullet_list', 'ordered_list', 'list_item']);

function positionTouchesListCollapseStructure(doc: any, pos: number): boolean {
    try {
        const resolvedPos = Math.max(0, Math.min(pos, doc.content?.size ?? 0));
        const $pos = doc.resolve(resolvedPos);

        for (let depth = $pos.depth; depth > 0; depth -= 1) {
            if (LIST_COLLAPSE_STRUCTURE_NODE_NAMES.has($pos.node(depth).type.name)) {
                return true;
            }
        }

        return Boolean(
            ($pos.nodeBefore && LIST_COLLAPSE_STRUCTURE_NODE_NAMES.has($pos.nodeBefore.type.name))
            || ($pos.nodeAfter && LIST_COLLAPSE_STRUCTURE_NODE_NAMES.has($pos.nodeAfter.type.name))
            || LIST_COLLAPSE_STRUCTURE_NODE_NAMES.has(doc.nodeAt?.(resolvedPos)?.type?.name)
        );
    } catch {
        return false;
    }
}

function rangeTouchesListCollapseStructure(doc: any, from: number, to: number): boolean {
    const start = Math.max(0, Math.min(from, doc.content?.size ?? 0));
    const end = Math.max(start, Math.min(to, doc.content?.size ?? 0));

    if (
        positionTouchesListCollapseStructure(doc, start)
        || positionTouchesListCollapseStructure(doc, end)
    ) {
        return true;
    }

    if (end <= start || typeof doc.nodesBetween !== 'function') {
        return false;
    }

    let touchesListStructure = false;
    doc.nodesBetween(start, end, (node: { type?: { name?: string } }) => {
        if (node.type?.name && LIST_COLLAPSE_STRUCTURE_NODE_NAMES.has(node.type.name)) {
            touchesListStructure = true;
            return false;
        }
        return !touchesListStructure;
    });
    return touchesListStructure;
}

function transactionIsPureInsertion(tr: unknown): boolean {
    const ranges = getTransactionChangedRanges(tr);
    return ranges.length > 0 && ranges.every((range) => range.oldFrom === range.oldTo);
}

function changesOccurAfterExistingListCollapseDecorations(
    pluginState: ListCollapsePluginState,
    tr: unknown,
): boolean {
    const decorations = pluginState.decorations.find() as Array<{ from?: number; to?: number }>;
    if (decorations.length === 0) return true;

    const lastDecorationPos = decorations.reduce(
        (max, decoration) => Math.max(max, decoration.to ?? decoration.from ?? 0),
        0,
    );
    return getTransactionChangedRanges(tr).every((range) => range.oldFrom >= lastDecorationPos);
}

export function canMapListCollapsePluginState(
    pluginState: ListCollapsePluginState,
    tr: unknown,
    oldDoc: any,
    newDoc: any,
): boolean {
    if (pluginState.collapsedItems.size > 0) return false;
    if (!transactionIsPureInsertion(tr)) return false;
    if (transactionTouchesDecorations(pluginState.decorations, tr)) return false;
    if (!changesOccurAfterExistingListCollapseDecorations(pluginState, tr)) return false;

    return getTransactionChangedRanges(tr).every((range) => (
        !rangeTouchesListCollapseStructure(oldDoc, range.oldFrom, range.oldTo)
        && !rangeTouchesListCollapseStructure(newDoc, range.newFrom, range.newTo)
    ));
}

export function mapListCollapsePluginState(
    pluginState: ListCollapsePluginState,
    tr: { mapping: Parameters<DecorationSet['map']>[0] },
    doc: any,
): ListCollapsePluginState {
    return {
        collapsedItems: pluginState.collapsedItems,
        decorations: pluginState.decorations.map(tr.mapping, doc),
    };
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
                return buildListCollapsePluginState(
                    state.doc,
                    collapsedItems,
                    dispatchListCollapseToggle,
                );
            },
            apply(tr, oldPluginState, oldEditorState, newEditorState) {
                const metaAction = parseListCollapseAction(tr.getMeta(LIST_COLLAPSE_KEY));
                if (!tr.docChanged && !metaAction) return oldPluginState;

                if (
                    tr.docChanged
                    && !metaAction
                    && canMapListCollapsePluginState(oldPluginState, tr, oldEditorState.doc, newEditorState.doc)
                ) {
                    return mapListCollapsePluginState(oldPluginState, tr, newEditorState.doc);
                }

                let collapsedItems = tr.docChanged
                    ? remapCollapsedListItems(oldPluginState.collapsedItems, tr, newEditorState.doc)
                    : new Set<number>(oldPluginState.collapsedItems);

                if (metaAction) {
                    collapsedItems = applyListCollapseAction(collapsedItems, metaAction);
                }

                return buildListCollapsePluginState(
                    newEditorState.doc,
                    collapsedItems,
                    dispatchListCollapseToggle,
                );
            },
        },

        props: {
            decorations(state) {
                return this.getState(state)?.decorations ?? DecorationSet.empty;
            },
        },
    });
});
