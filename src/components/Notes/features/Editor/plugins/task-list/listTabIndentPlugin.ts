import { sinkListItem, liftListItem } from '@milkdown/kit/prose/schema-list';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { Plugin, PluginKey, TextSelection, type EditorState, type Selection, type Transaction } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import {
    DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT,
    STOP_PROSE_SCAN,
    scanProseDescendants,
} from '../shared/boundedProseNodeScan';

export const listTabIndentPluginKey = new PluginKey('listTabIndent');
const EDITABLE_LIST_GAP_PLACEHOLDER = '\u2800';
const LIST_GAP_PLACEHOLDER_CLASS = 'editor-list-gap-placeholder-item';
export const MAX_LIST_GAP_PLACEHOLDER_DECORATIONS = 1000;
export const MAX_ORDERED_LIST_LABEL_UPDATES = 5000;
export const MAX_ORDERED_LIST_LABEL_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
const MAX_LIST_GAP_PLACEHOLDER_SCAN_CHARS = 256;
export const MAX_LIST_GAP_PLACEHOLDER_CLEANUP_RANGES = MAX_LIST_GAP_PLACEHOLDER_SCAN_CHARS;
const VISIBLE_LIST_GAP_TEXT_PATTERN = /\S/u;

function isSelectionInsideListItem(view: EditorView): boolean {
    const listItemType = view.state.schema.nodes.list_item;
    if (!listItemType) return false;

    const { $from, $to } = view.state.selection;
    let fromHasListItem = false;
    for (let depth = $from.depth; depth >= 0; depth -= 1) {
        if ($from.node(depth).type === listItemType) {
            fromHasListItem = true;
            break;
        }
    }
    if (!fromHasListItem) return false;

    for (let depth = $to.depth; depth >= 0; depth -= 1) {
        if ($to.node(depth).type === listItemType) {
            return true;
        }
    }
    return false;
}

function findSelectionListItemDepth(view: EditorView): number | null {
    const listItemType = view.state.schema.nodes.list_item;
    if (!listItemType) return null;

    const { $from } = view.state.selection;
    for (let depth = $from.depth; depth >= 0; depth -= 1) {
        if ($from.node(depth).type === listItemType) {
            return depth;
        }
    }
    return null;
}

function isInternalPlaceholderOnlyListItem(view: EditorView, listItemDepth: number): boolean {
    const listItem = view.state.selection.$from.node(listItemDepth);
    return isInternalListGapPlaceholderNode(listItem);
}

export function collectInternalListGapPlaceholderCleanupRanges(
    listItem: ProseNode,
    listItemStart: number
): {
    complete: boolean;
    ranges: Array<{ from: number; to: number }>;
} {
    const ranges: Array<{ from: number; to: number }> = [];
    let scannedChars = 0;
    let exhausted = false;

    const completed = scanProseDescendants(listItem, (node, pos) => {
        if (ranges.length >= MAX_LIST_GAP_PLACEHOLDER_CLEANUP_RANGES) {
            exhausted = true;
            return STOP_PROSE_SCAN;
        }
        if (!node.isText) {
            return true;
        }

        const text = node.text ?? '';
        const remainingChars = MAX_LIST_GAP_PLACEHOLDER_SCAN_CHARS - scannedChars;
        if (remainingChars <= 0 || text.length >= remainingChars) {
            exhausted = true;
            return STOP_PROSE_SCAN;
        }
        scannedChars += text.length;
        if (!text.includes(EDITABLE_LIST_GAP_PLACEHOLDER)) return true;

        for (let index = 0; index < text.length; index += 1) {
            if (text[index] !== EDITABLE_LIST_GAP_PLACEHOLDER) continue;
            const from = listItemStart + 1 + pos + index;
            ranges.push({ from, to: from + 1 });
            if (ranges.length >= MAX_LIST_GAP_PLACEHOLDER_CLEANUP_RANGES) {
                exhausted = true;
                return STOP_PROSE_SCAN;
            }
        }
        return true;
    });

    return { complete: completed && !exhausted, ranges };
}

function removeInternalListGapPlaceholdersFromListItem(view: EditorView, listItemDepth: number): boolean {
    const { state } = view;
    const listItem = state.selection.$from.node(listItemDepth);
    const listItemStart = state.selection.$from.before(listItemDepth);
    const { complete, ranges } = collectInternalListGapPlaceholderCleanupRanges(listItem, listItemStart);

    if (!complete) return false;
    if (ranges.length === 0) return false;

    let tr = state.tr;
    for (const range of ranges.reverse()) {
        tr = tr.delete(range.from, range.to);
    }
    const mappedSelection = Math.max(
        1,
        Math.min(tr.doc.content.size, tr.mapping.map(state.selection.from, -1))
    );
    tr = tr.setSelection(TextSelection.near(tr.doc.resolve(mappedSelection), -1));
    view.dispatch(tr);
    return true;
}

