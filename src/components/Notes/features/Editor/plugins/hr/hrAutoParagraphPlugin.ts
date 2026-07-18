import { $prose } from '@milkdown/kit/utils';
import {
  NodeSelection,
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
} from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { focusNoteTitleInputAtEnd } from '../../utils/titleInputDom';
import {
  resolveHorizontalRuleNodePos,
  selectHorizontalRuleBlock,
} from './hrBlockSelection';
import { handleMarkdownBlockShortcutEnter } from './hrShortcutEnter';

export { handleHorizontalRuleShortcutEnter } from './hrShortcutEnter';

export const hrAutoParagraphPluginKey = new PluginKey('hrAutoParagraph');

function isArrowUpSkipHrScenario(view: EditorView): boolean {
  const { state } = view;
  const { selection } = state;
  if (!selection.empty) return false;
  if (selection.$from.depth !== 1) return false;
  if (selection.$from.parentOffset !== 0) return false;
  if (!selection.$from.parent.isTextblock) return false;

  if (typeof view.endOfTextblock === 'function' && !view.endOfTextblock('up')) {
    return false;
  }

  const indexAtRoot = selection.$from.index(0);
  if (indexAtRoot <= 0) return false;

  return state.doc.child(indexAtRoot - 1)?.type === state.schema.nodes.hr;
}

function skipHorizontalRuleOnArrowUp(view: EditorView): boolean {
  if (!isArrowUpSkipHrScenario(view)) return false;

  const { state } = view;
  const indexAtRoot = state.selection.$from.index(0);
  const hrPos = state.selection.$from.posAtIndex(indexAtRoot - 1, 0);
  const targetSelection = Selection.findFrom(state.doc.resolve(hrPos), -1, false);
  if (!targetSelection) return focusNoteTitleInputAtEnd();
  if (targetSelection instanceof NodeSelection && targetSelection.node.type === state.schema.nodes.hr) {
    return focusNoteTitleInputAtEnd();
  }

  view.dispatch(state.tr.setSelection(targetSelection).scrollIntoView());
  return true;
}

function isArrowDownSkipHrScenario(view: EditorView): boolean {
  const { state } = view;
  const { selection } = state;
  if (!selection.empty) return false;
  if (selection.$from.depth !== 1) return false;
  if (!selection.$from.parent.isTextblock) return false;

  if (typeof view.endOfTextblock === 'function' && !view.endOfTextblock('down')) {
    return false;
  }

  const indexAtRoot = selection.$from.index(0);
  if (indexAtRoot >= state.doc.childCount - 1) return false;

  return state.doc.child(indexAtRoot + 1)?.type === state.schema.nodes.hr;
}

function skipHorizontalRuleOnArrowDown(view: EditorView): boolean {
  if (!isArrowDownSkipHrScenario(view)) return false;

  const { state } = view;
  const indexAtRoot = state.selection.$from.index(0);
  const hrNode = state.doc.child(indexAtRoot + 1);
  const hrPos = state.selection.$from.posAtIndex(indexAtRoot + 1, 0);
  const afterHrPos = hrPos + hrNode.nodeSize;
  const targetSelection = Selection.findFrom(state.doc.resolve(afterHrPos), 1, false);
  if (!targetSelection) return false;
  if (targetSelection instanceof NodeSelection && targetSelection.node.type === state.schema.nodes.hr) {
    return false;
  }

  view.dispatch(state.tr.setSelection(targetSelection).scrollIntoView());
  return true;
}

function findTextSelectionFromBoundary(
  doc: EditorView['state']['doc'],
  pos: number,
  direction: -1 | 1
): TextSelection | null {
  const selection = Selection.findFrom(
    doc.resolve(Math.max(0, Math.min(pos, doc.content.size))),
    direction,
    true
  );
  return selection instanceof TextSelection ? selection : null;
}

