import type { EditorView } from '@milkdown/kit/prose/view';

export function isSelectionInsideListItem(view: EditorView): boolean {
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

export function findSelectionListItemDepth(view: EditorView): number | null {
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
