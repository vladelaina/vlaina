import { $prose } from '@milkdown/kit/utils';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';
import { Selection } from '@milkdown/kit/prose/state';
import { deleteRow } from '@milkdown/kit/prose/tables';
import type { EditorView } from '@milkdown/kit/prose/view';

import {
  createTableNodeFromPipeCells,
  getPipeShortcutCells,
} from './pipeTableShortcut';
import {
  STOP_PROSE_SCAN,
  scanProseDescendants,
} from '../shared/boundedProseNodeScan';
import {
  type AdjacentTableParagraphDeleteRange,
  findAdjacentHeadingParagraphDeleteRange,
  findAdjacentTableParagraphDeleteRange,
  findLeadingTableDeleteRange,
  shouldDeleteTrailingEmptyRowOnDelete,
} from './tableDeleteShortcut';
import { handleTableSelectAll } from './tableSelectAll';

function resolveTableKeydownContext(selection: Selection) {
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

function dispatchDeleteRangeWithTextSelection(
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

function dispatchDeleteRangeWithHeadingTextSelection(
  view: EditorView,
  range: AdjacentTableParagraphDeleteRange
) {
  const tr = view.state.tr.delete(range.from, range.to);
  const mappedHeadingFrom = tr.mapping.map(range.blockFrom, -1);
  const heading = tr.doc.nodeAt(mappedHeadingFrom);

  if (heading?.type.name !== 'heading') {
    dispatchDeleteRangeWithTextSelection(view, range.from, range.to, range.blockFrom, range.searchDir);
    return;
  }

  const cursorPos = range.searchDir < 0
    ? mappedHeadingFrom + 1 + heading.content.size
    : mappedHeadingFrom + 1;
  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, cursorPos)).scrollIntoView());
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
  }, Number.POSITIVE_INFINITY);

  return targetPos;
}

function findFirstTableBodyCellSelection(
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

  scanProseDescendants(table, (node, pos) => {
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
  }, Number.POSITIVE_INFINITY);

  if (direction > 0 && !foundCurrent) {
    return firstCellPos;
  }
  return targetPos;
}

