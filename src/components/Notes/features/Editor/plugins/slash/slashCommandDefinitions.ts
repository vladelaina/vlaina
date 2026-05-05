import type { Ctx } from '@milkdown/kit/ctx';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import { insertHrCommand } from '@milkdown/kit/preset/commonmark';
import { insertTableCommand } from '@milkdown/kit/preset/gfm';
import type { IconName } from '@/components/ui/icons';
import { convertBlockType } from '../floating-toolbar/blockCommands';
import { insertImageFromFilePicker, insertFrontmatter } from './slashFileCommands';
import { insertFootnoteDef, insertFootnoteRef } from './slashFootnoteCommands';
import { insertMathNodeAndOpenEditor } from './slashMathCommands';
import { insertMermaidNodeAndOpenEditor } from './slashMermaidCommands';
import { openVideoPrompt } from './slashVideoCommand';

export {
  collectFootnoteIds,
  getNextFootnoteDefId,
  getNextFootnoteRefId,
} from './slashFootnoteCommands';

interface SlashCommandDefinition {
  id: string;
  name: string;
  icon: IconName;
  searchTerms: string[];
  commandId: string;
  run: (ctx: Ctx) => boolean | void | Promise<void>;
}

function insertNode(ctx: Ctx, nodeType: string, attrs?: object) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const type = state.schema.nodes[nodeType];
  if (!type) return;

  try {
    const node = type.createAndFill?.(attrs) ?? type.create(attrs);
    if (!node) return;
    dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
  } catch (error) {
    console.warn(`[SlashMenu] Failed to insert ${nodeType}:`, error);
  }
}

function replaceCurrentTextBlockWithParagraphText(ctx: Ctx, text: string) {
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

  tr.setSelection(TextSelection.create(tr.doc, from + 1 + text.length)).scrollIntoView();
  dispatch(tr);
}

function convertCurrentBlock(ctx: Ctx, blockType: Parameters<typeof convertBlockType>[1]) {
  const view = ctx.get(editorViewCtx);
  convertBlockType(view, blockType);
}