function getSiblingNodeAtDepth(view: EditorView, depth: number, direction: -1 | 1): ProseNode | null {
    const { $from } = view.state.selection;
    if (depth <= 0 || depth > $from.depth) return null;

    const parent = $from.node(depth - 1);
    const siblingIndex = $from.index(depth - 1) + direction;
    if (siblingIndex < 0 || siblingIndex >= parent.childCount) return null;
    return parent.child(siblingIndex);
}

function resolveOrderedGapStart(view: EditorView, listDepth: number): number | null {
    const previous = getSiblingNodeAtDepth(view, listDepth, -1);
    if (previous?.type.name === 'ordered_list') {
        const order = typeof previous.attrs.order === 'number' ? previous.attrs.order : 1;
        return order + previous.childCount;
    }

    const next = getSiblingNodeAtDepth(view, listDepth, 1);
    if (next?.type.name === 'ordered_list') {
        const order = typeof next.attrs.order === 'number' ? next.attrs.order : 1;
        return Math.max(1, order - 1);
    }

    return null;
}

function handleInternalPlaceholderOrderedListTextInput(
    view: EditorView,
    _from: number,
    _to: number,
    text: string
): boolean {
    if (text.length === 0 || !view.state.selection.empty) return false;

    const listItemDepth = findSelectionListItemDepth(view);
    if (listItemDepth === null || listItemDepth < 2) return false;

    const listDepth = listItemDepth - 1;
    const listNode = view.state.selection.$from.node(listDepth);
    if (listNode.type.name !== 'bullet_list') return false;

    const orderedGapStart = resolveOrderedGapStart(view, listDepth);
    if (orderedGapStart === null) return false;

    const paragraphType = view.state.schema.nodes.paragraph;
    if (!paragraphType) return false;

    const listItem = view.state.selection.$from.node(listItemDepth);
    if (!listItem.textContent.includes(EDITABLE_LIST_GAP_PLACEHOLDER)) return false;

    const listStart = view.state.selection.$from.before(listDepth);
    const listEnd = view.state.selection.$from.after(listDepth);
    const listItemIndex = view.state.selection.$from.index(listDepth);
    const replacementNodes: ProseNode[] = [];
    const beforeItems: ProseNode[] = [];
    const afterItems: ProseNode[] = [];

    listNode.forEach((child, _offset, index) => {
        if (index < listItemIndex) {
            beforeItems.push(child);
        } else if (index > listItemIndex) {
            afterItems.push(child);
        }
    });

    if (beforeItems.length > 0) {
        replacementNodes.push(listNode.type.create(listNode.attrs, beforeItems, listNode.marks));
    }

    const paragraph = paragraphType.create(
        null,
        text.length > 0 ? view.state.schema.text(text) : undefined
    );
    replacementNodes.push(paragraph);

    if (afterItems.length > 0) {
        replacementNodes.push(listNode.type.create(listNode.attrs, afterItems, listNode.marks));
    }

    const paragraphStart = listStart + (beforeItems.length > 0 ? replacementNodes[0].nodeSize : 0);
    let tr = view.state.tr.replaceWith(listStart, listEnd, replacementNodes);
    tr = tr
        .setSelection(TextSelection.create(tr.doc, paragraphStart + 1 + text.length))
        .scrollIntoView();

    view.dispatch(tr);
    return true;
}

function handleInternalPlaceholderListEnter(view: EditorView, event: KeyboardEvent): boolean {
    if (event.key !== 'Enter') return false;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.isComposing) return false;
    if (!view.state.selection.empty) return false;

    const listItemDepth = findSelectionListItemDepth(view);
    if (listItemDepth === null) return false;
    if (!isInternalPlaceholderOnlyListItem(view, listItemDepth)) return false;

    event.preventDefault();
    removeInternalListGapPlaceholdersFromListItem(view, listItemDepth);

    const listItemType = view.state.schema.nodes.list_item;
    if (!listItemType) return true;
    liftListItem(listItemType)(view.state, view.dispatch);
    view.focus();
    return true;
}

function createListWithItems(list: ProseNode, items: ProseNode[]): ProseNode | null {
    return items.length > 0 ? list.type.create(list.attrs, items, list.marks) : null;
}

