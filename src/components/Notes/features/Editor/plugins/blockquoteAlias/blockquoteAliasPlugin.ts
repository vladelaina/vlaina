import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { wrapIn } from '@milkdown/kit/prose/commands';
import type { EditorView } from '@milkdown/kit/prose/view';

const FULL_WIDTH_BLOCKQUOTE_MARKER = '》';
const ORDERED_LIST_MARKER = /^(\d+)\.$/;

function applyOrderedListStart(view: EditorView, order: number) {
  const { state } = view;
  const { $from } = state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name !== 'ordered_list') {
      continue;
    }

    const pos = $from.before(depth);
    view.dispatch(
      state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        order,
      })
    );
    return true;
  }

  return false;
}

function tryHandleBlockAlias(view: EditorView): boolean {
  const { state } = view;
  const { selection, schema } = state;
  const { $from } = selection;
  const blockquoteType = schema.nodes.blockquote;
  const orderedListType = schema.nodes.ordered_list;

  if (!selection.empty || !$from.parent.isTextblock) {
    return false;
  }

  const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc');
  if (!textBeforeCursor) {
    return false;
  }

  if (blockquoteType && textBeforeCursor === FULL_WIDTH_BLOCKQUOTE_MARKER) {
    view.dispatch(state.tr.delete(selection.from - textBeforeCursor.length, selection.to));
    return wrapIn(blockquoteType)(view.state, view.dispatch);
  }

  if (!orderedListType) {
    return false;
  }

  const orderedListMatch = textBeforeCursor.match(ORDERED_LIST_MARKER);
  if (!orderedListMatch) {
    return false;
  }

  const order = Number.parseInt(orderedListMatch[1], 10);
  if (!Number.isFinite(order) || order <= 0) {
    return false;
  }

  view.dispatch(state.tr.delete(selection.from - textBeforeCursor.length, selection.to));
  const wrapped = wrapIn(orderedListType)(view.state, view.dispatch);
  if (!wrapped) {
    return false;
  }

  applyOrderedListStart(view, order);
  return true;
}

export const blockquoteAliasPlugin = $prose(() => {
  return new Plugin({
    key: new PluginKey('neko-block-alias'),
    props: {
      handleKeyDown(view, event) {
        if (event.key !== ' ' || event.ctrlKey || event.metaKey || event.altKey) {
          return false;
        }

        const handled = tryHandleBlockAlias(view);
        if (!handled) {
          return false;
        }

        event.preventDefault();
        return true;
      },
      handleTextInput(view, from, to, text) {
        if (text !== ' ') {
          return false;
        }
        return tryHandleBlockAlias(view);
      },
    },
  });
});

export const orderedListStartSyncPlugin = $prose(() => {
  return new Plugin({
    key: new PluginKey('neko-ordered-list-start-sync'),
    appendTransaction: (_transactions, _oldState, newState) => {
      const orderedListType = newState.schema.nodes.ordered_list;
      const listItemType = newState.schema.nodes.list_item;

      if (!orderedListType || !listItemType) {
        return null;
      }

      let tr = newState.tr;
      let changed = false;

      newState.doc.descendants((node, pos, parent, index) => {
        if (node.type !== listItemType || parent?.type !== orderedListType) {
          return;
        }

        const baseOrder = typeof parent.attrs.order === 'number' ? parent.attrs.order : 1;
        const expectedLabel = `${baseOrder + index}.`;
        if (node.attrs.label === expectedLabel && node.attrs.listType === 'ordered') {
          return;
        }

        tr = tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          label: expectedLabel,
          listType: 'ordered',
        });
        changed = true;
      });

      return changed ? tr.setMeta('addToHistory', false) : null;
    },
  });
});