export const slashCommandDefinitions = [
  {
    id: 'heading-1',
    name: 'Heading 1',
    icon: 'editor.heading1',
    searchTerms: ['h1', 'title', 'heading'],
    commandId: 'heading-1',
    run: (ctx) => convertCurrentBlock(ctx, 'heading1'),
  },
  {
    id: 'heading-2',
    name: 'Heading 2',
    icon: 'editor.heading2',
    searchTerms: ['h2', 'heading'],
    commandId: 'heading-2',
    run: (ctx) => convertCurrentBlock(ctx, 'heading2'),
  },
  {
    id: 'heading-3',
    name: 'Heading 3',
    icon: 'editor.heading3',
    searchTerms: ['h3', 'heading'],
    commandId: 'heading-3',
    run: (ctx) => convertCurrentBlock(ctx, 'heading3'),
  },
  {
    id: 'heading-4',
    name: 'Heading 4',
    icon: 'editor.heading4',
    searchTerms: ['h4', 'heading'],
    commandId: 'heading-4',
    run: (ctx) => convertCurrentBlock(ctx, 'heading4'),
  },
  {
    id: 'heading-5',
    name: 'Heading 5',
    icon: 'editor.heading5',
    searchTerms: ['h5', 'heading'],
    commandId: 'heading-5',
    run: (ctx) => convertCurrentBlock(ctx, 'heading5'),
  },
  {
    id: 'heading-6',
    name: 'Heading 6',
    icon: 'editor.heading6',
    searchTerms: ['h6', 'heading'],
    commandId: 'heading-6',
    run: (ctx) => convertCurrentBlock(ctx, 'heading6'),
  },
  {
    id: 'task-list',
    name: 'Task List',
    icon: 'editor.taskList',
    searchTerms: ['todo', 'checkbox', 'checklist'],
    commandId: 'task-list',
    run: (ctx) => convertCurrentBlock(ctx, 'taskList'),
  },
  {
    id: 'ordered-list',
    name: 'Numbered List',
    icon: 'editor.listOrdered',
    searchTerms: ['ol', 'ordered'],
    commandId: 'ordered-list',
    run: (ctx) => convertCurrentBlock(ctx, 'orderedList'),
  },
  {
    id: 'bullet-list',
    name: 'Bullet List',
    icon: 'editor.list',
    searchTerms: ['ul', 'unordered'],
    commandId: 'bullet-list',
    run: (ctx) => convertCurrentBlock(ctx, 'bulletList'),
  },
  {
    id: 'quote',
    name: 'Quote',
    icon: 'common.quote',
    searchTerms: ['blockquote', 'cite'],
    commandId: 'quote',
    run: (ctx) => convertCurrentBlock(ctx, 'blockquote'),
  },
  {
    id: 'callout',
    name: 'Callout',
    icon: 'common.info',
    searchTerms: ['note', 'tip', 'warning', 'info'],
    commandId: 'callout',
    run: (ctx) =>
      insertNode(ctx, 'callout', {
        icon: { type: 'emoji', value: '💡' },
        backgroundColor: 'yellow',
      }),
  },
  {
    id: 'divider',
    name: 'Divider',
    icon: 'editor.divider',
    searchTerms: ['hr', 'line', 'separator'],
    commandId: 'divider',
    run: (ctx) => ctx.get(commandsCtx).call(insertHrCommand.key),
  },
  {
    id: 'code-block',
    name: 'Code Block',
    icon: 'editor.code',
    searchTerms: ['code', 'pre', 'snippet'],
    commandId: 'code-block',
    run: (ctx) => convertCurrentBlock(ctx, 'codeBlock'),
  },
  {
    id: 'table',
    name: 'Table',
    icon: 'editor.table',
    searchTerms: ['grid'],
    commandId: 'table',
    run: (ctx) => ctx.get(commandsCtx).call(insertTableCommand.key),
  },
  {
    id: 'image',
    name: 'Image',
    icon: 'file.image',
    searchTerms: ['img', 'picture', 'photo'],
    commandId: 'image',
    run: insertImageFromFilePicker,
  },
  {
    id: 'frontmatter',
    name: 'Frontmatter',
    icon: 'editor.frontmatter',
    searchTerms: ['yaml', 'metadata', 'properties'],
    commandId: 'frontmatter',
    run: insertFrontmatter,
  },
  {
    id: 'equation',
    name: 'Equation',
    icon: 'editor.equation',
    searchTerms: ['math', 'latex', 'formula'],
    commandId: 'equation',
    run: (ctx) => insertMathNodeAndOpenEditor(ctx, 'math_block'),
  },
  {
    id: 'inline-math',
    name: 'Inline Math',
    icon: 'editor.inlineMath',
    searchTerms: ['math inline', 'latex inline', 'formula inline'],
    commandId: 'inline-math',
    run: (ctx) => insertMathNodeAndOpenEditor(ctx, 'math_inline'),
  },
  {
    id: 'toc',
    name: 'Table of Contents',
    icon: 'editor.toc',
    searchTerms: ['toc', 'contents', 'outline'],
    commandId: 'toc',
    run: (ctx) => insertNode(ctx, 'toc', { maxLevel: 6 }),
  },
  {
    id: 'mermaid',
    name: 'Mermaid Diagram',
    icon: 'editor.diagram',
    searchTerms: ['diagram', 'flowchart', 'chart', 'graph'],
    commandId: 'mermaid',
    run: insertMermaidNodeAndOpenEditor,
  },
  {
    id: 'footnote',
    name: 'Footnote',
    icon: 'editor.footnote',
    searchTerms: ['note', 'reference', 'citation'],
    commandId: 'footnote',
    run: insertFootnoteRef,
  },
  {
    id: 'footnote-definition',
    name: 'Footnote Definition',
    icon: 'editor.footnote',
    searchTerms: ['footnote def', 'footnote definition', 'citation block'],
    commandId: 'footnote-definition',
    run: insertFootnoteDef,
  },
  {
    id: 'abbreviation',
    name: 'Abbreviation',
    icon: 'editor.abbreviation',
    searchTerms: ['abbr', 'acronym', 'short form'],
    commandId: 'abbreviation',
    run: (ctx) => replaceCurrentTextBlockWithParagraphText(ctx, '*[ABBR]: Full phrase'),
  },
  {
    id: 'video',
    name: 'Video',
    icon: 'editor.video',
    searchTerms: ['vedio', 'youtube', 'bilibili', 'embed', 'movie'],
    commandId: 'video',
    run: openVideoPrompt,
  },
] as const satisfies readonly SlashCommandDefinition[];

export type SlashCommandId = (typeof slashCommandDefinitions)[number]['commandId'];
