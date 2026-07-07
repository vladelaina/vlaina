import { NodeSelection, TextSelection, type EditorState, type Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION } from './blockSelectionPluginState';
import {
  EDITABLE_MARKDOWN_BLANK_LINE_CLASS,
  findTopLevelBlockAfter,
  findTopLevelBlockBefore,
  isEditableMarkdownBlankLineNode,
  isMarkdownBlankLinePlaceholderNode,
  MARKDOWN_BLANK_LINE_VALUE,
  MAX_EDITABLE_MARKDOWN_BLANK_LINE_DECORATIONS
} from './markdownBlankLineShared';

const editableMarkdownBlankLineDecorationsCache = new WeakMap<EditorState['doc'], DecorationSet>();

export function handleMarkdownBlankLineTextInput(
  view: EditorView,
  from: number,
  to: number,
  text: string,
): boolean {
  const { selection, schema } = view.state;
  if (selection instanceof NodeSelection) {
    if (selection.from !== from || selection.to !== to) return false;
    if (selection.node.type.name !== 'html_block' || selection.node.attrs.value !== MARKDOWN_BLANK_LINE_VALUE) {
      return false;
    }

    const paragraphType = schema.nodes.paragraph;
    if (!paragraphType) return false;

    const paragraph = paragraphType.create(
      null,
      text.length > 0 ? schema.text(text) : undefined
    );
    let tr = view.state.tr.replaceWith(selection.from, selection.to, paragraph);
    tr = tr
      .setSelection(TextSelection.create(tr.doc, selection.from + 1 + text.length))
      .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
    view.dispatch(tr.scrollIntoView());
    return true;
  }

  if (!(selection instanceof TextSelection)) return false;
  if (selection.from !== from || selection.to !== to) return false;
  if (selection.$from.parent !== selection.$to.parent) return false;
  if (!isEditableMarkdownBlankLineNode(selection.$from.parent)) return false;

  const paragraphStart = selection.$from.before();
  const replaceFrom = selection.empty ? paragraphStart + 1 : selection.from;
  const replaceTo = selection.empty ? paragraphStart + 2 : selection.to;
  let tr = view.state.tr.insertText(text, replaceFrom, replaceTo);
  tr = tr
    .setSelection(TextSelection.create(tr.doc, replaceFrom + text.length))
    .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  view.dispatch(tr.scrollIntoView());
  return true;
}

export function handleFreshEmptyParagraphTextInput(
  view: EditorView,
  from: number,
  to: number,
  text: string,
): boolean {
  const { selection, schema } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;
  if (selection.from !== from || selection.to !== to) return false;
  if (text.length === 0) return false;

  const $from = selection.$from;
  if ($from.depth !== 1 || $from.parent.type.name !== 'paragraph' || $from.parent.content.size !== 0) {
    return false;
  }

  const paragraphType = schema.nodes.paragraph;
  const htmlBlockType = schema.nodes.html_block;
  if (!paragraphType || !htmlBlockType) return false;

  const blockFrom = $from.before(1);
  const blockTo = $from.after(1);
  const previous = findTopLevelBlockBefore(view.state.doc, blockFrom);
  const next = findTopLevelBlockAfter(view.state.doc, blockTo);
  if (!previous || !next) return false;
  if (isMarkdownBlankLinePlaceholderNode(previous.node) || isMarkdownBlankLinePlaceholderNode(next.node)) {
    return false;
  }

  const blankLine = htmlBlockType.create({ value: MARKDOWN_BLANK_LINE_VALUE });
  const paragraph = paragraphType.create(null, schema.text(text));
  let tr = view.state.tr.replaceWith(blockFrom, blockTo, [blankLine, paragraph, blankLine]);
  const insertedParagraphPos = blockFrom + blankLine.nodeSize;
  tr = tr
    .setSelection(TextSelection.create(tr.doc, insertedParagraphPos + 1 + text.length))
    .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  view.dispatch(tr.scrollIntoView());
  return true;
}

export function appendFreshEmptyParagraphInputBoundaryTransaction(
  oldState: EditorState,
  newState: EditorState,
): Transaction | null {
  const paragraphType = newState.schema.nodes.paragraph;
  const htmlBlockType = newState.schema.nodes.html_block;
  if (!paragraphType || !htmlBlockType) return null;
  if (oldState.doc.childCount !== newState.doc.childCount) return null;

  let offset = 0;
  for (let index = 0; index < newState.doc.childCount; index += 1) {
    const oldNode = oldState.doc.child(index);
    const newNode = newState.doc.child(index);
    const from = offset;
    offset += newNode.nodeSize;

    if (index === 0 || index === newState.doc.childCount - 1) continue;
    if (oldNode.type.name !== 'paragraph' || oldNode.content.size !== 0) continue;
    if (newNode.type.name !== 'paragraph' || newNode.content.size === 0) continue;

    const previous = newState.doc.child(index - 1);
    const next = newState.doc.child(index + 1);
    if (isMarkdownBlankLinePlaceholderNode(previous) || isMarkdownBlankLinePlaceholderNode(next)) continue;

    const blankLine = htmlBlockType.create({ value: MARKDOWN_BLANK_LINE_VALUE });
    let tr = newState.tr.replaceWith(from, from + newNode.nodeSize, [blankLine, newNode, blankLine]);

    if (newState.selection instanceof TextSelection) {
      const selectionInsideInsertedParagraph =
        newState.selection.from > from &&
        newState.selection.from < from + newNode.nodeSize &&
        newState.selection.to > from &&
        newState.selection.to < from + newNode.nodeSize;
      if (selectionInsideInsertedParagraph) {
        const insertedParagraphPos = from + blankLine.nodeSize;
        tr = tr.setSelection(TextSelection.create(
          tr.doc,
          insertedParagraphPos + (newState.selection.from - from),
          insertedParagraphPos + (newState.selection.to - from),
        ));
      }
    }

    return tr
      .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION)
      .scrollIntoView();
  }

  return null;
}

export function createEditableMarkdownBlankLineDecorations(doc: EditorState['doc']): DecorationSet {
  const cached = editableMarkdownBlankLineDecorationsCache.get(doc);
  if (cached) return cached;

  const decorations: Decoration[] = [];
  const childCount = typeof doc.childCount === 'number' ? doc.childCount : 0;
  let offset = 0;
  for (
    let index = 0;
    index < childCount && decorations.length < MAX_EDITABLE_MARKDOWN_BLANK_LINE_DECORATIONS;
    index += 1
  ) {
    const node = doc.child(index);
    if (isEditableMarkdownBlankLineNode(node)) {
      decorations.push(Decoration.node(offset, offset + node.nodeSize, {
        class: EDITABLE_MARKDOWN_BLANK_LINE_CLASS,
      }));
    }
    offset += node.nodeSize;
  }
  const decorationSet = decorations.length > 0 ? DecorationSet.create(doc, decorations) : DecorationSet.empty;
  editableMarkdownBlankLineDecorationsCache.set(doc, decorationSet);
  return decorationSet;
}
