import { sinkListItem, liftListItem } from '@milkdown/kit/prose/schema-list';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { markEditorUserInput } from '../shared/userInputEvents';
import {
    collectInternalListGapPlaceholderCleanupRanges,
    isInternalListGapPlaceholderNode,
} from './listGapPlaceholders';
import { findSelectionListItemDepth, isSelectionInsideListItem } from './listSelectionHelpers';

function isInternalPlaceholderOnlyListItem(view: EditorView, listItemDepth: number): boolean {
    const listItem = view.state.selection.$from.node(listItemDepth);
    return isInternalListGapPlaceholderNode(listItem);
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

export function handleInternalPlaceholderListEnter(view: EditorView, event: KeyboardEvent): boolean {
    if (event.key !== 'Enter') return false;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.isComposing) return false;
    if (!view.state.selection.empty) return false;

    const listItemDepth = findSelectionListItemDepth(view);
    if (listItemDepth === null) return false;
    if (!isInternalPlaceholderOnlyListItem(view, listItemDepth)) return false;

    event.preventDefault();
    markEditorUserInput(view);
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

function findLastVisibleTextblockEndInNode(node: ProseNode, nodeStart: number): number | null {
    const stack: Array<{ node: ProseNode; start: number }> = [{ node, start: nodeStart }];

    while (stack.length > 0) {
        const current = stack.pop();
        if (!current) continue;

        if (current.node.isTextblock && !isInternalListGapPlaceholderNode(current.node)) {
            return current.start + 1 + current.node.content.size;
        }

        let childStart = current.start + 1;
        const children: Array<{ node: ProseNode; start: number }> = [];
        for (let index = 0; index < current.node.childCount; index += 1) {
            const child = current.node.child(index);
            children.push({ node: child, start: childStart });
            childStart += child.nodeSize;
        }

        for (const child of children) {
            stack.push(child);
        }
    }

    return null;
}

function findPreviousVisibleTextblockEndBefore(doc: ProseNode, boundary: number): number | null {
    const safeBoundary = Math.max(0, Math.min(boundary, doc.content.size));
    const $boundary = doc.resolve(safeBoundary);

    for (let depth = $boundary.depth; depth >= 0; depth -= 1) {
        const parent = $boundary.node(depth);
        const beforeIndex = $boundary.index(depth);
        let childStart = $boundary.start(depth);
        const childStarts: number[] = [];

        for (let index = 0; index < beforeIndex; index += 1) {
            const child = parent.child(index);
            childStarts.push(childStart);
            childStart += child.nodeSize;
        }

        for (let index = beforeIndex - 1; index >= 0; index -= 1) {
            const result = findLastVisibleTextblockEndInNode(parent.child(index), childStarts[index]);
            if (result !== null && result <= safeBoundary) return result;
        }
    }

    return null;
}

export function handleInternalPlaceholderListDeletion(view: EditorView, event: KeyboardEvent): boolean {
    if (event.key !== 'Backspace' && event.key !== 'Delete') return false;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.isComposing) return false;
    if (!view.state.selection.empty || !(view.state.selection instanceof TextSelection)) return false;

    const listItemDepth = findSelectionListItemDepth(view);
    if (listItemDepth === null || listItemDepth < 2) return false;
    if (!isInternalPlaceholderOnlyListItem(view, listItemDepth)) return false;

    const { state } = view;
    const { $from } = state.selection;
    const listDepth = listItemDepth - 1;
    const parentList = $from.node(listDepth);
    if (parentList.type.name !== 'ordered_list' && parentList.type.name !== 'bullet_list') return false;

    const listItemIndex = $from.index(listDepth);
    const listFrom = $from.before(listDepth);
    const listTo = $from.after(listDepth);
    const listItemFrom = $from.before(listItemDepth);
    const listItemTo = $from.after(listItemDepth);
    const deleteWholeList = parentList.childCount === 1;
    const deleteFrom = deleteWholeList ? listFrom : listItemFrom;
    const deleteTo = deleteWholeList ? listTo : listItemTo;
    const previousTextBoundary = deleteWholeList || listItemIndex === 0 ? listFrom : listItemFrom;
    const previousTextEnd = findPreviousVisibleTextblockEndBefore(state.doc, previousTextBoundary);
    if (previousTextEnd === null) return false;

    event.preventDefault();

    let tr = state.tr.delete(deleteFrom, deleteTo);
    const selectionPos = Math.max(
        0,
        Math.min(tr.doc.content.size, tr.mapping.map(previousTextEnd, -1))
    );

    try {
        tr = tr.setSelection(TextSelection.create(tr.doc, selectionPos));
    } catch {
        tr = tr.setSelection(TextSelection.near(tr.doc.resolve(selectionPos), -1));
    }

    markEditorUserInput(view);
    view.dispatch(tr.scrollIntoView());
    view.focus();
    return true;
}

export function handleEmptyParentListItemBackspace(view: EditorView, event: KeyboardEvent): boolean {
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
    markEditorUserInput(view);
    view.dispatch(tr.scrollIntoView());
    view.focus();
    return true;
}

export function handleListTabIndent(view: EditorView, event: KeyboardEvent): boolean {
    if (event.key !== 'Tab') return false;
    if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return false;

    event.preventDefault();

    if (!isSelectionInsideListItem(view)) return true;

    const listItemType = view.state.schema.nodes.list_item;
    if (!listItemType) return true;

    const command = event.shiftKey
        ? liftListItem(listItemType)
        : sinkListItem(listItemType);
    if (!command(view.state)) return true;
    markEditorUserInput(view);
    command(view.state, view.dispatch);
    return true;
}
