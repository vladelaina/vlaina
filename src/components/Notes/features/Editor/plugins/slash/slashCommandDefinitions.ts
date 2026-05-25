import type { Ctx } from '@milkdown/kit/ctx';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import { insertHrCommand } from '@milkdown/kit/preset/commonmark';
import { insertTableCommand } from '@milkdown/kit/preset/gfm';
import type { IconName } from '@/components/ui/icons';
import type { MessageKey } from '@/lib/i18n';
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
  nameKey: MessageKey;
  icon: IconName;
  searchTerms: string[];
  commandId: string;
  run: (ctx: Ctx) => boolean | void | Promise<void>;
}

function markSlashUserInput(view: { dom?: { dispatchEvent?: (event: Event) => boolean } }): void {
  view.dom?.dispatchEvent?.(new CustomEvent('vlaina:block-user-input', { bubbles: true }));
}

function insertNode(ctx: Ctx, nodeType: string, attrs?: object) {
  const view = ctx.get(editorViewCtx);
  const { state, dispatch } = view;
  const type = state.schema.nodes[nodeType];
  if (!type) return;

  try {
    const node = type.createAndFill?.(attrs) ?? type.create(attrs);
    if (!node) return;
    markSlashUserInput(view);
    dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
  } catch (error) {
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
  markSlashUserInput(view);
  dispatch(tr);
}

function convertCurrentBlock(ctx: Ctx, blockType: Parameters<typeof convertBlockType>[1]) {
  const view = ctx.get(editorViewCtx);
  convertBlockType(view, blockType);
}

export const slashCommandDefinitions = [
  {
    id: 'heading-1',
    nameKey: 'editor.blockType.heading1',
    icon: 'editor.heading1',
    searchTerms: ['h1', 'title', 'heading'],
    commandId: 'heading-1',
    run: (ctx) => convertCurrentBlock(ctx, 'heading1'),
  },
  {
    id: 'heading-2',
    nameKey: 'editor.blockType.heading2',
    icon: 'editor.heading2',
    searchTerms: ['h2', 'heading'],
    commandId: 'heading-2',
    run: (ctx) => convertCurrentBlock(ctx, 'heading2'),
  },
  {
    id: 'heading-3',
    nameKey: 'editor.blockType.heading3',
    icon: 'editor.heading3',
    searchTerms: ['h3', 'heading'],
    commandId: 'heading-3',
    run: (ctx) => convertCurrentBlock(ctx, 'heading3'),
  },
  {
    id: 'heading-4',
    nameKey: 'editor.blockType.heading4',
    icon: 'editor.heading4',
    searchTerms: ['h4', 'heading'],
    commandId: 'heading-4',
    run: (ctx) => convertCurrentBlock(ctx, 'heading4'),
  },
  {
    id: 'heading-5',
    nameKey: 'editor.blockType.heading5',
    icon: 'editor.heading5',
    searchTerms: ['h5', 'heading'],
    commandId: 'heading-5',
    run: (ctx) => convertCurrentBlock(ctx, 'heading5'),
  },
  {
    id: 'heading-6',
    nameKey: 'editor.blockType.heading6',
    icon: 'editor.heading6',
    searchTerms: ['h6', 'heading'],
    commandId: 'heading-6',
    run: (ctx) => convertCurrentBlock(ctx, 'heading6'),
  },
  {
    id: 'task-list',
    nameKey: 'editor.blockType.taskList',
    icon: 'editor.taskList',
    searchTerms: ['todo', 'checkbox', 'checklist'],
    commandId: 'task-list',
    run: (ctx) => convertCurrentBlock(ctx, 'taskList'),
  },
  {
    id: 'ordered-list',
    nameKey: 'editor.blockType.orderedList',
    icon: 'editor.listOrdered',
    searchTerms: ['ol', 'ordered'],
    commandId: 'ordered-list',
    run: (ctx) => convertCurrentBlock(ctx, 'orderedList'),
  },
  {
    id: 'bullet-list',
    nameKey: 'editor.blockType.bulletList',
    icon: 'editor.list',
    searchTerms: ['ul', 'unordered'],
    commandId: 'bullet-list',
    run: (ctx) => convertCurrentBlock(ctx, 'bulletList'),
  },
  {
    id: 'quote',
    nameKey: 'editor.blockType.blockquote',
    icon: 'common.quote',
    searchTerms: ['blockquote', 'cite'],
    commandId: 'quote',
    run: (ctx) => convertCurrentBlock(ctx, 'blockquote'),
  },
  {
    id: 'callout',
    nameKey: 'editor.slash.callout',
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
    nameKey: 'editor.slash.divider',
    icon: 'editor.divider',
    searchTerms: ['hr', 'line', 'separator'],
    commandId: 'divider',
    run: (ctx) => {
      markSlashUserInput(ctx.get(editorViewCtx));
      ctx.get(commandsCtx).call(insertHrCommand.key);
    },
  },
  {
    id: 'code-block',
    nameKey: 'editor.blockType.codeBlock',
    icon: 'editor.code',
    searchTerms: ['code', 'pre', 'snippet'],
    commandId: 'code-block',
    run: (ctx) => convertCurrentBlock(ctx, 'codeBlock'),
  },
  {
    id: 'table',
    nameKey: 'editor.slash.table',
    icon: 'editor.table',
    searchTerms: ['grid'],
    commandId: 'table',
    run: (ctx) => {
      markSlashUserInput(ctx.get(editorViewCtx));
      ctx.get(commandsCtx).call(insertTableCommand.key);
    },
  },
  {
    id: 'image',
    nameKey: 'editor.slash.image',
    icon: 'file.image',
    searchTerms: ['img', 'picture', 'photo'],
    commandId: 'image',
    run: insertImageFromFilePicker,
  },
  {
    id: 'frontmatter',
    nameKey: 'editor.slash.frontmatter',
    icon: 'editor.frontmatter',
    searchTerms: ['yaml', 'metadata', 'properties'],
    commandId: 'frontmatter',
    run: insertFrontmatter,
  },
  {
    id: 'equation',
    nameKey: 'editor.slash.equation',
    icon: 'editor.equation',
    searchTerms: ['math', 'latex', 'formula'],
    commandId: 'equation',
    run: (ctx) => insertMathNodeAndOpenEditor(ctx, 'math_block'),
  },
  {
    id: 'inline-math',
    nameKey: 'editor.slash.inlineMath',
    icon: 'editor.inlineMath',
    searchTerms: ['math inline', 'latex inline', 'formula inline'],
    commandId: 'inline-math',
    run: (ctx) => insertMathNodeAndOpenEditor(ctx, 'math_inline'),
  },
  {
    id: 'toc',
    nameKey: 'editor.slash.tableOfContents',
    icon: 'editor.toc',
    searchTerms: ['toc', 'contents', 'outline'],
    commandId: 'toc',
    run: (ctx) => insertNode(ctx, 'toc', { maxLevel: 6 }),
  },
  {
    id: 'mermaid',
    nameKey: 'editor.slash.mermaidDiagram',
    icon: 'editor.diagram',
    searchTerms: ['diagram', 'flowchart', 'chart', 'graph'],
    commandId: 'mermaid',
    run: insertMermaidNodeAndOpenEditor,
  },
  {
    id: 'footnote',
    nameKey: 'editor.slash.footnote',
    icon: 'editor.footnote',
    searchTerms: ['note', 'reference', 'citation'],
    commandId: 'footnote',
    run: insertFootnoteRef,
  },
  {
    id: 'footnote-definition',
    nameKey: 'editor.slash.footnoteDefinition',
    icon: 'editor.footnote',
    searchTerms: ['footnote def', 'footnote definition', 'citation block'],
    commandId: 'footnote-definition',
    run: insertFootnoteDef,
  },
  {
    id: 'abbreviation',
    nameKey: 'editor.slash.abbreviation',
    icon: 'editor.abbreviation',
    searchTerms: ['abbr', 'acronym', 'short form'],
    commandId: 'abbreviation',
    run: (ctx) => replaceCurrentTextBlockWithParagraphText(ctx, '*[ABBR]: Full phrase'),
  },
  {
    id: 'video',
    nameKey: 'editor.slash.video',
    icon: 'editor.video',
    searchTerms: ['vedio', 'youtube', 'bilibili', 'embed', 'movie'],
    commandId: 'video',
    run: openVideoPrompt,
  },
] as const satisfies readonly SlashCommandDefinition[];

export type SlashCommandId = (typeof slashCommandDefinitions)[number]['commandId'];
