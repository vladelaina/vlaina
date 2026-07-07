import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import { convertBlockType } from '../floating-toolbar/blockCommands';
import {
  findInsertedNodePos,
  moveSelectionAfterInsertedNode,
  replaceSelectionOrCurrentBlankTextBlockWithNode,
} from './slashInsertUtils';

export function markSlashUserInput(view: { dom?: { dispatchEvent?: (event: Event) => boolean } }): void {
  view.dom?.dispatchEvent?.(new CustomEvent('editor:block-user-input', { bubbles: true }));
}

export function insertNode(ctx: Ctx, nodeType: string, attrs?: object) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const type = state.schema.nodes[nodeType];
  if (!type) return;

  try {
    const node = type.createAndFill?.(attrs) ?? type.create(attrs);
    if (!node) return;
    const tr = replaceSelectionOrCurrentBlankTextBlockWithNode(state, node);
    if (node.isAtom || node.isLeaf) {
      const preferredPos = tr.mapping.map(state.selection.from, -1);
      const nodePos = findInsertedNodePos({
        doc: tr.doc,
        preferredPos,
        nodeTypeName: nodeType,
      });
      moveSelectionAfterInsertedNode({
        tr,
        nodePos,
        insertedNodeFallback: node,
        paragraphType: state.schema.nodes.paragraph,
        convertFollowingMarkdownBlankLine: false,
      });
    }
    markSlashUserInput(view);
    dispatch(tr.scrollIntoView());
  } catch (error) {
  }
}

function replaceCurrentTextBlockWithParagraphText(
  ctx: Ctx,
  text: string,
  selectionRange?: { from: number; to: number }
) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const { $from } = state.selection;
  const paragraph = state.schema.nodes.paragraph;
  if (!paragraph || !$from.parent.isTextblock) return;

  const textNode = state.schema.text(text);
  const from = $from.before();
  const to = $from.after();
  const nextNode = paragraph.create(null, textNode);
  const tr = state.tr.replaceWith(from, to, nextNode);

  const selectionFrom = selectionRange
    ? from + 1 + Math.max(0, Math.min(selectionRange.from, text.length))
    : from + 1 + text.length;
  const selectionTo = selectionRange
    ? from + 1 + Math.max(0, Math.min(selectionRange.to, text.length))
    : selectionFrom;
  tr.setSelection(TextSelection.create(tr.doc, selectionFrom, selectionTo)).scrollIntoView();
  markSlashUserInput(view);
  dispatch(tr);
}

export function insertAbbreviationDefinitionTemplate(ctx: Ctx) {
  const template = '*[ABBR]: Full phrase';
  replaceCurrentTextBlockWithParagraphText(ctx, template, {
    from: template.indexOf('ABBR'),
    to: template.indexOf('ABBR') + 'ABBR'.length,
  });
}

export function convertCurrentBlock(ctx: Ctx, blockType: Parameters<typeof convertBlockType>[1]) {
  const view = ctx.get(editorViewCtx);
  convertBlockType(view, blockType);
}
