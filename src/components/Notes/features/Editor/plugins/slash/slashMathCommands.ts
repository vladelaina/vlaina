import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { mathEditorPluginKey } from '../math/mathEditorPluginKey';
import { createOpenMathEditorState } from '../math/mathEditorState';
import { findInsertedNodePos, getSlashInsertViewportPosition } from './slashInsertUtils';

function markSlashUserInput(view: { dom?: { dispatchEvent?: (event: Event) => boolean } }): void {
  view.dom?.dispatchEvent?.(new CustomEvent('editor:block-user-input', { bubbles: true }));
}

export function insertMathNodeAndOpenEditor(ctx: Ctx, nodeType: 'math_block' | 'math_inline') {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const type = state.schema.nodes[nodeType];
  if (!type) return;

  try {
    const position = getSlashInsertViewportPosition(ctx);
    const node = type.create({ latex: '' });
    const tr = state.tr.replaceSelectionWith(node);
    const preferredPos = tr.mapping.map(state.selection.from, -1);
    const nodePos = findInsertedNodePos({
      doc: tr.doc,
      preferredPos,
      nodeTypeName: nodeType,
    });

    tr
      .setMeta(
        mathEditorPluginKey,
        createOpenMathEditorState({
          latex: '',
          displayMode: nodeType === 'math_block',
          position,
          nodePos,
          openSource: 'new-empty-block',
        })
      )
      .scrollIntoView();
    markSlashUserInput(view);
    dispatch(tr);
  } catch (error) {
  }
}
