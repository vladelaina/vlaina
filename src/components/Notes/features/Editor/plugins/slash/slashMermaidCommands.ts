import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { mermaidEditorPluginKey } from '../mermaid/mermaidEditorPluginKey';
import { createOpenMermaidEditorState } from '../mermaid/mermaidEditorState';
import {
  findInsertedNodePos,
  getSlashInsertViewportPosition,
  moveSelectionAfterInsertedNode,
  replaceSelectionOrCurrentBlankTextBlockWithNode,
} from './slashInsertUtils';

function markSlashUserInput(view: { dom?: { dispatchEvent?: (event: Event) => boolean } }): void {
  view.dom?.dispatchEvent?.(new CustomEvent('editor:block-user-input', { bubbles: true }));
}

export function insertMermaidNodeAndOpenEditor(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const type = state.schema.nodes.mermaid;
  if (!type) return;

  try {
    const position = getSlashInsertViewportPosition(ctx);
    const node = type.create({ code: '' });
    const tr = replaceSelectionOrCurrentBlankTextBlockWithNode(state, node);
    const preferredPos = tr.mapping.map(state.selection.from, -1);
    const nodePos = findInsertedNodePos({
      doc: tr.doc,
      preferredPos,
      nodeTypeName: 'mermaid',
    });
    moveSelectionAfterInsertedNode({
      tr,
      nodePos,
      insertedNodeFallback: node,
      paragraphType: state.schema.nodes.paragraph,
      convertFollowingMarkdownBlankLine: false,
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
    markSlashUserInput(view);
    dispatch(tr);
  } catch (error) {
  }
}
