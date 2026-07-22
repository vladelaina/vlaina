import { Fragment, type Node as ProseNode } from '@milkdown/kit/prose/model';
import { Selection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';

import { findTailCursorPosInRange } from './pasteCursorUtils';
import { markEditorUserInput } from '../shared/userInputEvents';
import { clipboardPluginKey } from './clipboardPluginConstants';

function findAncestorDepth(state: {
    selection: {
        $from: {
            depth: number;
            node: (depth: number) => ProseNode;
        };
    };
}, predicate: (node: ProseNode) => boolean): number | null {
    const { $from } = state.selection;
    for (let depth = $from.depth; depth >= 0; depth -= 1) {
        if (predicate($from.node(depth))) return depth;
    }
    return null;
}

export function dispatchParagraphPasteFromEmptyTaskItem(
    view: EditorView,
    paragraphNodes: ProseNode[],
): boolean {
    if (paragraphNodes.length < 2) return false;

    const { state } = view;
    const { selection } = state;
    if (!selection.empty || selection.$from.parent.type.name !== 'paragraph' || selection.$from.parent.content.size !== 0) {
        return false;
    }

    const itemDepth = findAncestorDepth(state, (node) => node.type.name === 'list_item');
    if (itemDepth === null || itemDepth < 1) return false;

    const listItem = selection.$from.node(itemDepth);
    if (listItem.attrs.checked == null || listItem.childCount !== 1) return false;

    const listDepth = itemDepth - 1;
    const listNode = selection.$from.node(listDepth);
    if (listNode.type.name !== 'bullet_list' && listNode.type.name !== 'ordered_list') return false;

    const itemIndex = selection.$from.index(listDepth);
    const leadingItems: ProseNode[] = [];
    const trailingItems: ProseNode[] = [];
    listNode.forEach((child, _offset, index) => {
        if (index < itemIndex) {
            leadingItems.push(child);
            return;
        }
        if (index === itemIndex) {
            leadingItems.push(listItem.copy(Fragment.from(paragraphNodes[0])));
            return;
        }
        trailingItems.push(child);
    });

    const leadingList = listNode.copy(Fragment.fromArray(leadingItems));
    const replacementNodes = [leadingList, ...paragraphNodes.slice(1)];
    if (trailingItems.length > 0) {
        const trailingAttrs = listNode.type.name === 'ordered_list'
            ? {
                ...listNode.attrs,
                order: (typeof listNode.attrs.order === 'number' ? listNode.attrs.order : 1) + itemIndex + 1,
            }
            : listNode.attrs;
        replacementNodes.push(listNode.type.create(
            trailingAttrs,
            trailingItems,
            listNode.marks,
        ));
    }

    const from = selection.$from.before(listDepth);
    const to = selection.$from.after(listDepth);
    const tr = state.tr.replaceWith(from, to, replacementNodes);
    tr.setMeta(clipboardPluginKey, true);

    const insertedEnd = Math.min(from + Fragment.fromArray(replacementNodes).size, tr.doc.content.size);
    const tailPos = findTailCursorPosInRange(tr.doc, from, insertedEnd) ?? insertedEnd;
    const safePos = Math.max(0, Math.min(tailPos, tr.doc.content.size));
    const $safePos = tr.doc.resolve(safePos);

    tr.setSelection(
        $safePos.parent.inlineContent
            ? TextSelection.create(tr.doc, safePos)
            : Selection.near($safePos, 1)
    );
    view.dispatch(tr.scrollIntoView());
    markEditorUserInput(view);
    return true;
}
