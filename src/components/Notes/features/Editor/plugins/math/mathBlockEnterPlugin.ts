import { $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { mathEditorPluginKey } from './mathEditorPluginKey';
import { isMathBlockShortcutText } from './mathBlockFence';
import { createOpenMathEditorState } from './mathEditorState';

function getMathBlockEnterViewportPosition(view: EditorView) {
  try {
    const coords = view.coordsAtPos(view.state.selection.from);
    return {
      x: coords.left,
      y: coords.bottom + 8,
    };
  } catch {
    return {
      x: 16,
      y: 16,
    };
  }
}

export function handleMathBlockShortcutEnter(view: EditorView): boolean {
  const { state } = view;
  const { selection, schema } = state;
  const { $from } = selection;

  if (!selection.empty) {
    return false;
  }

  const mathBlockType = schema.nodes.math_block;
  if (!mathBlockType) {
    return false;
  }

  if ($from.parent.type.name !== 'paragraph') {
    return false;
  }

  if ($from.parentOffset !== $from.parent.content.size) {
    return false;
  }

  if (!isMathBlockShortcutText($from.parent.textContent)) {
    return false;
  }

  const parentDepth = $from.depth - 1;
  if (parentDepth < 0) {
    return false;
  }

  const container = $from.node(parentDepth);
  const index = $from.index(parentDepth);
  if (typeof container.canReplaceWith === 'function' && !container.canReplaceWith(index, index + 1, mathBlockType)) {
    return false;
  }

  const paragraphPos = $from.before();
  const paragraphEnd = paragraphPos + $from.parent.nodeSize;
  const tr = state.tr
    .replaceWith(paragraphPos, paragraphEnd, mathBlockType.create({ latex: '' }))
    .setMeta(
      mathEditorPluginKey,
      createOpenMathEditorState({
      latex: '',
      displayMode: true,
      position: getMathBlockEnterViewportPosition(view),
      nodePos: paragraphPos,
      openSource: 'new-empty-block',
    })
    )
    .scrollIntoView();

  view.dispatch(tr);
  return true;
}

export const mathBlockEnterPlugin = $prose(() => {
  return new Plugin({
    props: {
      handleKeyDown(view, event) {
        if (event.key !== 'Enter') {
          return false;
        }

        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.isComposing) {
          return false;
        }

        if (!handleMathBlockShortcutEnter(view)) {
          return false;
        }

        event.preventDefault();
        return true;
      },
    },
  });
});
