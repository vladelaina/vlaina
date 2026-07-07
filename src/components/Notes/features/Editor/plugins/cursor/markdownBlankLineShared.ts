import { TextSelection, type EditorState, type Transaction } from '@milkdown/kit/prose/state';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION } from './blockSelectionPluginState';

export const MARKDOWN_BLANK_LINE_VALUE = '<!--vlaina-markdown-blank-line-->';
export const RENDERED_HTML_BOUNDARY_BLANK_LINE_VALUE = '<!--vlaina-rendered-html-boundary-blank-line-->';
export const MARKDOWN_BLANK_LINE_SELECTOR = `[data-type="html-block"][data-value="${MARKDOWN_BLANK_LINE_VALUE}"]`;
export const EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER = '\u200B';
export const EDITABLE_MARKDOWN_BLANK_LINE_CLASS = 'editor-editable-markdown-blank-line';
export const MARKDOWN_BLANK_LINE_DEBUG_STORAGE_KEY = 'editor-debug-markdown-blank-line';
export const MAX_EDITABLE_MARKDOWN_BLANK_LINE_DECORATIONS = 1000;

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface TopLevelBlock {
  from: number;
  to: number;
  node: ProseNode;
}

export function isEditableMarkdownBlankLineNode(node: { content?: { size?: number }; textBetween?: (from: number, to: number, blockSeparator?: string, leafText?: string) => string; type?: { name?: string } }): boolean {
  return (
    node.type?.name === 'paragraph' &&
    node.content?.size === EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length &&
    node.textBetween?.(0, EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length, '\0', '\0') === EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER
  );
}

export function isMarkdownBlankLinePlaceholderNode(node: { attrs?: { value?: unknown }; type?: { name?: string } } | null | undefined): boolean {
  return node?.type?.name === 'html_block' && node.attrs?.value === MARKDOWN_BLANK_LINE_VALUE;
}

export function isRenderedHtmlBoundaryBlankLinePlaceholderNode(node: { attrs?: { value?: unknown }; type?: { name?: string } } | null | undefined): boolean {
  return node?.type?.name === 'html_block' && node.attrs?.value === RENDERED_HTML_BOUNDARY_BLANK_LINE_VALUE;
}

export function isEditableBlankLinePlaceholderNode(node: { attrs?: { value?: unknown }; type?: { name?: string } } | null | undefined): boolean {
  return isMarkdownBlankLinePlaceholderNode(node) || isRenderedHtmlBoundaryBlankLinePlaceholderNode(node);
}

export function findTopLevelBlockBefore(doc: EditorState['doc'], pos: number): TopLevelBlock | null {
  let found: TopLevelBlock | null = null;
  doc.forEach((node, offset) => {
    const from = offset;
    const to = offset + node.nodeSize;
    if (to > pos) return;
    found = { from, to, node };
  });
  return found;
}

export function findTopLevelBlockAfter(doc: EditorState['doc'], pos: number): TopLevelBlock | null {
  let found: TopLevelBlock | null = null;
  doc.forEach((node, offset) => {
    if (found || offset < pos) return;
    found = { from: offset, to: offset + node.nodeSize, node };
  });
  return found;
}

export function findTopLevelBlockAt(doc: EditorState['doc'], pos: number): TopLevelBlock | null {
  let found: TopLevelBlock | null = null;
  doc.forEach((node, offset) => {
    if (found) return;
    const from = offset;
    const to = offset + node.nodeSize;
    if (from <= pos && pos <= to) {
      found = { from, to, node };
    }
  });
  return found;
}

export function createTextSelectionNearDocumentPosition(
  doc: EditorState['doc'],
  pos: number,
  bias: -1 | 1,
): TextSelection | null {
  let before: TextSelection | null = null;
  let after: TextSelection | null = null;

  doc.descendants((node, nodePos) => {
    if (!node.isTextblock || !node.inlineContent) return true;

    const start = nodePos + 1;
    const end = start + node.content.size;
    if (nodePos <= pos) {
      try {
        before = TextSelection.create(doc, end);
      } catch {
        before = null;
      }
    }
    if (after === null && nodePos >= pos) {
      try {
        after = TextSelection.create(doc, start);
      } catch {
        after = null;
      }
    }
    return true;
  });

  return bias < 0 ? before ?? after : after ?? before;
}

export function createEditableMarkdownBlankLineParagraph(view: EditorView): ProseNode | null {
  const paragraphType = view.state.schema.nodes.paragraph;
  if (!paragraphType) return null;
  return paragraphType.create(
    null,
    view.state.schema.text(EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER)
  );
}

export function createEditableMarkdownBlankLineParagraphFromState(state: EditorState): ProseNode | null {
  const paragraphType = state.schema.nodes.paragraph;
  if (!paragraphType) return null;
  return paragraphType.create(
    null,
    state.schema.text(EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER)
  );
}

export function replaceBlankLinePlaceholderWithEditableParagraph(view: EditorView, block: TopLevelBlock): boolean {
  if (!isEditableBlankLinePlaceholderNode(block.node)) {
    return false;
  }

  const paragraph = createEditableMarkdownBlankLineParagraph(view);
  if (!paragraph) return false;

  let tr = view.state.tr.replaceWith(block.from, block.to, paragraph);
  tr = tr
    .setSelection(TextSelection.create(tr.doc, block.from + 1 + EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length))
    .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

export function replaceMarkdownBlankLineWithEditableParagraph(view: EditorView, block: TopLevelBlock): boolean {
  if (!isMarkdownBlankLinePlaceholderNode(block.node)) {
    return false;
  }

  return replaceBlankLinePlaceholderWithEditableParagraph(view, block);
}

export function replaceRangeWithEditableMarkdownBlankLine(
  view: EditorView,
  from: number,
  to: number,
): boolean {
  const paragraph = createEditableMarkdownBlankLineParagraph(view);
  if (!paragraph) return false;

  let tr = view.state.tr.replaceWith(from, to, paragraph);
  tr = tr
    .setSelection(TextSelection.create(tr.doc, from + 1 + EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length))
    .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

export function replaceMarkdownBlankLineBlockInTransactionWithEditableParagraph(
  state: EditorState,
  tr: Transaction,
  block: TopLevelBlock,
): Transaction | null {
  if (!isMarkdownBlankLinePlaceholderNode(block.node)) return null;

  const paragraph = createEditableMarkdownBlankLineParagraphFromState(state);
  if (!paragraph) return null;

  return tr
    .replaceWith(block.from, block.to, paragraph)
    .setSelection(TextSelection.create(
      tr.doc,
      block.from + 1 + EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length,
    ))
    .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
}
