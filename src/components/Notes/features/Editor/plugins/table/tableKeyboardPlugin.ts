import { $prose } from '@milkdown/kit/utils';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';
import { Selection } from '@milkdown/kit/prose/state';
import { deleteRow } from '@milkdown/kit/prose/tables';
import type { EditorView } from '@milkdown/kit/prose/view';

import { createEmptyTableNode, getPipeShortcutColumnCount } from './pipeTableShortcut';
import {
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
          const columnCount = getPipeShortcutColumnCount($from.parent.textContent);
          if (columnCount) {
            const tableNode = createEmptyTableNode(state.schema, columnCount);
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
                const nextSelection = Selection.findFrom(tr.doc.resolve(from + 1), 1, true);
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

          let targetPos: number | null = null;
          const cells: number[] = [];

          table.descendants((node, pos) => {
            if (node.type.name === 'table_cell' || node.type.name === 'table_header') {
              cells.push(tableStart + pos);
            }
            return true;
          });

          const currentIndex = cells.indexOf(cellPos);

          if (event.shiftKey) {
            if (currentIndex > 0) {
              targetPos = cells[currentIndex - 1];
            }
          } else if (currentIndex < cells.length - 1) {
            targetPos = cells[currentIndex + 1];
          }

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
