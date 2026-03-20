import { $prose } from '@milkdown/kit/utils';
import { type Node } from '@milkdown/kit/prose/model';
import { Plugin } from '@milkdown/kit/prose/state';
import { type EditorView } from '@milkdown/kit/prose/view';
import { CodeBlockNodeView } from './CodeBlockNodeView';
import { moveSelectionAfterNode } from './codeBlockSelectionUtils';

export function findCodeBlockContext(state: EditorView['state']) {
  const { $from } = state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === 'code_block') {
      return {
        node,
        pos: $from.before(depth),
      };
    }
  }

  return null;
}

export function createCollapsedCodeBlockSelectionGuardTransaction(
  state: EditorView['state']
) {
  const context = findCodeBlockContext(state);
  if (!context || !context.node.attrs.collapsed) {
    return null;
  }

  const { node, pos } = context;
  const tr = state.tr;
  moveSelectionAfterNode(tr, pos, node.nodeSize);
  return tr.scrollIntoView();
}

export const codeBlockNodeViewPlugin = $prose(() => {
  return new Plugin({
    props: {
      nodeViews: {
        code_block: (node: Node, view: EditorView, getPos: () => number | undefined) =>
          new CodeBlockNodeView(node, view, getPos),
      },
    },
  });
});

export const collapsedCodeBlockSelectionGuardPlugin = $prose(() => {
  return new Plugin({
    appendTransaction: (_transactions, _oldState, newState) => {
      return createCollapsedCodeBlockSelectionGuardTransaction(newState);
    },
  });
});
