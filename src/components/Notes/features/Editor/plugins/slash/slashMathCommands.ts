import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { mathEditorPluginKey } from '../math/mathEditorPluginKey';
import { createOpenMathEditorState } from '../math/mathEditorState';
import { findInsertedNodePos, getSlashInsertViewportPosition } from './slashInsertUtils';

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
    dispatch(tr);
  } catch (error) {
    console.warn(`[SlashMenu] Failed to insert ${nodeType}:`, error);
  }
}
