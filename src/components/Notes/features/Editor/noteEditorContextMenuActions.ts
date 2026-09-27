import { Selection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  getCurrentEditorAction,
  getCurrentEditorView,
} from './utils/editorViewRegistry';
import { applySlashCommand } from './plugins/slash/slashCommands';
import type { SlashCommandId } from './plugins/slash/slashCommands';
import { convertBlockType } from './plugins/floating-toolbar/blockCommands';
import { openLinkTooltipFromSelection } from './plugins/floating-toolbar/linkTooltipActions';
import { toggleMark } from './plugins/floating-toolbar/markCommands';
import { deleteSelectedBlocks } from './plugins/cursor/blockSelectionCommands';
import {
  clearBlockSelection,
  getBlockSelectionPluginState,
} from './plugins/cursor/blockSelectionPluginState';
import { markEditorUserInput } from './plugins/shared/userInputEvents';
import {
  copyRichSelection,
  pasteMarkdownTextIntoEditor,
} from './noteEditorContextMenuClipboardActions';

export type ContextMenuInsertAction =
  | 'image'
  | 'callout'
  | 'emoji'
  | 'footnote'
  | 'footnote-definition'
  | 'link-reference'
  | 'divider'
  | 'table'
  | 'code'
  | 'formula'
  | 'inline-math'
  | 'toc'
  | 'mermaid'
  | 'html-block'
  | 'abbreviation'
  | 'video'
  | 'frontmatter'
  | 'paragraph-above'
  | 'paragraph-below';

const contextMenuSlashActions: Partial<Record<ContextMenuInsertAction, SlashCommandId>> = {
  abbreviation: 'abbreviation',
  callout: 'callout',
  code: 'code-block',
  divider: 'divider',
  emoji: 'emoji',
  footnote: 'footnote',
  'footnote-definition': 'footnote-definition',
  formula: 'equation',
  'html-block': 'html-block',
  image: 'image',
  'inline-math': 'inline-math',
  mermaid: 'mermaid',
  table: 'table',
  toc: 'toc',
  video: 'video',
  frontmatter: 'frontmatter',
};

function deleteSelection(view: EditorView): boolean {
  const selectedBlocks = getBlockSelectionPluginState(view.state).selectedBlocks;
  if (selectedBlocks.length > 0) {
    return deleteSelectedBlocks(view, selectedBlocks, (tr) => tr);
  }

  if (view.state.selection.empty) return false;
  markEditorUserInput(view);
  view.dispatch(view.state.tr.deleteSelection().scrollIntoView());
  view.focus();
  return true;
}

export async function cutSelection(view: EditorView): Promise<boolean> {
  const doc = view.state.doc;
  const selection = view.state.selection;
  const selectedBlocks = getBlockSelectionPluginState(view.state).selectedBlocks;
  const copied = await copyRichSelection(view, 'rich');
  if (!copied) return false;
  const currentBlocks = getBlockSelectionPluginState(view.state).selectedBlocks;
  if (
    !view.state.doc.eq(doc)
    || !view.state.selection.eq(selection)
    || currentBlocks.length !== selectedBlocks.length
    || currentBlocks.some((block, index) => (
      block.from !== selectedBlocks[index]?.from || block.to !== selectedBlocks[index]?.to
    ))
  ) return false;
  deleteSelection(view);
  return true;
}

export function deleteRichSelection(view: EditorView): boolean {
  return deleteSelection(view);
}

function runEditorContextAction(
  view: EditorView,
  callback: (ctx: import('@milkdown/kit/ctx').Ctx) => unknown,
): boolean {
  const action = getCurrentEditorAction();
  if (!action || getCurrentEditorView() !== view) return false;
  try {
    action(callback);
    return true;
  } catch {
    return false;
  }
}

function insertParagraphRelativeToSelection(
  view: EditorView,
  direction: 'above' | 'below',
): boolean {
  const { $from } = view.state.selection;
  let depth = $from.depth;
  while (depth > 0 && !$from.node(depth).isTextblock) depth -= 1;
  if (depth <= 0) return false;

  const position = direction === 'above' ? $from.before(depth) : $from.after(depth);
  const resolved = view.state.doc.resolve(position);
  const paragraph = view.state.schema.nodes.paragraph;
  if (!paragraph || !resolved.parent.canReplaceWith(resolved.index(), resolved.index(), paragraph)) {
    return false;
  }

  const tr = view.state.tr.insert(position, paragraph.create());
  tr.setSelection(TextSelection.create(tr.doc, position + 1)).scrollIntoView();
  markEditorUserInput(view);
  view.dispatch(tr);
  view.focus();
  return true;
}

export function applyRichFormatting(view: EditorView, action: string): boolean {
  switch (action) {
    case 'bold': toggleMark(view, 'strong'); return true;
    case 'italic': toggleMark(view, 'emphasis'); return true;
    case 'underline': toggleMark(view, 'underline'); return true;
    case 'strike': toggleMark(view, 'strike_through'); return true;
    case 'code': toggleMark(view, 'inlineCode'); return true;
    case 'highlight': toggleMark(view, 'highlight'); return true;
    case 'link': openLinkTooltipFromSelection(view, { autoFocus: true }); return true;
    case 'quote': convertBlockType(view, 'blockquote'); return true;
    case 'ordered-list': convertBlockType(view, 'orderedList'); return true;
    case 'bullet-list': convertBlockType(view, 'bulletList'); return true;
    case 'task-list': convertBlockType(view, 'taskList'); return true;
    default: return false;
  }
}

export function insertRichAction(view: EditorView, action: ContextMenuInsertAction): boolean {
  const slashAction = contextMenuSlashActions[action];
  if (slashAction) {
    return runEditorContextAction(view, (ctx) => applySlashCommand(ctx, slashAction));
  }

  switch (action) {
    case 'link-reference':
      return pasteMarkdownTextIntoEditor(view, '[link][reference]\n\n[reference]: ');
    case 'paragraph-above':
      return insertParagraphRelativeToSelection(view, 'above');
    case 'paragraph-below':
      return insertParagraphRelativeToSelection(view, 'below');
    default:
      return false;
  }
}

export function focusEditor(view: EditorView): void {
  view.focus();
}

export function setSelectionAtPoint(view: EditorView, clientX: number, clientY: number): void {
  const coords = view.posAtCoords({ left: clientX, top: clientY });
  if (!coords) {
    view.focus();
    return;
  }

  const position = Math.max(0, Math.min(coords.pos, view.state.doc.content.size));
  const selectedBlocks = getBlockSelectionPluginState(view.state).selectedBlocks;
  if (selectedBlocks.some((block) => block.from <= position && position < block.to)) {
    view.focus();
    return;
  }
  if (selectedBlocks.length > 0) {
    clearBlockSelection(view);
  }
  const current = view.state.selection;
  if (current.from <= position && position <= current.to && !current.empty) {
    view.focus();
    return;
  }

  const resolved = view.state.doc.resolve(position);
  const selection = resolved.parent.inlineContent
    ? TextSelection.create(view.state.doc, position)
    : Selection.near(resolved, 1);
  view.dispatch(view.state.tr.setSelection(selection).setMeta('addToHistory', false));
  view.focus();
}

export function getEditorViewForContextMenu(): EditorView | null {
  return getCurrentEditorView();
}