function handleEmptyParentListItemBackspace(view: EditorView, event: KeyboardEvent): boolean {
    if (event.key !== 'Backspace') return false;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.isComposing) return false;
    if (!view.state.selection.empty || !(view.state.selection instanceof TextSelection)) return false;

    const { state } = view;
    const { $from } = state.selection;
    if ($from.parent.type.name !== 'paragraph' || $from.parent.content.size !== 0 || $from.parentOffset !== 0) {
        return false;
    }

    const listItemDepth = findSelectionListItemDepth(view);
    if (listItemDepth === null || listItemDepth < 2) return false;
    if ($from.index(listItemDepth) !== 0) return false;

    const listDepth = listItemDepth - 1;
    const parentList = $from.node(listDepth);
    const listItem = $from.node(listItemDepth);
    if (parentList.type.name !== 'ordered_list' && parentList.type.name !== 'bullet_list') return false;
    if (listItem.childCount !== 2) return false;

    const emptyParagraph = listItem.child(0);
    const nestedList = listItem.child(1);
    if (emptyParagraph.type.name !== 'paragraph' || emptyParagraph.content.size !== 0) return false;
    if (nestedList.type.name !== parentList.type.name) return false;

    const paragraphType = state.schema.nodes.paragraph;
    if (!paragraphType) return false;

    const listItemIndex = $from.index(listDepth);
    const beforeItems: ProseNode[] = [];
    const afterItems: ProseNode[] = [];

    parentList.forEach((child, _offset, index) => {
        if (index < listItemIndex) beforeItems.push(child);
        if (index > listItemIndex) afterItems.push(child);
    });

    const replacementNodes = [
        createListWithItems(parentList, beforeItems),
        paragraphType.create(),
        nestedList,
        createListWithItems(parentList, afterItems),
    ].filter((node): node is ProseNode => node !== null);

    event.preventDefault();

    const listFrom = $from.before(listDepth);
    const listTo = $from.after(listDepth);
    const paragraphIndex = beforeItems.length > 0 ? 1 : 0;
    const paragraphStart = listFrom + replacementNodes
        .slice(0, paragraphIndex)
        .reduce((offset, node) => offset + node.nodeSize, 0);

    let tr = state.tr.replaceWith(listFrom, listTo, replacementNodes);
    tr = tr.setSelection(TextSelection.create(tr.doc, paragraphStart + 1));
    view.dispatch(tr.scrollIntoView());
    view.focus();
    return true;
}

function isInternalListGapPlaceholderNode(node: ProseNode): boolean {
    let hasPlaceholder = false;
    let scannedChars = 0;
    let hasVisibleText = false;

    scanProseDescendants(node, (child) => {
        if (!child.isText) return true;

        const text = child.text ?? '';
        const remainingChars = MAX_LIST_GAP_PLACEHOLDER_SCAN_CHARS - scannedChars;
        if (remainingChars <= 0) return STOP_PROSE_SCAN;

        const prefix = text.slice(0, remainingChars);
        scannedChars += text.length;

        for (const char of prefix) {
            if (char === EDITABLE_LIST_GAP_PLACEHOLDER) {
                hasPlaceholder = true;
            } else if (VISIBLE_LIST_GAP_TEXT_PATTERN.test(char)) {
                hasVisibleText = true;
                return STOP_PROSE_SCAN;
            }
        }

        return scannedChars < MAX_LIST_GAP_PLACEHOLDER_SCAN_CHARS ? true : STOP_PROSE_SCAN;
    });

    return hasPlaceholder && !hasVisibleText && scannedChars < MAX_LIST_GAP_PLACEHOLDER_SCAN_CHARS;
}

export function collectInternalListGapDecorations(doc: Parameters<typeof DecorationSet.create>[0]): Decoration[] {
    const decorations: Decoration[] = [];

    scanProseDescendants(doc, (node, pos) => {
        if (decorations.length >= MAX_LIST_GAP_PLACEHOLDER_DECORATIONS) return STOP_PROSE_SCAN;
        if (node.type?.name !== 'list_item') return true;
        if (typeof node.nodeSize !== 'number') return true;
        if (isInternalListGapPlaceholderNode(node as ProseNode)) {
            decorations.push(Decoration.node(pos, pos + node.nodeSize, {
                class: LIST_GAP_PLACEHOLDER_CLASS,
            }));
        }
        return decorations.length < MAX_LIST_GAP_PLACEHOLDER_DECORATIONS ? true : STOP_PROSE_SCAN;
    });

    return decorations;
}

