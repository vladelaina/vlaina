import { sinkListItem, liftListItem } from '@milkdown/kit/prose/schema-list';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';

export const listTabIndentPluginKey = new PluginKey('listTabIndent');

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

export const listTabIndentPlugin = $prose(() => {
    return new Plugin({
        key: listTabIndentPluginKey,
        props: {
            handleKeyDown(view, event) {
                if (event.key !== 'Tab') return false;
                if (event.metaKey || event.ctrlKey || event.altKey) return false;
                if (!isSelectionInsideListItem(view)) return false;

                const listItemType = view.state.schema.nodes.list_item;
                if (!listItemType) return false;

                event.preventDefault();

                const command = event.shiftKey
                    ? liftListItem(listItemType)
                    : sinkListItem(listItemType);
                command(view.state, view.dispatch);
                return true;
            },
        },
    });
});
