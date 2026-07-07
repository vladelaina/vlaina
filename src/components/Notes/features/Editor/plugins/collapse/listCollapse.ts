import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import {
    buildListCollapsePluginState,
    type ListCollapsePluginState,
} from './listCollapseDecorations';
import { createNestedListHoverView } from './listCollapseHover';
import { MAX_LIST_COLLAPSE_STRUCTURE_SCAN_NODES } from './listCollapseConstants';
import { getTransactionChangedRanges, transactionTouchesDecorations } from '../shared/transactionStepText';

export {
    LIST_NESTED_LIST_HOVER_CLASS,
    MAX_LIST_COLLAPSE_CHILD_SCAN_NODES,
    MAX_LIST_COLLAPSE_ITEMS,
    MAX_LIST_COLLAPSE_STRUCTURE_SCAN_NODES,
} from './listCollapseConstants';
export {
    buildListCollapsePluginState,
    findNestedListCollapseRange,
    type ListCollapsePluginState,
} from './listCollapseDecorations';
export { collectNestedListHoverParents } from './listCollapseHover';

type ListCollapseActionType = 'toggle' | 'expand' | 'collapse';

interface ListCollapseAction {
    type: ListCollapseActionType;
    pos: number;
}

const LIST_COLLAPSE_KEY = new PluginKey<ListCollapsePluginState>('listCollapse');

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

export function rangeTouchesListCollapseStructure(
    doc: any,
    from: number,
    to: number,
    maxScanNodes = MAX_LIST_COLLAPSE_STRUCTURE_SCAN_NODES,
): boolean {
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
    let scannedNodes = 0;
    doc.nodesBetween(start, end, (node: { type?: { name?: string } }) => {
        scannedNodes += 1;
        if (scannedNodes > maxScanNodes) {
            touchesListStructure = true;
            return false;
        }
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

export function canMapListCollapsePluginState(
    pluginState: ListCollapsePluginState,
    tr: unknown,
    oldDoc: any,
    newDoc: any,
): boolean {
    if (pluginState.collapsedItems.size > 0) return false;
    if (!transactionIsPureInsertion(tr)) return false;
    if (transactionTouchesDecorations(pluginState.decorations, tr)) return false;

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

        view(editorView) {
            return createNestedListHoverView(editorView);
        },

        props: {
            decorations(state) {
                return this.getState(state)?.decorations ?? DecorationSet.empty;
            },
        },
    });
});
