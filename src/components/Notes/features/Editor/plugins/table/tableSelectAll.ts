import { NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';

type TableContext = {
  pos: number;
  node: { nodeSize: number };
};

function isSelectAllShortcut(event: KeyboardEvent): boolean {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === 'a'
  );
}

function getCurrentTextBlockRange(
  selection: TextSelection
): { from: number; to: number } | null {
  const { $from, $to } = selection;
  if (!$from.parent.isTextblock || $from.parent !== $to.parent) return null;

  return {
    from: $from.start(),
    to: $from.end(),
  };
}

function getTableContext(view: EditorView): TableContext | null {
  const { $from } = view.state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name !== 'table') continue;

    return {
      pos: $from.before(depth),
      node,
    };
  }

  return null;
}

function isCurrentTextBlockFullySelected(
  selection: TextSelection,
  range: { from: number; to: number }
): boolean {
  return selection.from === range.from && selection.to === range.to;
}

function isWholeTableSelected(view: EditorView, table: TableContext): boolean {
  const { selection } = view.state;
  return (
    selection instanceof NodeSelection &&
    selection.from === table.pos &&
    selection.to === table.pos + table.node.nodeSize
  );
}

export function handleTableSelectAll(
  view: EditorView,
  event: KeyboardEvent
): boolean {
  if (!isSelectAllShortcut(event)) return false;

  const table = getTableContext(view);
  if (!table) return false;

  const { selection, tr, doc } = view.state;

  if (isWholeTableSelected(view, table)) {
    return false;
  }

  if (selection instanceof TextSelection) {
    const range = getCurrentTextBlockRange(selection);
    if (range && !isCurrentTextBlockFullySelected(selection, range)) {
      event.preventDefault();
      view.dispatch(
        tr.setSelection(TextSelection.create(doc, range.from, range.to)).scrollIntoView()
      );
      return true;
    }
  }

  event.preventDefault();
  view.dispatch(
    tr.setSelection(NodeSelection.create(doc, table.pos)).scrollIntoView()
  );
  return true;
}
