import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { TextSelection, type EditorState, type Selection, type Transaction } from '@milkdown/kit/prose/state';
import {
    STOP_PROSE_SCAN,
    scanProseDescendants,
} from '../shared/boundedProseNodeScan';
import {
    MAX_ADJACENT_ORDERED_LIST_MERGE_SCAN_NODES,
    MAX_ORDERED_LIST_LABEL_SCAN_NODES,
} from './listTabIndentConstants';
import { normalizeOrderedListLabels } from './orderedListLabels';

type AdjacentOrderedListMerge = {
    from: number;
    secondFrom: number;
    to: number;
    merged: ProseNode;
};

type OrderedListScanFrame = {
    parent: ProseNode;
    contentStart: number;
    childIndex: number;
    offset: number;
    previous: { from: number; to: number; node: ProseNode } | null;
    pendingCurrent: { from: number; to: number; node: ProseNode } | null;
};

function createAdjacentOrderedListMerge(
    previous: { from: number; to: number; node: ProseNode } | null,
    current: { from: number; to: number; node: ProseNode }
): AdjacentOrderedListMerge | null {
    if (previous?.node.type.name !== 'ordered_list' || current.node.type.name !== 'ordered_list') {
        return null;
    }

    const order = typeof previous.node.attrs.order === 'number' ? previous.node.attrs.order : 1;
    const children: ProseNode[] = [];
    const appendChild = (child: ProseNode) => {
        const index = children.length;
        if (child.type.name !== 'list_item') {
            children.push(child);
            return;
        }
        children.push(child.type.create(
            {
                ...child.attrs,
                label: `${order + index}.`,
                listType: 'ordered',
            },
            child.content as any,
            child.marks
        ));
    };
    previous.node.forEach((child) => appendChild(child));
    current.node.forEach((child) => appendChild(child));

    return {
        from: previous.from,
        secondFrom: current.from,
        to: current.to,
        merged: previous.node.type.create(
            previous.node.attrs,
            children,
            previous.node.marks
        ),
    };
}

export function findAdjacentOrderedLists(
    doc: ProseNode,
    maxScanNodes = MAX_ADJACENT_ORDERED_LIST_MERGE_SCAN_NODES
): AdjacentOrderedListMerge | null {
    let scannedNodes = 0;
    const stack: OrderedListScanFrame[] = [{
        parent: doc,
        contentStart: 0,
        childIndex: 0,
        offset: 0,
        previous: null,
        pendingCurrent: null,
    }];

    while (stack.length > 0) {
        const frame = stack[stack.length - 1];
        if (frame.pendingCurrent) {
            const current = frame.pendingCurrent;
            frame.pendingCurrent = null;
            const merge = createAdjacentOrderedListMerge(frame.previous, current);
            if (merge) return merge;
            frame.previous = current;
            continue;
        }

        if (frame.childIndex >= frame.parent.childCount) {
            stack.pop();
            continue;
        }

        const node = frame.parent.child(frame.childIndex);
        const from = frame.contentStart + frame.offset;
        const current = { from, to: from + node.nodeSize, node };
        frame.childIndex += 1;
        frame.offset += node.nodeSize;
        scannedNodes += 1;
        if (scannedNodes > maxScanNodes) return null;

        if (node.content.size > 0) {
            frame.pendingCurrent = current;
            stack.push({
                parent: node,
                contentStart: from + 1,
                childIndex: 0,
                offset: 0,
                previous: null,
                pendingCurrent: null,
            });
            continue;
        }

        const merge = createAdjacentOrderedListMerge(frame.previous, current);
        if (merge) return merge;
        frame.previous = current;
    }

    return null;
}

function mapPositionThroughOrderedListMerge(pos: number, merge: AdjacentOrderedListMerge): number {
    if (pos <= merge.from) return pos;
    if (pos >= merge.to) return pos - (merge.to - merge.from - merge.merged.nodeSize);
    if (pos >= merge.secondFrom) return pos - 2;
    return pos;
}

function preserveSelectionAfterOrderedListMerge(
    tr: Transaction,
    selection: Selection,
    merge: AdjacentOrderedListMerge
): Transaction {
    if (!(selection instanceof TextSelection)) return tr;

    const from = mapPositionThroughOrderedListMerge(selection.from, merge);
    const to = mapPositionThroughOrderedListMerge(selection.to, merge);
    const maxPos = tr.doc.content.size;
    const clampedFrom = Math.max(0, Math.min(maxPos, from));
    const clampedTo = Math.max(0, Math.min(maxPos, to));

    const $from = tr.doc.resolve(clampedFrom);
    const $to = tr.doc.resolve(clampedTo);
    if ($from.parent.inlineContent && $to.parent.inlineContent) {
        return tr.setSelection(TextSelection.create(tr.doc, clampedFrom, clampedTo));
    }

    return tr.setSelection(TextSelection.near($from, 1));
}

