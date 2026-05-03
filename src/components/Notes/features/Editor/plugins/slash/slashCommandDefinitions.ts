import type { Ctx } from '@milkdown/kit/ctx';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import { insertHrCommand } from '@milkdown/kit/preset/commonmark';
import { insertTableCommand } from '@milkdown/kit/preset/gfm';
import { getMimeType } from '@/lib/assets/core/naming';
import { getBaseName, getStorageAdapter } from '@/lib/storage/adapter';
import { openDialog } from '@/lib/storage/dialog';
import { convertBlockType } from '../floating-toolbar/blockCommands';
import { handleEditorImageFiles } from '../image-upload/handleEditorImageFiles';

interface SlashCommandDefinition {
  id: string;
  name: string;
  icon: string;
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

export function collectFootnoteIds(doc: { descendants?: (callback: (node: any) => void) => void }) {
  const refs = new Set<string>();
  const defs = new Set<string>();

  doc.descendants?.((node: any) => {
    const id = typeof node.attrs?.id === 'string' ? node.attrs.id.trim() : '';
    if (!id) return;

    if (node.type?.name === 'footnote_ref') {
      refs.add(id);
    } else if (node.type?.name === 'footnote_def') {
      defs.add(id);
    }
  });

  return { refs, defs };
}

function getNextNumericFootnoteId(ids: Iterable<string>) {
  let maxId = 0;
  for (const id of ids) {
    const numericId = Number.parseInt(id, 10);
    if (Number.isInteger(numericId) && String(numericId) === id) {
      maxId = Math.max(maxId, numericId);
    }
  }
  return String(maxId + 1);
}

function compareFootnoteIds(a: string, b: string) {
  const aNumber = Number.parseInt(a, 10);
  const bNumber = Number.parseInt(b, 10);
  const aIsNumeric = Number.isInteger(aNumber) && String(aNumber) === a;
  const bIsNumeric = Number.isInteger(bNumber) && String(bNumber) === b;

  if (aIsNumeric && bIsNumeric) {
    return aNumber - bNumber;
  }

  if (aIsNumeric !== bIsNumeric) {
    return aIsNumeric ? -1 : 1;
  }

  return a.localeCompare(b);
}

export function getNextFootnoteRefId(doc: { descendants?: (callback: (node: any) => void) => void }) {
  const ids = collectFootnoteIds(doc);
  return getNextNumericFootnoteId([...ids.refs, ...ids.defs]);
}

export function getNextFootnoteDefId(doc: { descendants?: (callback: (node: any) => void) => void }) {
  const ids = collectFootnoteIds(doc);
  const pendingRefId = Array.from(ids.refs)
    .filter((id) => !ids.defs.has(id))
    .sort(compareFootnoteIds)[0];

  return pendingRefId ?? getNextNumericFootnoteId([...ids.refs, ...ids.defs]);
}

function insertFootnoteRef(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  insertNode(ctx, 'footnote_ref', { id: getNextFootnoteRefId(view.state.doc) });
}

function insertFootnoteDef(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  insertNode(ctx, 'footnote_def', { id: getNextFootnoteDefId(view.state.doc) });
}

async function insertImageFromFilePicker(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  const insertionBookmark = view.state.selection.getBookmark();

  try {
    const selected = await openDialog({
      title: 'Insert Image',
      authorizeParentDirectory: true,
      filters: [
        {
          name: 'Images',
          extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'],
        },
      ],
    });
    const selectedPath = Array.isArray(selected) ? selected[0] : selected;
    if (!selectedPath) return;

    const bytes = await getStorageAdapter().readBinaryFile(selectedPath);
    const fileName = getBaseName(selectedPath) || 'image';
    const file = new File([new Uint8Array(bytes)], fileName, {
      type: getMimeType(fileName),
    });

    view.dispatch(
      view.state.tr
        .setSelection(insertionBookmark.resolve(view.state.doc))
        .scrollIntoView()
    );
    await handleEditorImageFiles([file], view);
  } catch (error) {
    console.warn('[SlashMenu] Failed to insert image:', error);
  }
}

function insertVideoFromPrompt(ctx: Ctx) {
  if (typeof window === 'undefined') return;

  const src = window.prompt('Video URL');
  const trimmedSrc = src?.trim();
  if (!trimmedSrc) return;

  insertNode(ctx, 'video', { src: trimmedSrc });
}

function insertFrontmatter(ctx: Ctx) {
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
  dispatch(tr);
}

export const slashCommandDefinitions = [
  {
    id: 'heading-1',
    name: 'Heading 1',
    icon: 'H1',
    searchTerms: ['h1', 'title'],
    commandId: 'heading-1',
    run: (ctx) => convertCurrentBlock(ctx, 'heading1'),
  },
  {
    id: 'heading-2',
    name: 'Heading 2',
    icon: 'H2',
    searchTerms: ['h2'],
    commandId: 'heading-2',
    run: (ctx) => convertCurrentBlock(ctx, 'heading2'),
  },
  {
    id: 'heading-3',
    name: 'Heading 3',
    icon: 'H3',
    searchTerms: ['h3'],
    commandId: 'heading-3',
    run: (ctx) => convertCurrentBlock(ctx, 'heading3'),
  },
  {
    id: 'heading-4',
    name: 'Heading 4',
    icon: 'H4',
    searchTerms: ['h4'],
    commandId: 'heading-4',
    run: (ctx) => convertCurrentBlock(ctx, 'heading4'),
  },
  {
    id: 'heading-5',
    name: 'Heading 5',
    icon: 'H5',
    searchTerms: ['h5'],
    commandId: 'heading-5',
    run: (ctx) => convertCurrentBlock(ctx, 'heading5'),
  },
  {
    id: 'heading-6',
    name: 'Heading 6',
    icon: 'H6',
    searchTerms: ['h6'],
    commandId: 'heading-6',
    run: (ctx) => convertCurrentBlock(ctx, 'heading6'),
  },
  {
    id: 'task-list',
    name: 'Task List',
    icon: '☑',
    searchTerms: ['todo', 'checkbox', 'checklist'],
    commandId: 'task-list',
    run: (ctx) => convertCurrentBlock(ctx, 'taskList'),
  },
  {
    id: 'bullet-list',
    name: 'Bullet List',
    icon: '•',
    searchTerms: ['ul', 'unordered'],
    commandId: 'bullet-list',
    run: (ctx) => convertCurrentBlock(ctx, 'bulletList'),
  },
  {
    id: 'ordered-list',
    name: 'Numbered List',
    icon: '1.',
    searchTerms: ['ol', 'ordered'],
    commandId: 'ordered-list',
    run: (ctx) => convertCurrentBlock(ctx, 'orderedList'),
  },
  {
    id: 'quote',
    name: 'Quote',
    icon: '"',
    searchTerms: ['blockquote', 'cite'],
    commandId: 'quote',
    run: (ctx) => convertCurrentBlock(ctx, 'blockquote'),
  },
  {
    id: 'callout',
    name: 'Callout',
    icon: '💡',
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
    icon: '—',
    searchTerms: ['hr', 'line', 'separator'],
    commandId: 'divider',
    run: (ctx) => ctx.get(commandsCtx).call(insertHrCommand.key),
  },
  {
    id: 'code-block',
    name: 'Code Block',
    icon: '</>',
    searchTerms: ['code', 'pre', 'snippet'],
    commandId: 'code-block',
    run: (ctx) => convertCurrentBlock(ctx, 'codeBlock'),
  },
  {
    id: 'table',
    name: 'Table',
    icon: '▦',
    searchTerms: ['grid'],
    commandId: 'table',
    run: (ctx) => ctx.get(commandsCtx).call(insertTableCommand.key),
  },
  {
    id: 'image',
    name: 'Image',
    icon: '🖼',
    searchTerms: ['img', 'picture', 'photo'],
    commandId: 'image',
    run: insertImageFromFilePicker,
  },
  {
    id: 'frontmatter',
    name: 'Frontmatter',
    icon: '---',
    searchTerms: ['yaml', 'metadata', 'properties'],
    commandId: 'frontmatter',
    run: insertFrontmatter,
  },
  {
    id: 'equation',
    name: 'Equation',
    icon: '∑',
    searchTerms: ['math', 'latex', 'formula'],
    commandId: 'equation',
    run: (ctx) => insertNode(ctx, 'math_block', { latex: '' }),
  },
  {
    id: 'toc',
    name: 'Table of Contents',
    icon: '📑',
    searchTerms: ['toc', 'contents', 'outline'],
    commandId: 'toc',
    run: (ctx) => insertNode(ctx, 'toc', { maxLevel: 6 }),
  },
  {
    id: 'mermaid',
    name: 'Mermaid Diagram',
    icon: '📊',
    searchTerms: ['diagram', 'flowchart', 'chart', 'graph'],
    commandId: 'mermaid',
    run: (ctx) => insertNode(ctx, 'mermaid', { code: 'graph TD\n    A[Start] --> B[End]' }),
  },
  {
    id: 'footnote',
    name: 'Footnote',
    icon: '📝',
    searchTerms: ['note', 'reference', 'citation'],
    commandId: 'footnote',
    run: insertFootnoteRef,
  },
  {
    id: 'footnote-definition',
    name: 'Footnote Definition',
    icon: '[^:]',
    searchTerms: ['footnote def', 'footnote definition', 'citation block'],
    commandId: 'footnote-definition',
    run: insertFootnoteDef,
  },
  {
    id: 'abbreviation',
    name: 'Abbreviation',
    icon: 'Ab',
    searchTerms: ['abbr', 'acronym', 'short form'],
    commandId: 'abbreviation',
    run: (ctx) => replaceCurrentTextBlockWithParagraphText(ctx, '*[ABBR]: Full phrase'),
  },
  {
    id: 'video',
    name: 'Video',
    icon: '🎬',
    searchTerms: ['youtube', 'bilibili', 'embed', 'movie'],
    commandId: 'video',
    run: insertVideoFromPrompt,
  },
  {
    id: 'inline-math',
    name: 'Inline Math',
    icon: 'x²',
    searchTerms: ['math inline', 'latex inline', 'formula inline'],
    commandId: 'inline-math',
    run: (ctx) => insertNode(ctx, 'math_inline', { latex: '' }),
  },
] as const satisfies readonly SlashCommandDefinition[];

export type SlashCommandId = (typeof slashCommandDefinitions)[number]['commandId'];
