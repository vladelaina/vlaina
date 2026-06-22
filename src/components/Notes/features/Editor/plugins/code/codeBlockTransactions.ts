import type { EditorView } from '@milkdown/kit/prose/view';
import { NodeSelection } from '@milkdown/kit/prose/state';
import { isSelectionFullyInsideNode, moveSelectionAfterNode } from './codeBlockSelectionUtils';
import { normalizeCodeBlockLanguage } from './codeBlockLanguage';

type ToggleCodeBlockCollapsedOptions = {
  selectionWhenCollapsingInside?: 'after' | 'node';
};

function markCodeBlockUserInput(view: EditorView): void {
  view.dom?.dispatchEvent?.(new CustomEvent('editor:block-user-input', { bubbles: true }));
}

function isNodeSelectable(node: NonNullable<ReturnType<EditorView['state']['doc']['nodeAt']>>): boolean {
  return !node.isText && node.type.spec.selectable !== false;
}

export function updateCodeBlockLanguage(
  view: EditorView,
  pos: number,
  language: string
) {
  const currentNode = view.state.doc.nodeAt(pos);
  if (!currentNode) {
    return;
  }

  const normalized = normalizeCodeBlockLanguage(language);
  markCodeBlockUserInput(view);
  view.dispatch(
    view.state.tr.setNodeMarkup(pos, undefined, {
      ...currentNode.attrs,
      language: normalized,
    })
  );
}

export function toggleCodeBlockCollapsed(
  view: EditorView,
  pos: number,
  isCollapsed: boolean,
  options: ToggleCodeBlockCollapsedOptions = {},
) {
  const currentNode = view.state.doc.nodeAt(pos);
  if (!currentNode) {
    return;
  }

  const nextCollapsed = !isCollapsed;
  const tr = view.state.tr.setNodeMarkup(pos, undefined, {
    ...currentNode.attrs,
    collapsed: nextCollapsed,
  });

  if (nextCollapsed && isSelectionFullyInsideNode(view.state.selection, pos, currentNode.nodeSize)) {
    if (options.selectionWhenCollapsingInside === 'node' && isNodeSelectable(currentNode)) {
      tr.setSelection(NodeSelection.create(tr.doc, pos));
    } else {
      moveSelectionAfterNode(tr, pos, currentNode.nodeSize);
    }
  }

  markCodeBlockUserInput(view);
  view.dispatch(tr);
}
