import { $prose } from '@milkdown/kit/utils';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';
import { Selection } from '@milkdown/kit/prose/state';
import { deleteRow } from '@milkdown/kit/prose/tables';
import type { EditorView } from '@milkdown/kit/prose/view';

import {
  createTableNodeFromPipeCells,
  getPipeShortcutCells,
  MAX_PIPE_TABLE_SHORTCUT_TEXT_CHARS,
  shouldCreateTableFromPipeShortcut,
} from './pipeTableShortcut';
import {
  findAdjacentHeadingParagraphDeleteRange,
  findAdjacentTableParagraphDeleteRange,
  findLeadingTableDeleteRange,
  shouldDeleteTrailingEmptyRowOnDelete,
} from './tableDeleteShortcut';
import { handleTableSelectAll } from './tableSelectAll';
import {
  dispatchDeleteRangeWithTextSelection,
  dispatchKeepHeadingGapTextSelection,
  findAdjacentTableCellPos,
  findFirstTableBodyCellSelection,
  isTableKeyboardShortcut,
  resolveTableKeydownContext,
  shouldSuppressComposingPipeTableShortcut,
} from './tableKeyboardNavigation';

export {
  MAX_TABLE_KEYBOARD_DOC_SCAN_NODES,
  findAdjacentTableCellPos,
  findFirstTableBodyCellPos,
} from './tableKeyboardNavigation';

export const tableKeyboardPlugin = $prose(() => {
  return new Plugin({
    props: {
      handleKeyDown(view, event) {
        if (!view.editable) {
          return false;
        }

        if (shouldSuppressComposingPipeTableShortcut(view.state, event)) {
          return true;
        }

        if (!isTableKeyboardShortcut(event)) {
          return false;
        }

        const { state } = view;
        const { selection } = state;
        const { $from } = selection;
        if (handleTableSelectAll(view, event)) return true;
        const keydownContext = resolveTableKeydownContext(selection);

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
              dispatchKeepHeadingGapTextSelection(view, headingRange);
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
              dispatchKeepHeadingGapTextSelection(view, headingRange);
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
          !keydownContext.inTable &&
          selection instanceof TextSelection &&
          selection.empty &&
          $from.parent.type.name === 'paragraph' &&
          $from.parentOffset === $from.parent.content.size
        ) {
          if ($from.parent.content.size > MAX_PIPE_TABLE_SHORTCUT_TEXT_CHARS) {
            return false;
          }

          const shortcutText = $from.parent.textBetween(0, $from.parent.content.size, '', '');
          if (!shouldCreateTableFromPipeShortcut(shortcutText)) {
            return false;
          }

          const cells = getPipeShortcutCells(shortcutText);
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
