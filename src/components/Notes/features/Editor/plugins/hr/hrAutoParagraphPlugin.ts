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
import { dispatchBlockSelectionAction } from '../cursor/blockSelectionPluginState';
import { shouldConvertParagraphToThematicBreak } from './hrAutoParagraphUtils';

export const hrAutoParagraphPluginKey = new PluginKey('hrAutoParagraph');
const MAX_HR_SHORTCUT_TEXT_CHARS = 256;

function shouldPreserveLeadingFrontmatterShortcut(view: EditorView): boolean {
  const { selection } = view.state;
  const parentDepth = selection.$from.depth - 1;
  if (parentDepth !== 0) {
    return false;
  }

  if (selection.$from.index(parentDepth) !== 0) {
    return false;
  }

  if (selection.$from.parent.content.size !== 3) {
    return false;
  }

  return selection.$from.parent.textBetween(0, selection.$from.parent.content.size, '', '') === '---';
}

export function handleHorizontalRuleShortcutEnter(view: EditorView): boolean {
  const { state } = view;
  const { selection } = state;
  if (!selection.empty) return false;
  if (shouldPreserveLeadingFrontmatterShortcut(view)) return false;

  const paragraphType = state.schema.nodes.paragraph;
  if (!paragraphType || selection.$from.parent.type !== paragraphType) return false;

  const parent = selection.$from.parent;
  const offset = selection.$from.parentOffset;
  if (parent.content.size > MAX_HR_SHORTCUT_TEXT_CHARS) return false;
  const text = parent.textBetween(0, parent.content.size, '', '');
  if (!shouldConvertParagraphToThematicBreak(text, offset)) return false;

  return insertHorizontalRuleWithTrailingParagraph(view);
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
        tr = tr.setSelection(NodeSelection.create(tr.doc, from)).scrollIntoView();
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

function resolveHorizontalRuleNodePos(view: EditorView, target: EventTarget | null): number | null {
  if (!(target instanceof HTMLElement)) return null;

  const hrType = view.state.schema.nodes.hr;
  if (!hrType) return null;

  const wrapper = target.closest('.md-hr') as HTMLElement | null;
  const directHr = target.closest('hr') as HTMLElement | null;
  const wrappedHr = wrapper?.querySelector('hr') ?? null;
  const candidates = [directHr, wrappedHr, wrapper].filter(
    (candidate, index, list): candidate is HTMLElement =>
      candidate instanceof HTMLElement && list.indexOf(candidate) === index
  );

  for (const candidate of candidates) {
    if (!view.dom.contains(candidate)) continue;

    try {
      const pos = view.posAtDOM(candidate, 0);
      if (view.state.doc.nodeAt(pos)?.type === hrType) {
        return pos;
      }
    } catch {
      // Fall through to the DOM-to-node scan below.
    }
  }

  let foundPos: number | null = null;
  view.state.doc.descendants((node, pos) => {
    if (foundPos !== null || node.type !== hrType) return false;
    const nodeDOM = view.nodeDOM(pos);
    if (!(nodeDOM instanceof HTMLElement)) return true;
    if (
      candidates.includes(nodeDOM)
      || candidates.some((candidate) => nodeDOM.contains(candidate) || candidate.contains(nodeDOM))
    ) {
      foundPos = pos;
      return false;
    }
    return true;
  });

  return foundPos;
}

function selectHorizontalRuleBlock(view: EditorView, hrPos: number): boolean {
  const hrNode = view.state.doc.nodeAt(hrPos);
  if (!hrNode || hrNode.type !== view.state.schema.nodes.hr) return false;

  dispatchBlockSelectionAction(view, {
    type: 'set-blocks',
    blocks: [{ from: hrPos, to: hrPos + hrNode.nodeSize }],
  });
  view.focus();
  return true;
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

        if (event.key === 'Enter') {
          if (event.isComposing) return false;
          if (!handleHorizontalRuleShortcutEnter(view)) return false;
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
