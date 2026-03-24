import { lift, setBlockType, wrapIn } from '@milkdown/kit/prose/commands';
import type { EditorView } from '@milkdown/kit/prose/view';

type ListConversionOptions = { checked?: boolean | null };
type NormalizeToParagraphOptions = { unwrapListItem?: boolean };

function isDirectChildOfBlockquote(view: EditorView): boolean {
  const { $from } = view.state.selection;
  if ($from.depth < 1) {
    return false;
  }

  return $from.node($from.depth - 1)?.type.name === 'blockquote';
}

function getAncestorEntry(view: EditorView, predicate: (node: any) => boolean) {
  const { $from } = view.state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (!predicate(node)) {
      continue;
    }

    return {
      node,
      pos: $from.before(depth),
    };
  }

  return null;
}

function isInsideListItem(view: EditorView): boolean {
  return Boolean(getAncestorEntry(view, (node) => node.type.name === 'list_item'));
}

export function convertToTextBlock(
  view: EditorView,
  nodeType: any,
  attrs?: object
): void {
  const applyBlockType = () => setBlockType(nodeType, attrs)(view.state, view.dispatch);

  if (isDirectChildOfBlockquote(view)) {
    const unwrapped = lift(view.state, view.dispatch);
    if (!unwrapped) {
      return;
    }
  }

  if (isInsideListItem(view)) {
    const unwrapped = lift(view.state, view.dispatch);
    if (!unwrapped) {
      return;
    }
  }

  applyBlockType();
}

export function normalizeCurrentBlockToParagraph(
  view: EditorView,
  options?: NormalizeToParagraphOptions
): boolean {
  const paragraphType = view.state.schema.nodes.paragraph;
  if (!paragraphType) {
    return false;
  }

  if (isDirectChildOfBlockquote(view)) {
    const unwrapped = lift(view.state, view.dispatch);
    if (!unwrapped) {
      return false;
    }
  }

  if (options?.unwrapListItem && isInsideListItem(view)) {
    const unwrapped = lift(view.state, view.dispatch);
    if (!unwrapped) {
      return false;
    }
  }

  const { parent } = view.state.selection.$from;
  if (parent.type.name === 'paragraph') {
    return true;
  }

  return setBlockType(paragraphType)(view.state, view.dispatch);
}

function setCurrentListItemChecked(view: EditorView, checked: boolean | null): boolean {
  const listItemEntry = getAncestorEntry(view, (node) => node.type.name === 'list_item');
  if (!listItemEntry) {
    return false;
  }

  view.dispatch(
    view.state.tr.setNodeMarkup(listItemEntry.pos, undefined, {
      ...listItemEntry.node.attrs,
      checked,
    })
  );
  return true;
}

function getListAttrsForType(typeName: string, attrs: Record<string, unknown>) {
  if (typeName === 'ordered_list') {
    return {
      order: typeof attrs.order === 'number' ? attrs.order : 1,
      spread: attrs.spread ?? false,
    };
  }

  return {
    spread: attrs.spread ?? false,
  };
}

function getListItemAttrsForListType(
  listTypeName: string,
  attrs: Record<string, unknown>,
  checked: boolean | null | undefined
) {
  if (listTypeName === 'ordered_list') {
    return {
      ...attrs,
      listType: 'ordered',
      label: typeof attrs.label === 'string' && /^\d+\.$/.test(attrs.label) ? attrs.label : '1.',
      checked,
    };
  }

  return {
    ...attrs,
    listType: 'bullet',
    label: '•',
    checked,
  };
}

export function convertToList(
  view: EditorView,
  listNodeType: any,
  options?: ListConversionOptions
): void {
  const listItemEntry = getAncestorEntry(view, (node) => node.type.name === 'list_item');
  const listContainerEntry = getAncestorEntry(
    view,
    (node) => node.type.name === 'bullet_list' || node.type.name === 'ordered_list'
  );

  if (listItemEntry && listContainerEntry) {
    const tr = view.state.tr;
    let changed = false;

    if (listContainerEntry.node.type.name !== listNodeType.name) {
      tr.setNodeMarkup(
        listContainerEntry.pos,
        listNodeType,
        getListAttrsForType(listNodeType.name, listContainerEntry.node.attrs)
      );
      changed = true;
    }

    const nextChecked =
      options && 'checked' in options
        ? (options.checked ?? null)
        : (listItemEntry.node.attrs.checked != null ? null : listItemEntry.node.attrs.checked);

    const nextListItemAttrs = getListItemAttrsForListType(
      listNodeType.name,
      listItemEntry.node.attrs,
      nextChecked
    );

    if (
      listItemEntry.node.attrs.checked !== nextChecked ||
      listItemEntry.node.attrs.listType !== nextListItemAttrs.listType ||
      listItemEntry.node.attrs.label !== nextListItemAttrs.label
    ) {
      tr.setNodeMarkup(listItemEntry.pos, undefined, nextListItemAttrs);
      changed = true;
    }

    if (changed) {
      view.dispatch(tr);
    }
    return;
  }

  if (!normalizeCurrentBlockToParagraph(view)) {
    return;
  }

  const wrapped = wrapIn(listNodeType)(view.state, view.dispatch);
  if (!wrapped) {
    return;
  }

  if (options && 'checked' in options) {
    setCurrentListItemChecked(view, options.checked ?? null);
  }
}
