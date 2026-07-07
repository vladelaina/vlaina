import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { markEditorUserInput } from '../shared/userInputEvents';
import { listItemContainsInternalGapPlaceholder } from './listGapPlaceholders';
import { findSelectionListItemDepth } from './listSelectionHelpers';

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

export function handleInternalPlaceholderOrderedListTextInput(
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
    if (!listItemContainsInternalGapPlaceholder(listItem)) return false;

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

    markEditorUserInput(view);
    view.dispatch(tr);
    return true;
}
