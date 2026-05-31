import { $prose } from '@milkdown/kit/utils';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { addRowAfter, deleteRow } from '@milkdown/kit/prose/tables';
import { sinkListItem, liftListItem } from '@milkdown/kit/prose/schema-list';

import { convertBlockType } from './floating-toolbar/blockCommands';
import type { BlockType } from './floating-toolbar';
import { toggleMark } from './floating-toolbar/markCommands';
import { createEmptyTableNode } from './table/pipeTableShortcut';
import { mathEditorPluginKey } from './math/mathEditorPluginKey';
import { createOpenMathEditorState } from './math/mathEditorState';
import { markEditorUserInput } from './shared/userInputEvents';

function isModShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && !event.isComposing;
}

function keyIs(event: KeyboardEvent, ...keys: string[]): boolean {
  const key = event.key.toLowerCase();
  return keys.some((candidate) => key === candidate.toLowerCase());
}

function handled(event: KeyboardEvent, run: () => boolean | void): boolean {
  event.preventDefault();
  event.stopPropagation();
  run();
  return true;
}

function insertTable(view: EditorView): boolean {
  const tableNode = createEmptyTableNode(view.state.schema, 3);
  if (!tableNode) return false;

  const { state } = view;
  const { from, to } = state.selection;
  const tr = state.tr.replaceRangeWith(from, to, tableNode).scrollIntoView();
  const insertFrom = tr.mapping.map(from);
  const nextSelection = findFirstTableCellSelection(tr.doc, insertFrom);
  markEditorUserInput(view);
  view.dispatch(nextSelection ? tr.setSelection(nextSelection) : tr);
  view.focus();
  return true;
}

function findFirstTableCellSelection(doc: EditorState['doc'], from: number): TextSelection | null {
  let targetPos: number | null = null;

  doc.descendants((node, pos) => {
    if (targetPos !== null) return false;
    if (pos < from) return true;
    if (node.type.name !== 'table_cell' && node.type.name !== 'table_header') return true;
    targetPos = pos + 2;
    return false;
  });

  return targetPos === null ? null : TextSelection.create(doc, targetPos);
}

function runTableCommand(
  view: EditorView,
  command: typeof addRowAfter | typeof deleteRow,
): boolean {
  const handledCommand = command(view.state, view.dispatch);
  if (handledCommand) {
    markEditorUserInput(view);
    view.focus();
  }
  return handledCommand;
}

function createMathBlock(view: EditorView): boolean {
  const { state } = view;
  const mathBlockType = state.schema.nodes.math_block;
  if (!mathBlockType) return false;

  const { from, to } = state.selection;
  const latex = state.selection.empty ? '' : state.doc.textBetween(from, to, '\n', '\n');
  const tr = state.tr
    .replaceRangeWith(from, to, mathBlockType.create({ latex }))
    .setMeta(
      mathEditorPluginKey,
      createOpenMathEditorState({
        latex,
        displayMode: true,
        position: getViewportPosition(view),
        nodePos: from,
        openSource: 'new-empty-block',
      })
    )
    .scrollIntoView();

  markEditorUserInput(view);
  view.dispatch(tr);
  view.focus();
  return true;
}

function getViewportPosition(view: EditorView) {
  try {
    const coords = view.coordsAtPos(view.state.selection.from);
    return { x: coords.left, y: coords.bottom + 8 };
  } catch {
    return { x: 16, y: 16 };
  }
}

function changeHeadingLevel(view: EditorView, delta: -1 | 1): boolean {
  const { $from } = view.state.selection;
  const parent = $from.parent;
  const currentLevel = parent.type.name === 'heading' ? Number(parent.attrs.level) : 0;
  if (!Number.isInteger(currentLevel)) return false;

  const nextLevel = Math.max(0, Math.min(6, currentLevel + delta));
  convertBlockType(view, nextLevel === 0 ? 'paragraph' : (`heading${nextLevel}` as BlockType));
  return true;
}

function setListIndent(view: EditorView, direction: 'in' | 'out'): boolean {
  const listItemType = view.state.schema.nodes.list_item;
  if (!listItemType) return false;

  const command = direction === 'in' ? sinkListItem(listItemType) : liftListItem(listItemType);
  const handledCommand = command(view.state, view.dispatch);
  if (handledCommand) {
    markEditorUserInput(view);
    view.focus();
  }
  return handledCommand;
}

function clearFormatting(view: EditorView): boolean {
  const { state, dispatch } = view;
  const { from, to, empty } = state.selection;
  const tr = state.tr;

  if (empty) {
    Object.values(state.schema.marks).forEach((markType) => tr.removeStoredMark(markType));
  } else {
    Object.values(state.schema.marks).forEach((markType) => tr.removeMark(from, to, markType));
  }

  markEditorUserInput(view);
  dispatch(tr);
  view.focus();
  return true;
}

export const editorShortcutsPlugin = $prose(() => {
  return new Plugin({
    props: {
      handleKeyDown: handleEditorShortcut,
    },
  });
});

export function handleEditorShortcut(view: EditorView, event: KeyboardEvent): boolean {
  if (!isModShortcut(event)) return false;

  if (!event.shiftKey) {
    if (/^[0-6]$/.test(event.key)) {
      return handled(event, () => {
        const level = Number(event.key);
        convertBlockType(view, level === 0 ? 'paragraph' : (`heading${level}` as BlockType));
      });
    }

    if (keyIs(event, '=')) return handled(event, () => changeHeadingLevel(view, -1));
    if (keyIs(event, '-')) return handled(event, () => changeHeadingLevel(view, 1));
    if (keyIs(event, 't')) return handled(event, () => insertTable(view));
    if (keyIs(event, 'enter')) return handled(event, () => runTableCommand(view, addRowAfter));
    if (keyIs(event, ']')) return handled(event, () => setListIndent(view, 'in'));
    if (keyIs(event, '[')) return handled(event, () => setListIndent(view, 'out'));
    if (keyIs(event, '\\')) return handled(event, () => clearFormatting(view));
  }

  if (event.shiftKey) {
    if (keyIs(event, 'backspace')) return handled(event, () => runTableCommand(view, deleteRow));
    if (keyIs(event, 'k')) return handled(event, () => convertBlockType(view, 'codeBlock'));
    if (keyIs(event, 'm')) return handled(event, () => createMathBlock(view));
    if (keyIs(event, '[', '{')) return handled(event, () => convertBlockType(view, 'orderedList'));
    if (keyIs(event, ']', '}')) return handled(event, () => convertBlockType(view, 'bulletList'));
    if (keyIs(event, '5', '%')) return handled(event, () => toggleMark(view, 'strike_through'));
    if (keyIs(event, '`', '~')) return handled(event, () => toggleMark(view, 'inlineCode'));
  }

  return false;
}