const ORDERED_LIST_NORMALIZATION_NODE_NAMES = new Set(['ordered_list', 'bullet_list', 'list_item']);

function positionTouchesOrderedListNormalizationNode(doc: ProseNode, pos: number): boolean {
    const resolvedPos = Math.max(0, Math.min(pos, doc.content.size));
    const $pos = doc.resolve(resolvedPos);

    for (let depth = $pos.depth; depth > 0; depth -= 1) {
        if (ORDERED_LIST_NORMALIZATION_NODE_NAMES.has($pos.node(depth).type.name)) {
            return true;
        }
    }

    return Boolean(
        ($pos.nodeBefore && ORDERED_LIST_NORMALIZATION_NODE_NAMES.has($pos.nodeBefore.type.name))
        || ($pos.nodeAfter && ORDERED_LIST_NORMALIZATION_NODE_NAMES.has($pos.nodeAfter.type.name))
    );
}

export function rangeTouchesOrderedListNormalizationNode(
    doc: ProseNode,
    from: number,
    to: number,
    checkBoundaryPositions = true,
    maxScanNodes = MAX_ORDERED_LIST_LABEL_SCAN_NODES
): boolean {
    const start = Math.max(0, Math.min(from, doc.content.size));
    const end = Math.max(start, Math.min(to, doc.content.size));
    if (
        checkBoundaryPositions
        && (
            positionTouchesOrderedListNormalizationNode(doc, start)
            || positionTouchesOrderedListNormalizationNode(doc, end)
        )
    ) {
        return true;
    }

    const nodesBetween = (doc as {
        nodesBetween?: (
            from: number,
            to: number,
            callback: (node: ProseNode, pos: number) => boolean | void,
        ) => void;
    }).nodesBetween;
    if (typeof nodesBetween === 'function') {
        let touchesList = false;
        let scannedNodes = 0;
        const scanTo = Math.min(doc.content.size, Math.max(start + 1, end));
        if (scanTo <= start) return false;

        nodesBetween.call(doc, start, scanTo, (node) => {
            scannedNodes += 1;
            if (scannedNodes > maxScanNodes) {
                touchesList = true;
                return false;
            }
            if (ORDERED_LIST_NORMALIZATION_NODE_NAMES.has(node.type.name)) {
                touchesList = true;
                return false;
            }
            return true;
        });

        return touchesList;
    }

    let touchesList = false;
    const completed = scanProseDescendants(doc, (node, pos) => {
        const nodeSize = typeof node.nodeSize === 'number' ? node.nodeSize : 1;
        const nodeEnd = pos + nodeSize;
        if (nodeEnd < start) return true;
        if (pos > end) return STOP_PROSE_SCAN;
        if (node.type?.name && ORDERED_LIST_NORMALIZATION_NODE_NAMES.has(node.type.name)) {
            touchesList = true;
            return STOP_PROSE_SCAN;
        }
        return true;
    }, maxScanNodes);

    return touchesList || !completed;
}

export function docChangeMayAffectOrderedListNormalization(prevDoc: ProseNode, nextDoc: ProseNode): boolean {
    const diffStart = prevDoc.content.findDiffStart(nextDoc.content);
    if (diffStart === null) return false;

    const diffEnd = prevDoc.content.findDiffEnd(nextDoc.content);
    if (!diffEnd) return true;

    return (
        rangeTouchesOrderedListNormalizationNode(prevDoc, diffStart, diffEnd.a)
        || rangeTouchesOrderedListNormalizationNode(nextDoc, diffStart, diffEnd.b)
    );
}

export function normalizeOrderedListsAfterChange(state: EditorState): Transaction | null {
    let tr = state.tr;
    let mergedAny = false;

    for (;;) {
        const adjacent = findAdjacentOrderedLists(tr.doc);
        if (!adjacent) break;

        const selectionBeforeMerge = tr.selection;
        tr = tr.replaceWith(adjacent.from, adjacent.to, adjacent.merged);
        tr = preserveSelectionAfterOrderedListMerge(
            tr,
            selectionBeforeMerge,
            adjacent
        );
        mergedAny = true;
    }

    if (mergedAny) return tr.setMeta('addToHistory', false);

    return normalizeOrderedListLabels(state);
}