export const tableKeyboardPlugin = $prose(() => {
  return new Plugin({
    props: {
      handleKeyDown(view, event) {
        const { state } = view;
        const { selection } = state;
        const { $from } = selection;
        const keydownContext = resolveTableKeydownContext(selection);
        if (handleTableSelectAll(view, event)) return true;

        if (
          event.key === 'Backspace' &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey
        ) {
          const adjacentParagraphDeleteRange = findAdjacentTableParagraphDeleteRange(state, -1);
          if (adjacentParagraphDeleteRange) {
            event.preventDefault();
            const headingRange = findAdjacentHeadingParagraphDeleteRange(state, 1);
            if (headingRange) {
              dispatchDeleteRangeWithHeadingTextSelection(view, headingRange);
              view.focus();
              return true;
            }
            dispatchDeleteRangeWithTextSelection(
              view,
              adjacentParagraphDeleteRange.from,
              adjacentParagraphDeleteRange.to,
              adjacentParagraphDeleteRange.from - 1,
              adjacentParagraphDeleteRange.searchDir
            );
            view.focus();
            return true;
          }

          const deleteRange = findLeadingTableDeleteRange(state);
          if (!deleteRange) {
            if (!shouldDeleteTrailingEmptyRowOnDelete(state)) return false;

            event.preventDefault();
            const anchorPos = selection.$from.pos;
            const handled = deleteRow(state, (tr) => {
              const mappedAnchor = Math.max(
                0,
                Math.min(tr.mapping.map(anchorPos), tr.doc.content.size)
              );
              const resolvedAnchor = tr.doc.resolve(mappedAnchor);
              const nextSelection =
                Selection.findFrom(resolvedAnchor, -1, true) ??
                Selection.findFrom(resolvedAnchor, 1, true);

              view.dispatch(
                (nextSelection ? tr.setSelection(nextSelection) : tr).scrollIntoView()
              );
            });
            if (handled) {
              view.focus();
              return true;
            }

            return false;
          }

          event.preventDefault();
          const paragraphType = state.schema.nodes.paragraph;
          let tr =
            paragraphType
              ? state.tr.replaceWith(deleteRange.from, deleteRange.to, paragraphType.create())
              : state.tr.delete(deleteRange.from, deleteRange.to);

          if (tr.doc.content.size === 0 && paragraphType) {
            tr = tr.insert(0, paragraphType.create());
          }

          const anchorPos = Math.max(
            0,
            Math.min(deleteRange.from + 1, tr.doc.content.size)
          );
          const resolvedAnchor = tr.doc.resolve(anchorPos);
          const nextSelection =
            Selection.findFrom(resolvedAnchor, 1, true) ??
            Selection.findFrom(resolvedAnchor, -1, true);

          view.dispatch((nextSelection ? tr.setSelection(nextSelection) : tr).scrollIntoView());
          view.focus();
          return true;
        }

        if (
          event.key === 'Delete' &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey
        ) {
          const adjacentParagraphDeleteRange = findAdjacentTableParagraphDeleteRange(state, 1);
          if (adjacentParagraphDeleteRange) {
            event.preventDefault();
            const headingRange = findAdjacentHeadingParagraphDeleteRange(state, -1);
            if (headingRange) {
              dispatchDeleteRangeWithHeadingTextSelection(view, headingRange);
              view.focus();
              return true;
            }
            dispatchDeleteRangeWithTextSelection(
              view,
              adjacentParagraphDeleteRange.from,
              adjacentParagraphDeleteRange.to,
              adjacentParagraphDeleteRange.from,
              adjacentParagraphDeleteRange.searchDir
            );
            view.focus();
            return true;
          }

          if (!shouldDeleteTrailingEmptyRowOnDelete(state)) return false;

          event.preventDefault();
          const anchorPos = selection.$from.pos;
          const handled = deleteRow(state, (tr) => {
            const mappedAnchor = Math.max(
              0,
              Math.min(tr.mapping.map(anchorPos), tr.doc.content.size)
            );
            const resolvedAnchor = tr.doc.resolve(mappedAnchor);
            const nextSelection =
              Selection.findFrom(resolvedAnchor, -1, true) ??
              Selection.findFrom(resolvedAnchor, 1, true);

            view.dispatch(
              (nextSelection ? tr.setSelection(nextSelection) : tr).scrollIntoView()
            );
          });
          if (handled) {
            view.focus();
            return true;
          }
        }

        if (
          event.key === 'Enter' &&
          selection instanceof TextSelection &&
          selection.empty &&
          $from.parent.type.name === 'paragraph' &&
          $from.parentOffset === $from.parent.content.size
        ) {
          const cells = getPipeShortcutCells($from.parent.textContent);
          if (cells && cells.filter((cell) => cell.length > 0).length >= 2) {
            const tableNode = createTableNodeFromPipeCells(state.schema, cells);
            if (tableNode && $from.depth >= 1) {
              const parent = $from.node($from.depth - 1);
              if (
                parent.canReplaceWith(
                  $from.index($from.depth - 1),
                  $from.indexAfter($from.depth - 1),
                  tableNode.type
                )
              ) {
                event.preventDefault();
                const from = $from.before($from.depth);
                const to = $from.after($from.depth);
                const tr = state.tr.replaceRangeWith(from, to, tableNode);
                const nextSelection = findFirstTableBodyCellSelection(tr.doc, from);
                view.dispatch(
                  (nextSelection ? tr.setSelection(nextSelection) : tr).scrollIntoView()
                );
                return true;
              }
            }
          }
        }

        let depth = keydownContext.cellDepth ?? $from.depth;
        const inTable = keydownContext.inTable;

        if (!inTable) return false;

        if (event.key === 'Tab') {
          event.preventDefault();

          const { doc } = state;
          const cellPos = $from.before(depth);
          const cell = doc.nodeAt(cellPos);

          if (!cell) return false;

          const tableStart = $from.start(depth - 2);
          const table = doc.nodeAt(tableStart - 1);

          if (!table) return false;

          const targetPos = findAdjacentTableCellPos(
            table,
            tableStart,
            cellPos,
            event.shiftKey ? -1 : 1,
          );

          if (targetPos !== null) {
            const $target = doc.resolve(targetPos + 1);
            const newSelection = Selection.near($target);
            view.dispatch(state.tr.setSelection(newSelection));
          }

          return true;
        }

        return false;
      },
    },
  });
});
