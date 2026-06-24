import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import {
  createOpenHtmlBlockEditorState,
  htmlBlockEditorPluginKey,
} from '../html-block/htmlBlockEditorPlugin';
import {
  findInsertedNodePos,
  getSlashInsertViewportPosition,
  moveSelectionAfterInsertedNode,
} from './slashInsertUtils';

function markSlashUserInput(view: { dom?: { dispatchEvent?: (event: Event) => boolean } }): void {
  view.dom?.dispatchEvent?.(new CustomEvent('editor:block-user-input', { bubbles: true }));
}

export function insertHtmlBlockNodeAndOpenEditor(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const type = state.schema.nodes.html_block;
  if (!type) return;

  try {
    const position = getSlashInsertViewportPosition(ctx);
    const value = '';
    const node = type.create({ value });
    const tr = state.tr.replaceSelectionWith(node);
    const preferredPos = tr.mapping.map(state.selection.from, -1);
    const nodePos = findInsertedNodePos({
      doc: tr.doc,
      preferredPos,
      nodeTypeName: 'html_block',
    });
    moveSelectionAfterInsertedNode({
      tr,
      nodePos,
      insertedNodeFallback: node,
      paragraphType: state.schema.nodes.paragraph,
    });

    tr
      .setMeta(
        htmlBlockEditorPluginKey,
        createOpenHtmlBlockEditorState({
          value,
          position,
          nodePos,
        })
      )
      .scrollIntoView();
    markSlashUserInput(view);
    dispatch(tr);
  } catch (error) {
  }
}
