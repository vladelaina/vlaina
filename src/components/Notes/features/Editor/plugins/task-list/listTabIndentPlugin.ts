import { sinkListItem, liftListItem } from '@milkdown/kit/prose/schema-list';
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';

export const listTabIndentPluginKey = new PluginKey('listTabIndent');
const EDITABLE_LIST_GAP_PLACEHOLDER = '\u2800';
const LIST_GAP_PLACEHOLDER_CLASS = 'vlaina-list-gap-placeholder-item';

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
        props: {
            decorations(state) {
                return this.getState(state) ?? DecorationSet.empty;
            },
            handleKeyDown(view, event) {
                if (handleInternalPlaceholderListEnter(view, event)) return true;
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