function deleteAdjacentHorizontalRule(view: EditorView, key: string): boolean {
  const { state } = view;
  const { selection } = state;
  if (!selection.empty) return false;
  if (selection.$from.depth !== 1) return false;
  if (!selection.$from.parent.isTextblock) return false;

  const isBackwardDelete = key === 'Backspace' || key === 'Delete';
  const isForwardDelete = key === 'Delete';
  if (!isBackwardDelete && !isForwardDelete) return false;

  const indexAtRoot = selection.$from.index(0);

  if (isBackwardDelete && selection.$from.parentOffset === 0 && indexAtRoot > 0) {
    const prevNode = state.doc.child(indexAtRoot - 1);
    if (prevNode.type === state.schema.nodes.hr) {
      const from = selection.$from.posAtIndex(indexAtRoot - 1, 0);
      if (selection.$from.parent.content.size === 0) {
        const paragraphFrom = selection.$from.before();
        const paragraphTo = paragraphFrom + selection.$from.parent.nodeSize;
        let tr = state.tr.delete(paragraphFrom, paragraphTo);
        const hrTo = from + prevNode.nodeSize;
        const textSelection = findTextSelectionFromBoundary(
          tr.doc,
          hrTo,
          -1
        ) ?? findTextSelectionFromBoundary(
          tr.doc,
          hrTo,
          1
        );
        if (textSelection) {
          tr = tr.setSelection(textSelection);
        } else {
          const paragraphType = tr.doc.type.schema.nodes.paragraph;
          if (paragraphType) {
            tr = tr
              .insert(hrTo, paragraphType.create())
              .setSelection(TextSelection.create(tr.doc, hrTo + 1));
          }
        }
        view.dispatch(tr);
        return true;
      }

      const to = from + prevNode.nodeSize;
      view.dispatch(state.tr.delete(from, to).scrollIntoView());
      return true;
    }
  }

  if (isForwardDelete && selection.$from.parentOffset === selection.$from.parent.content.size && indexAtRoot < state.doc.childCount - 1) {
    const nextNode = state.doc.child(indexAtRoot + 1);
    if (nextNode.type === state.schema.nodes.hr) {
      const from = selection.$from.posAtIndex(indexAtRoot + 1, 0);
      const to = from + nextNode.nodeSize;
      view.dispatch(state.tr.delete(from, to).scrollIntoView());
      return true;
    }
  }

  return false;
}

function deleteSelectedHorizontalRule(view: EditorView, key: string): boolean {
  if (key !== 'Backspace' && key !== 'Delete') return false;

  const { state } = view;
  const { selection } = state;
  if (!(selection instanceof NodeSelection)) return false;
  if (selection.node.type !== state.schema.nodes.hr) return false;

  const anchorHint = selection.from;
  let tr = state.tr.deleteSelection();

  if (tr.doc.content.size === 0) {
    const paragraphType = tr.doc.type.schema.nodes.paragraph;
    if (paragraphType) {
      tr = tr.insert(0, paragraphType.create());
    }
  }

  const targetPos = Math.max(0, Math.min(anchorHint, tr.doc.content.size));
  tr = tr.setSelection(Selection.near(tr.doc.resolve(targetPos), -1));
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

export const hrAutoParagraphPlugin = $prose(() => {
  return new Plugin({
    key: hrAutoParagraphPluginKey,
    props: {
      handleKeyDown(view, event) {
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;
        if (event.isComposing) return false;

        if (event.key === 'ArrowUp') {
          if (!skipHorizontalRuleOnArrowUp(view)) return false;
          event.preventDefault();
          return true;
        }

        if (event.key === 'Enter') {
          if (!handleMarkdownBlockShortcutEnter(view)) return false;
          event.preventDefault();
          return true;
        }

        if (event.key === 'ArrowDown') {
          if (!skipHorizontalRuleOnArrowDown(view)) return false;
          event.preventDefault();
          return true;
        }

        if (event.key === 'Backspace' || event.key === 'Delete') {
          if (deleteSelectedHorizontalRule(view, event.key)) {
            event.preventDefault();
            return true;
          }

          if (!deleteAdjacentHorizontalRule(view, event.key)) return false;
          event.preventDefault();
          return true;
        }

        return false;
      },
      handleDOMEvents: {
        mousedown(view, event) {
          if (!(event instanceof MouseEvent)) return false;
          if (event.button !== 0) return false;
          const hrPos = resolveHorizontalRuleNodePos(view, event.target);
          if (hrPos === null) return false;

          if (!selectHorizontalRuleBlock(view, hrPos)) return false;
          event.preventDefault();
          return true;
        },
      },
    },
  });
});
