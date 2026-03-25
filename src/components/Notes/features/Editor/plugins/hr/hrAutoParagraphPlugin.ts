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
import { shouldConvertLineToThematicBreak } from './hrAutoParagraphUtils';

export const hrAutoParagraphPluginKey = new PluginKey('hrAutoParagraph');

function shouldPreserveLeadingFrontmatterShortcut(view: EditorView, text: string): boolean {
  if (text !== '-') {
    return false;
  }

  const { selection } = view.state;
  const parentDepth = selection.$from.depth - 1;
  if (parentDepth !== 0) {
    return false;
  }

  if (selection.$from.index(parentDepth) !== 0) {
    return false;
  }

  const parentText = selection.$from.parent.textContent;
  const offset = selection.$from.parentOffset;
  const nextText = `${parentText.slice(0, offset)}-${parentText.slice(offset)}`;
  return nextText.trim() === '---';
}

function shouldConvertToHorizontalRule(view: EditorView, from: number, to: number, text: string): boolean {
  if (from !== to) return false;

  const { state } = view;
  const { selection } = state;
  if (!selection.empty || selection.from !== from) return false;
  if (shouldPreserveLeadingFrontmatterShortcut(view, text)) return false;

  const paragraphType = state.schema.nodes.paragraph;
  if (!paragraphType || selection.$from.parent.type !== paragraphType) return false;

  const parent = selection.$from.parent;
  const offset = selection.$from.parentOffset;
  return shouldConvertLineToThematicBreak(parent.textContent, offset, text);
}

function insertHorizontalRuleWithTrailingParagraph(view: EditorView): boolean {
  const { state } = view;
  const hrType = state.schema.nodes.hr;
  const paragraphType = state.schema.nodes.paragraph;
  if (!hrType || !paragraphType) return false;

  const { $from } = state.selection;
  const paragraphPos = $from.before();
  const paragraphNodeSize = $from.parent.nodeSize;

  const hrNode = hrType.create();
  let tr = state.tr.replaceWith(paragraphPos, paragraphPos + paragraphNodeSize, hrNode);
  const afterHrPos = paragraphPos + hrNode.nodeSize;

  tr = tr.insert(afterHrPos, paragraphType.create());
  tr = tr.setSelection(TextSelection.create(tr.doc, afterHrPos + 1)).scrollIntoView();
  view.dispatch(tr);
  return true;
}

function isArrowUpSkipHrScenario(view: EditorView): boolean {
  const { state } = view;
  const { selection } = state;
  if (!selection.empty) return false;
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

function deleteAdjacentHorizontalRule(view: EditorView, key: string): boolean {
  const { state } = view;
  const { selection } = state;
  if (!selection.empty) return false;
  if (!selection.$from.parent.isTextblock) return false;

  const isBackwardDelete = key === 'Backspace' || key === 'Delete';
  const isForwardDelete = key === 'Delete';
  if (!isBackwardDelete && !isForwardDelete) return false;

  const indexAtRoot = selection.$from.index(0);

  if (isBackwardDelete && selection.$from.parentOffset === 0 && indexAtRoot > 0) {
    const prevNode = state.doc.child(indexAtRoot - 1);
    if (prevNode.type === state.schema.nodes.hr) {
      const from = selection.$from.posAtIndex(indexAtRoot - 1, 0);
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

export const hrAutoParagraphPlugin = $prose(() => {
  return new Plugin({
    key: hrAutoParagraphPluginKey,
    props: {
      handleKeyDown(view, event) {
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;

        if (event.key === 'ArrowUp') {
          if (!skipHorizontalRuleOnArrowUp(view)) return false;
          event.preventDefault();
          return true;
        }

        if (event.key === 'ArrowDown') {
          if (!skipHorizontalRuleOnArrowDown(view)) return false;
          event.preventDefault();
          return true;
        }

        if (event.key === 'Backspace' || event.key === 'Delete') {
          if (!deleteAdjacentHorizontalRule(view, event.key)) return false;
          event.preventDefault();
          return true;
        }

        return false;
      },
      handleTextInput(view, from, to, text) {
        if (!shouldConvertToHorizontalRule(view, from, to, text)) return false;
        return insertHorizontalRuleWithTrailingParagraph(view);
      },
      handleDOMEvents: {
        mousedown(view, event) {
          if (!(event instanceof MouseEvent)) return false;
          if (event.button !== 0) return false;
          if (!(event.target instanceof HTMLElement)) return false;

          const hrElement = event.target.closest('hr');
          if (!hrElement || !view.dom.contains(hrElement)) return false;

          try {
            const hrPos = view.posAtDOM(hrElement, 0);
            const tr = view.state.tr.setSelection(NodeSelection.create(view.state.doc, hrPos));
            view.dispatch(tr.scrollIntoView());
            view.focus();
            event.preventDefault();
            return true;
          } catch {
            return false;
          }
        },
      },
    },
  });
});
