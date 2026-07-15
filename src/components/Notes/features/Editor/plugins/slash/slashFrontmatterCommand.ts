import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';

export function insertFrontmatter(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const frontmatter = state.schema.nodes.frontmatter;
  if (!frontmatter) return;

  const firstNode = state.doc.firstChild;
  if (firstNode?.type === frontmatter) {
    dispatch(state.tr.setSelection(TextSelection.create(state.doc, 1)).scrollIntoView());
    return;
  }

  const node = frontmatter.create();
  const tr = state.tr.insert(0, node);
  tr.setSelection(TextSelection.create(tr.doc, 1)).scrollIntoView();
  view.dom.dispatchEvent(new CustomEvent('editor:block-user-input', { bubbles: true }));
  dispatch(tr);
}
