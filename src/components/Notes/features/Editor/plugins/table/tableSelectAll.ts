import * as proseState from '@milkdown/kit/prose/state';
import * as proseTables from '@milkdown/kit/prose/tables';
import type { EditorView } from '@milkdown/kit/prose/view';

const { TextSelection } = proseState;
const AllSelection = (
  proseState as typeof proseState & {
    AllSelection: (new (doc: unknown) => unknown) & {
      create?: (doc: unknown) => unknown;
    };
  }
).AllSelection;
const TableMap = (
  proseTables as typeof proseTables & {
    TableMap: {
      get: (node: unknown) => {
        width: number;
        height: number;
        cellsInRect: (rect: {
          left: number;
          right: number;
          top: number;
          bottom: number;
        }) => number[];
      };
    };
  }
).TableMap;
const findTable = (
  proseTables as typeof proseTables & {
    findTable: (anchor: unknown) => {
      node: { nodeSize: number };
      pos: number;
      start: number;
    } | null;
  }
).findTable;
const CellSelection = (
  proseTables as typeof proseTables & {
    CellSelection: new (
      anchorCell: { pos: number },
      headCell: { pos: number }
    ) => {
      $anchorCell: { pos: number };
      $headCell: { pos: number };
      isColSelection: () => boolean;
      isRowSelection: () => boolean;
    };
  }
).CellSelection;

type TableContext = {
  pos: number;
  node: { nodeSize: number; type: { name: string } };
};

type TextSelectionLike = {
  from: number;
  to: number;
  $from: {
    parent: { isTextblock: boolean };
    start: () => number;
    end: () => number;
  };
  $to: {
    parent: unknown;
  };
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
  selection: TextSelectionLike
): { from: number; to: number } | null {
  const { $from, $to } = selection;
  if (!$from.parent.isTextblock || $from.parent !== $to.parent) return null;

  return {
    from: $from.start(),
    to: $from.end(),
  };
}

function getTableContext(view: EditorView): TableContext | null {
  const selectionWithAnchor = view.state.selection as unknown as {
    $from: {
      depth: number;
      node: (depth: number) => { type: { name: string }; nodeSize: number };
      before: (depth: number) => number;
    };
    $anchorCell?: {
      depth: number;
      node: (depth: number) => { type: { name: string }; nodeSize: number };
      before: (depth: number) => number;
    };
  };
  const $from =
    selectionWithAnchor.$anchorCell &&
    'depth' in selectionWithAnchor.$anchorCell
      ? selectionWithAnchor.$anchorCell
      : selectionWithAnchor.$from;

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
  selection: TextSelectionLike,
  range: { from: number; to: number }
): boolean {
  return selection.from === range.from && selection.to === range.to;
}

function createAllSelection(doc: unknown) {
  if (typeof AllSelection.create === 'function') {
    return AllSelection.create(doc);
  }

  return new AllSelection(doc);
}

function normalizeTableSelectionVisualState(view: EditorView) {
  const editorRoot = view.dom;
  const doc = editorRoot.ownerDocument;
  const html = doc.documentElement;
  const body = doc.body;

  html.removeAttribute('data-table-resize-selection-lock');
  body?.removeAttribute('data-table-resize-selection-lock');
  html.removeAttribute('data-table-resize-cursor');
  body?.removeAttribute('data-table-resize-cursor');
  html.removeAttribute('data-table-resize-toolbar-suppress');
  body?.removeAttribute('data-table-resize-toolbar-suppress');
  doc.getElementById('milkdown-table-resize-overlay')?.remove();
}

function suppressNativeTextSelection(view: EditorView) {
  const editorRoot = view.dom;
  const selection = editorRoot.ownerDocument.getSelection();
  if (selection && selection.rangeCount > 0) {
    selection.removeAllRanges();
  }

  editorRoot.classList.add('ProseMirror-hideselection');
  requestAnimationFrame(() => {
    editorRoot.classList.remove('ProseMirror-hideselection');
  });
}

function createWholeTableSelection(selection: {
  $anchorCell?: { pos: number };
  $from: unknown;
}, doc: { resolve: (pos: number) => { pos: number } }): InstanceType<typeof CellSelection> | null {
  const anchor = selection.$anchorCell ?? selection.$from;
  const table = findTable(anchor as never);
  if (!table) return null;

  const map = TableMap.get(table.node);
  const cells = map.cellsInRect({
    left: 0,
    right: map.width,
    top: 0,
    bottom: map.height,
  });
  const firstCell = cells[0];
  const lastCell = cells[cells.length - 1];
  if (firstCell == null || lastCell == null) return null;

  return new CellSelection(
    doc.resolve(table.start + lastCell),
    doc.resolve(table.start + firstCell)
  ) as InstanceType<typeof CellSelection>;
}

function isWholeTableSelected(view: EditorView, table: TableContext): boolean {
  const { selection } = view.state;
  return (
    selection instanceof CellSelection &&
    selection.isColSelection() &&
    selection.isRowSelection() &&
    selection.$anchorCell.pos >= table.pos &&
    selection.$headCell.pos <= table.pos + table.node.nodeSize
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
    event.preventDefault();
    view.dispatch(tr.setSelection(createAllSelection(doc) as never));
    return true;
  }

  if (selection instanceof TextSelection) {
    const range = getCurrentTextBlockRange(selection);
    if (range && !isCurrentTextBlockFullySelected(selection, range)) {
      event.preventDefault();
      view.dispatch(tr.setSelection(TextSelection.create(doc, range.from, range.to)));
      return true;
    }
  }

  event.preventDefault();
  normalizeTableSelectionVisualState(view);
  const nextSelection = createWholeTableSelection(selection as never, doc as never);
  view.dispatch(nextSelection ? tr.setSelection(nextSelection as never) : tr);
  suppressNativeTextSelection(view);
  return true;
}