export function buildInternalListGapDecorations(doc: Parameters<typeof DecorationSet.create>[0]): DecorationSet {
    return DecorationSet.create(doc, collectInternalListGapDecorations(doc));
}

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

export function findAdjacentOrderedLists(doc: ProseNode): AdjacentOrderedListMerge | null {
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

    try {
        return tr.setSelection(TextSelection.create(tr.doc, clampedFrom, clampedTo));
    } catch {
        return tr.setSelection(TextSelection.near(tr.doc.resolve(clampedFrom), 1));
    }
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

function rangeTouchesOrderedListNormalizationNode(doc: ProseNode, from: number, to: number): boolean {
    const start = Math.max(0, Math.min(from, doc.content.size));
    const end = Math.max(start, Math.min(to, doc.content.size));
    if (
        positionTouchesOrderedListNormalizationNode(doc, start)
        || positionTouchesOrderedListNormalizationNode(doc, end)
    ) {
        return true;
    }

    let touchesList = false;
    doc.nodesBetween(start, end, (node) => {
        if (ORDERED_LIST_NORMALIZATION_NODE_NAMES.has(node.type.name)) {
            touchesList = true;
            return false;
        }
        return !touchesList;
    });

    return touchesList;
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

export function collectOrderedListLabelUpdates(doc: ProseNode): Array<{
    attrs: Record<string, unknown>;
    pos: number;
}> {
    const updates: Array<{
        attrs: Record<string, unknown>;
        pos: number;
    }> = [];

    scanProseDescendants(doc, (node, pos, parent, index) => {
        if (updates.length >= MAX_ORDERED_LIST_LABEL_UPDATES) return STOP_PROSE_SCAN;
        if (node.type?.name !== 'list_item' || parent?.type?.name !== 'ordered_list') {
            return true;
        }

        const parentAttrs = parent.attrs ?? {};
        const nodeAttrs = node.attrs ?? {};
        const order = typeof parentAttrs.order === 'number' ? parentAttrs.order : 1;
        const expectedLabel = `${order + (index ?? 0)}.`;
        const attrs = {
            ...nodeAttrs,
            label: expectedLabel,
            listType: 'ordered',
        };

        if (nodeAttrs.label !== attrs.label || nodeAttrs.listType !== attrs.listType) {
            updates.push({ attrs, pos });
        }

        return updates.length < MAX_ORDERED_LIST_LABEL_UPDATES ? true : STOP_PROSE_SCAN;
    }, MAX_ORDERED_LIST_LABEL_SCAN_NODES);

    return updates;
}

function normalizeOrderedListLabels(state: EditorState): Transaction | null {
    let tr = state.tr;
    const updates = collectOrderedListLabelUpdates(state.doc);
    for (const update of updates) {
        tr = tr.setNodeMarkup(update.pos, undefined, update.attrs);
    }

    return updates.length > 0 ? tr.setMeta('addToHistory', false) : null;
}

function normalizeOrderedListsAfterChange(state: EditorState): Transaction | null {
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

export const listTabIndentPlugin = $prose(() => {
    return new Plugin({
        key: listTabIndentPluginKey,
        state: {
            init(_config, state) {
                return buildInternalListGapDecorations(state.doc);
            },
            apply(tr, previous, _oldState, newState) {
                if (!tr.docChanged) return previous;
                return buildInternalListGapDecorations(newState.doc);
            },
        },
        appendTransaction(transactions, oldState, newState) {
            if (!transactions.some((tr) => tr.docChanged)) return null;
            if (!docChangeMayAffectOrderedListNormalization(oldState.doc, newState.doc)) return null;
            return normalizeOrderedListsAfterChange(newState);
        },
        props: {
            decorations(state) {
                return this.getState(state) ?? DecorationSet.empty;
            },
            handleTextInput(view, from, to, text) {
                return handleInternalPlaceholderOrderedListTextInput(view, from, to, text);
            },
            handleKeyDown(view, event) {
                if (handleInternalPlaceholderListEnter(view, event)) return true;
                if (handleEmptyParentListItemBackspace(view, event)) return true;
                if (event.key !== 'Tab') return false;
                if (event.metaKey || event.ctrlKey || event.altKey) return false;

                event.preventDefault();

                if (!isSelectionInsideListItem(view)) return true;

                const listItemType = view.state.schema.nodes.list_item;
                if (!listItemType) return true;

                const command = event.shiftKey
                    ? liftListItem(listItemType)
                    : sinkListItem(listItemType);
                command(view.state, view.dispatch);
                return true;
            },
        },
    });
});
