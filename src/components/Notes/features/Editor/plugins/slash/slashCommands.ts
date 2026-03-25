import type { Ctx } from '@milkdown/kit/ctx';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { insertTableCommand } from '@milkdown/kit/preset/gfm';
import { insertHrCommand, wrapInHeadingCommand } from '@milkdown/kit/preset/commonmark';
import { createCodeBlockAttrs } from '../code/codeBlockSettings';

export type SlashCommandId =
  | 'paragraph'
  | 'inline-math'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'heading-4'
  | 'heading-5'
  | 'heading-6'
  | 'bullet-list'
  | 'ordered-list'
  | 'task-list'
  | 'code-block'
  | 'equation'
  | 'image'
  | 'table'
  | 'divider'
  | 'callout'
  | 'quote'
  | 'toc'
  | 'mermaid'
  | 'footnote'
  | 'footnote-definition'
  | 'abbreviation'
  | 'video';

function insertNode(ctx: Ctx, nodeType: string, attrs?: object) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const type = state.schema.nodes[nodeType];
  if (!type) return;

  const node = type.createAndFill?.(attrs) ?? type.create(attrs);
  dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
}

function insertParagraphText(ctx: Ctx, text: string) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const paragraph = state.schema.nodes.paragraph;
  if (!paragraph) return;

  const textNode = state.schema.text(text);
  dispatch(state.tr.replaceSelectionWith(paragraph.create(null, textNode)).scrollIntoView());
}

function wrapInList(ctx: Ctx, listType: 'bullet_list' | 'ordered_list') {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const { bullet_list, ordered_list, list_item, paragraph } = state.schema.nodes;
  const list = listType === 'bullet_list' ? bullet_list : ordered_list;

  if (!list || !list_item || !paragraph) return;

  const item = list_item.create(null, paragraph.create());
  dispatch(state.tr.replaceSelectionWith(list.create(null, item)).scrollIntoView());
}

function insertTaskList(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const { bullet_list, list_item, paragraph } = state.schema.nodes;

  if (!bullet_list || !list_item || !paragraph) return;

  const item = list_item.create({ checked: false }, paragraph.create());
  dispatch(state.tr.replaceSelectionWith(bullet_list.create(null, item)).scrollIntoView());
}

function insertCodeBlock(ctx: Ctx) {
  insertNode(ctx, 'code_block', createCodeBlockAttrs());
}

const slashCommandRegistry: Record<SlashCommandId, (ctx: Ctx) => void> = {
  paragraph: (ctx) => insertNode(ctx, 'paragraph'),
  'inline-math': (ctx) => insertNode(ctx, 'math_inline', { latex: '' }),
  'heading-1': (ctx) => ctx.get(commandsCtx).call(wrapInHeadingCommand.key, 1),
  'heading-2': (ctx) => ctx.get(commandsCtx).call(wrapInHeadingCommand.key, 2),
  'heading-3': (ctx) => ctx.get(commandsCtx).call(wrapInHeadingCommand.key, 3),
  'heading-4': (ctx) => ctx.get(commandsCtx).call(wrapInHeadingCommand.key, 4),
  'heading-5': (ctx) => ctx.get(commandsCtx).call(wrapInHeadingCommand.key, 5),
  'heading-6': (ctx) => ctx.get(commandsCtx).call(wrapInHeadingCommand.key, 6),
  'bullet-list': (ctx) => wrapInList(ctx, 'bullet_list'),
  'ordered-list': (ctx) => wrapInList(ctx, 'ordered_list'),
  'task-list': insertTaskList,
  'code-block': insertCodeBlock,
  equation: (ctx) => insertNode(ctx, 'math_block', { latex: '' }),
  image: (ctx) => insertNode(ctx, 'image', { src: '', alt: '', align: 'center', width: null }),
  table: (ctx) => ctx.get(commandsCtx).call(insertTableCommand.key),
  divider: (ctx) => ctx.get(commandsCtx).call(insertHrCommand.key),
  callout: (ctx) =>
    insertNode(ctx, 'callout', {
      icon: { type: 'emoji', value: '💡' },
      backgroundColor: 'yellow',
    }),
  quote: (ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state, dispatch } = view;
    const { blockquote, paragraph } = state.schema.nodes;
    if (!blockquote || !paragraph) return;

    dispatch(
      state.tr.replaceSelectionWith(blockquote.create(null, paragraph.create())).scrollIntoView()
    );
  },
  toc: (ctx) => insertNode(ctx, 'toc', { maxLevel: 6 }),
  mermaid: (ctx) => insertNode(ctx, 'mermaid', { code: 'graph TD\n    A[Start] --> B[End]' }),
  footnote: (ctx) => insertNode(ctx, 'footnote_ref', { id: '1' }),
  'footnote-definition': (ctx) => insertNode(ctx, 'footnote_def', { id: '1' }),
  abbreviation: (ctx) => insertParagraphText(ctx, '*[ABBR]: Full phrase'),
  video: (ctx) => insertNode(ctx, 'video', { src: '' }),
};

export function applySlashCommand(ctx: Ctx, commandId: SlashCommandId) {
  const command = slashCommandRegistry[commandId];
  if (!command) return;
  command(ctx);
}
