import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { mermaidEditorPluginKey } from '../mermaid/mermaidEditorPluginKey';
import { createOpenMermaidEditorState } from '../mermaid/mermaidEditorState';
import { findInsertedNodePos, getSlashInsertViewportPosition } from './slashInsertUtils';

export function insertMermaidNodeAndOpenEditor(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const type = state.schema.nodes.mermaid;
  if (!type) return;

  try {
    const position = getSlashInsertViewportPosition(ctx);
    const node = type.create({ code: '' });
    const tr = state.tr.replaceSelectionWith(node);
    const preferredPos = tr.mapping.map(state.selection.from, -1);
    const nodePos = findInsertedNodePos({
      doc: tr.doc,
      preferredPos,
      nodeTypeName: 'mermaid',
    });

    tr
      .setMeta(
        mermaidEditorPluginKey,
        createOpenMermaidEditorState({
          code: '',
          position,
          nodePos,
          openSource: 'new-empty-block',
        })
      )
      .scrollIntoView();
    dispatch(tr);
  } catch (error) {
    console.warn('[SlashMenu] Failed to insert mermaid:', error);
  }
}
