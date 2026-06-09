import { lift, setBlockType, wrapIn } from '@milkdown/kit/prose/commands';
import type { EditorView } from '@milkdown/kit/prose/view';
import { DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT } from '../shared/boundedProseNodeScan';

type ListConversionOptions = { checked?: boolean | null };
type NormalizeToParagraphOptions = { unwrapListItem?: boolean };
export const MAX_LIST_CONVERSION_SELECTION_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
export const MAX_LIST_CONVERSION_SELECTED_ITEMS = 5_000;

type TraversableNode = {
  attrs?: Record<string, unknown>;
  child?: (index: number) => TraversableNode;
  childCount?: number;
  nodeSize?: number;
  type?: { name: string };
};

function isTraversableNode(value: unknown): value is TraversableNode {
  const node = value as TraversableNode | null | undefined;
  return typeof node?.child === 'function' && typeof node.childCount === 'number';
}

function getNodeSize(node: TraversableNode): number {
  return typeof node.nodeSize === 'number' && Number.isFinite(node.nodeSize) && node.nodeSize > 0
    ? Math.floor(node.nodeSize)
    : 1;
}

function forEachBoundedSelectedNode(
  doc: unknown,
  from: number,
  to: number,
  visit: (node: TraversableNode, pos: number) => boolean | void,
  maxScanNodes = MAX_LIST_CONVERSION_SELECTION_SCAN_NODES
) {
  if (!isTraversableNode(doc)) {
    let scanned = 0;
    (doc as { nodesBetween?: (...args: any[]) => void }).nodesBetween?.(from, to, (node: TraversableNode, pos: number) => {
      if (scanned >= maxScanNodes) return false;
      scanned += 1;
      return visit(node, pos);
    });
    return;
  }

  let scanned = 0;
  const stack: Array<{
    contentStart: number;
    index: number;
    node: TraversableNode;
    offset: number;
  }> = [{
    contentStart: 0,
    index: 0,
    node: doc,
    offset: 0,
  }];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.index >= (frame.node.childCount ?? 0)) {
      stack.pop();
      continue;
    }
    if (scanned >= maxScanNodes) {
      return;
    }

    const node = frame.node.child!(frame.index);
    const pos = frame.contentStart + frame.offset;
    const nodeSize = getNodeSize(node);
    frame.index += 1;
    frame.offset += nodeSize;

    if (pos >= to) {
      frame.index = frame.node.childCount ?? frame.index;
      continue;
    }
    if (pos + nodeSize <= from) {
      continue;
    }

    scanned += 1;
    const shouldDescend = visit(node, pos);
    if (shouldDescend === false || !isTraversableNode(node) || (node.childCount ?? 0) === 0) {
      continue;
    }

    stack.push({
      contentStart: pos + 1,
      index: 0,
      node,
      offset: 0,
    });
  }
}

function isDirectChildOfBlockquote(view: EditorView): boolean {
  const { $from } = view.state.selection;
  if ($from.depth < 1) {
    return false;
  }

  return $from.node($from.depth - 1)?.type.name === 'blockquote';
}

function getAncestorEntry(view: EditorView, predicate: (node: any) => boolean) {
  const { $from } = view.state.selection;
  return getAncestorEntryAt($from, predicate);
}

function getAncestorEntryAt(
  $pos: EditorView['state']['selection']['$from'] | undefined,
  predicate: (node: any) => boolean
) {
  if (!$pos || typeof $pos.depth !== 'number' || typeof $pos.node !== 'function') {
    return null;
  }

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (!predicate(node)) {
      continue;
    }

    return {
      node,
      pos: $pos.before(depth),
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

function collectSelectedListItems(
  view: EditorView
): Array<{ node: { type: { name: string }; attrs: Record<string, unknown> }; pos: number }> {
  const { state } = view;
  const selection = state.selection;
  const targets = new Map<number, { node: { type: { name: string }; attrs: Record<string, unknown> }; pos: number }>();

  const register = (entry: { node: { type: { name: string }; attrs?: Record<string, unknown> }; pos: number } | null) => {
    if (!entry || entry.node.type.name !== 'list_item' || targets.has(entry.pos)) {
      return;
    }

    targets.set(entry.pos, {
      node: {
        ...entry.node,
        attrs: entry.node.attrs ?? {},
      },
      pos: entry.pos,
    });
  };

  register(getAncestorEntryAt(selection.$from, (node) => node.type.name === 'list_item'));
  register(getAncestorEntryAt('$to' in selection ? selection.$to : undefined, (node) => node.type.name === 'list_item'));

  if (!selection.empty && state.doc) {
    forEachBoundedSelectedNode(state.doc, selection.from, selection.to, (node, pos) => {
      if (targets.size >= MAX_LIST_CONVERSION_SELECTED_ITEMS) {
        return false;
      }
      if (node.type?.name !== 'list_item') {
        return;
      }

      register({ node, pos });
      return false;
    });
  }

  return Array.from(targets.values()).sort((a, b) => a.pos - b.pos);
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

    for (const selectedItem of collectSelectedListItems(view)) {
      const selectedNextChecked =
        options && 'checked' in options
          ? (options.checked ?? null)
          : (selectedItem.node.attrs.checked != null ? null : selectedItem.node.attrs.checked);
      const nextListItemAttrs = getListItemAttrsForListType(
        listNodeType.name,
        selectedItem.node.attrs,
        selectedNextChecked
      );

      if (
        selectedItem.node.attrs.checked !== selectedNextChecked ||
        selectedItem.node.attrs.listType !== nextListItemAttrs.listType ||
        selectedItem.node.attrs.label !== nextListItemAttrs.label
      ) {
        tr.setNodeMarkup(selectedItem.pos, undefined, nextListItemAttrs);
        changed = true;
      }
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
