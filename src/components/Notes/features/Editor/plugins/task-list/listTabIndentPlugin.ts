import { sinkListItem, liftListItem } from '@milkdown/kit/prose/schema-list';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { Plugin, PluginKey, TextSelection, type EditorState, type Selection, type Transaction } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';

export const listTabIndentPluginKey = new PluginKey('listTabIndent');
const EDITABLE_LIST_GAP_PLACEHOLDER = '\u2800';
const LIST_GAP_PLACEHOLDER_CLASS = 'editor-list-gap-placeholder-item';

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
    return listItem.textContent.replace(new RegExp(EDITABLE_LIST_GAP_PLACEHOLDER, 'g'), '').trim().length === 0;
}

function removeInternalListGapPlaceholdersFromListItem(view: EditorView, listItemDepth: number): boolean {
    const { state } = view;
    const listItem = state.selection.$from.node(listItemDepth);
    const listItemStart = state.selection.$from.before(listItemDepth);
    const ranges: Array<{ from: number; to: number }> = [];

    listItem.descendants((node, pos) => {
        if (!node.isText || !node.text?.includes(EDITABLE_LIST_GAP_PLACEHOLDER)) {
            return true;
        }
        for (let index = 0; index < node.text.length; index += 1) {
            if (node.text[index] !== EDITABLE_LIST_GAP_PLACEHOLDER) continue;
            const from = listItemStart + 1 + pos + index;
            ranges.push({ from, to: from + 1 });
        }
        return true;
    });

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

function buildInternalListGapDecorations(doc: Parameters<typeof DecorationSet.create>[0]): DecorationSet {
    const decorations: Decoration[] = [];

    doc.descendants((node, pos) => {
        if (node.type.name !== 'list_item') return true;
        const textWithoutPlaceholders = node.textContent
            .replace(new RegExp(EDITABLE_LIST_GAP_PLACEHOLDER, 'g'), '')
            .trim();
        if (node.textContent.includes(EDITABLE_LIST_GAP_PLACEHOLDER) && textWithoutPlaceholders.length === 0) {
            decorations.push(Decoration.node(pos, pos + node.nodeSize, {
                class: LIST_GAP_PLACEHOLDER_CLASS,
            }));
        }
        return true;
    });

    return DecorationSet.create(doc, decorations);
}

type AdjacentOrderedListMerge = {
    from: number;
    secondFrom: number;
    to: number;
    merged: ProseNode;
};

function findAdjacentOrderedLists(doc: ProseNode): AdjacentOrderedListMerge | null {
    return findAdjacentOrderedListsInParent(doc, 0);
}

function findAdjacentOrderedListsInParent(
    parent: ProseNode,
    contentStart: number
): AdjacentOrderedListMerge | null {
    let previous: { from: number; to: number; node: ProseNode } | null = null;
    let result: AdjacentOrderedListMerge | null = null;

    parent.forEach((node, offset) => {
        if (result) return;
        const from = contentStart + offset;
        const current = { from, to: from + node.nodeSize, node };
        if (node.content.size > 0) {
            result = findAdjacentOrderedListsInParent(node, from + 1);
            if (result) return;
        }
        if (previous?.node.type.name === 'ordered_list' && node.type.name === 'ordered_list') {
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
            node.forEach((child) => appendChild(child));
            result = {
                from: previous.from,
                secondFrom: current.from,
                to: current.to,
                merged: previous.node.type.create(
                    previous.node.attrs,
                    children,
                    previous.node.marks
                ),
            };
            return;
        }
        previous = current;
    });

    return result;
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

function normalizeOrderedListLabels(state: EditorState): Transaction | null {
    let tr = state.tr;
    let changed = false;

    state.doc.descendants((node, pos, parent, index) => {
        if (node.type.name !== 'list_item' || parent?.type.name !== 'ordered_list') {
            return true;
        }

        const order = typeof parent.attrs.order === 'number' ? parent.attrs.order : 1;
        const expectedLabel = `${order + (index ?? 0)}.`;
        const attrs = {
            ...node.attrs,
            label: expectedLabel,
            listType: 'ordered',
        };

        if (node.attrs.label !== attrs.label || node.attrs.listType !== attrs.listType) {
            tr = tr.setNodeMarkup(pos, undefined, attrs);
            changed = true;
        }

        return true;
    });

    return changed ? tr.setMeta('addToHistory', false) : null;
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
        appendTransaction(transactions, _oldState, newState) {
            if (!transactions.some((tr) => tr.docChanged)) return null;
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
