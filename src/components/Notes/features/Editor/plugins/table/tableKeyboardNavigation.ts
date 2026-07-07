import { TextSelection } from '@milkdown/kit/prose/state';
import { Selection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';

import {
  MAX_PIPE_TABLE_SHORTCUT_TEXT_CHARS,
  shouldCreateTableFromPipeShortcut,
} from './pipeTableShortcut';
import {
  DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT,
  STOP_PROSE_SCAN,
  scanProseDescendants,
} from '../shared/boundedProseNodeScan';
import { type AdjacentTableParagraphDeleteRange } from './tableDeleteShortcut';

export const MAX_TABLE_KEYBOARD_DOC_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;

const TABLE_KEYDOWN_KEYS = new Set(['Backspace', 'Delete', 'Enter', 'Tab']);

export function isTableKeyboardShortcut(event: KeyboardEvent): boolean {
  if (event.isComposing) {
    return false;
  }

  return (
    TABLE_KEYDOWN_KEYS.has(event.key) ||
    (
      (event.metaKey || event.ctrlKey) &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === 'a'
    )
  );
}

export function resolveTableKeydownContext(selection: Selection) {
  const { $from } = selection;
  let depth = $from.depth;
  let inTable = false;
  let cellDepth: number | null = null;

  while (depth > 0) {
    const node = $from.node(depth);
    if (node.type.name === 'table_cell' || node.type.name === 'table_header') {
      inTable = true;
      cellDepth = depth;
      break;
    }
    depth -= 1;
  }

  return {
    inTable,
    cellDepth,
  };
}

export function shouldSuppressComposingPipeTableShortcut(
  state: EditorView['state'],
  event: KeyboardEvent,
): boolean {
  if (!event.isComposing || event.key !== 'Enter') {
    return false;
  }

  const { selection } = state;
  if (resolveTableKeydownContext(selection).inTable) {
    return false;
  }
  if (
    !(selection instanceof TextSelection) ||
    !selection.empty ||
    selection.$from.parent.type.name !== 'paragraph' ||
    selection.$from.parentOffset !== selection.$from.parent.content.size ||
    selection.$from.parent.content.size > MAX_PIPE_TABLE_SHORTCUT_TEXT_CHARS
  ) {
    return false;
  }

  const shortcutText = selection.$from.parent.textBetween(0, selection.$from.parent.content.size, '', '');
  return shouldCreateTableFromPipeShortcut(shortcutText);
}

export function dispatchDeleteRangeWithTextSelection(
  view: EditorView,
  from: number,
  to: number,
  anchorPos: number,
  searchDir: -1 | 1
) {
  const tr = view.state.tr.delete(from, to);
  const mappedAnchor = Math.max(0, Math.min(tr.mapping.map(anchorPos), tr.doc.content.size));
  const resolvedAnchor = tr.doc.resolve(mappedAnchor);
  const reverseSearchDir = searchDir === -1 ? 1 : -1;
  const nextSelection =
    Selection.findFrom(resolvedAnchor, searchDir, true) ??
    Selection.findFrom(resolvedAnchor, reverseSearchDir, true);

  view.dispatch((nextSelection ? tr.setSelection(nextSelection) : tr).scrollIntoView());
}

export function dispatchKeepHeadingGapTextSelection(
  view: EditorView,
  range: AdjacentTableParagraphDeleteRange
) {
  const heading = view.state.doc.nodeAt(range.blockFrom);
  const gap = view.state.doc.nodeAt(range.from);

  if (heading?.type.name !== 'heading' || gap?.type.name !== 'paragraph') {
    dispatchDeleteRangeWithTextSelection(view, range.from, range.to, range.blockFrom, range.searchDir);
    return;
  }

  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.create(view.state.doc, range.from + 1))
      .scrollIntoView()
  );
}

export function findFirstTableBodyCellPos(
  doc: EditorView['state']['doc'],
  tableFrom: number,
): number | null {
  let targetPos: number | null = null;

  scanProseDescendants(doc, (node, pos) => {
    if (pos < tableFrom) return true;
    if (node.type?.name !== 'table_cell') return true;

    targetPos = pos + 2;
    return STOP_PROSE_SCAN;
  }, MAX_TABLE_KEYBOARD_DOC_SCAN_NODES);

  return targetPos;
}

export function findFirstTableBodyCellSelection(
  doc: EditorView['state']['doc'],
  tableFrom: number,
) {
  const targetPos = findFirstTableBodyCellPos(doc, tableFrom);

  return targetPos === null ? null : TextSelection.create(doc, targetPos);
}

export function findAdjacentTableCellPos(
  table: EditorView['state']['doc'],
  tableStart: number,
  currentCellPos: number,
  direction: -1 | 1,
): number | null {
  let firstCellPos: number | null = null;
  let previousCellPos: number | null = null;
  let targetPos: number | null = null;
  let foundCurrent = false;

  const completed = scanProseDescendants(table, (node, pos) => {
    if (node.type?.name !== 'table_cell' && node.type?.name !== 'table_header') {
      return true;
    }

    const cellPos = tableStart + pos;
    firstCellPos ??= cellPos;

    if (direction < 0) {
      if (cellPos === currentCellPos) {
        targetPos = previousCellPos;
        return STOP_PROSE_SCAN;
      }
      previousCellPos = cellPos;
      return true;
    }

    if (foundCurrent) {
      targetPos = cellPos;
      return STOP_PROSE_SCAN;
    }
    if (cellPos === currentCellPos) {
      foundCurrent = true;
    }
    return true;
  }, MAX_TABLE_KEYBOARD_DOC_SCAN_NODES);

  if (direction > 0 && completed && !foundCurrent) {
    return firstCellPos;
  }
  return targetPos;
}
