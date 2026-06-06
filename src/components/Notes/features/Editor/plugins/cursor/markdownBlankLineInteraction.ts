import { NodeSelection, TextSelection, type EditorState } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import { blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION } from './blockSelectionPluginState';
import { isSameEditorScrollRoot } from './blankAreaInteractionUtils';
import {
  STOP_PROSE_SCAN,
  scanProseDescendants,
} from '../shared/boundedProseNodeScan';

const MARKDOWN_BLANK_LINE_VALUE = '<!--vlaina-markdown-blank-line-->';
const MARKDOWN_BLANK_LINE_SELECTOR = `[data-type="html-block"][data-value="${MARKDOWN_BLANK_LINE_VALUE}"]`;
const EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER = '\u200B';
const EDITABLE_MARKDOWN_BLANK_LINE_CLASS = 'editor-editable-markdown-blank-line';
const MARKDOWN_BLANK_LINE_DEBUG_STORAGE_KEY = 'editor-debug-markdown-blank-line';
const MAX_EDITABLE_MARKDOWN_BLANK_LINE_DECORATIONS = 1000;
const editableMarkdownBlankLineDecorationsCache = new WeakMap<EditorState['doc'], DecorationSet>();

function resolveMarkdownBlankLineTarget(view: EditorView, target: EventTarget | null): HTMLElement | null {
  const targetElement = target instanceof HTMLElement
    ? target
    : target instanceof Node
      ? target.parentElement
      : null;
  const blankLine = targetElement?.closest(MARKDOWN_BLANK_LINE_SELECTOR);
  return blankLine instanceof HTMLElement && view.dom.contains(blankLine) ? blankLine : null;
}

export function resolveMarkdownBlankLineNodePos(view: EditorView, blankLine: HTMLElement): number | null {
  try {
    const directPos = view.posAtDOM(blankLine, 0);
    const directNode = view.state.doc.nodeAt(directPos);
    if (
      directNode?.type.name === 'html_block'
      && directNode.attrs.value === MARKDOWN_BLANK_LINE_VALUE
      && view.nodeDOM(directPos) === blankLine
    ) {
      return directPos;
    }
  } catch {
    // Fall through to the document scan for custom DOM mappings.
  }

  let found: number | null = null;
  scanProseDescendants(view.state.doc, (node, pos) => {
    if (node.type?.name !== 'html_block' || node.attrs?.value !== MARKDOWN_BLANK_LINE_VALUE) {
      return true;
    }
    if (view.nodeDOM(pos) === blankLine) {
      found = pos;
      return STOP_PROSE_SCAN;
    }
    return true;
  }, Number.POSITIVE_INFINITY);
  return found;
}

export function findEditableMarkdownBlankLineElement(root: HTMLElement): HTMLParagraphElement | null {
  for (let index = 0; index < root.children.length; index += 1) {
    const child = root.children.item(index);
    if (
      child instanceof HTMLParagraphElement
      && child.textContent === EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER
    ) {
      return child;
    }
  }
  return null;
}

function isMarkdownBlankLineDebugEnabled(): boolean {
  const globalValue = globalThis as typeof globalThis & {
    __debugMarkdownBlankLine?: boolean;
    localStorage?: Pick<Storage, 'getItem'>;
  };
  if (globalValue.__debugMarkdownBlankLine === true) return true;
  try {
    return globalValue.localStorage?.getItem(MARKDOWN_BLANK_LINE_DEBUG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function logMarkdownBlankLineDebug(message: string, payload: Record<string, unknown>): void {
  if (!isMarkdownBlankLineDebugEnabled()) return;
  console.debug('[editor:markdown-blank-line]', message, payload);
}

export function handleMarkdownBlankLinePointerDown(view: EditorView, event: MouseEvent): boolean {
  if (!isSameEditorScrollRoot(view, event.target)) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;

  const blankLine = resolveMarkdownBlankLineTarget(view, event.target);
  if (!blankLine) return false;

  const nodePos = resolveMarkdownBlankLineNodePos(view, blankLine);
  if (nodePos === null) return false;

  const node = view.state.doc.nodeAt(nodePos);
  if (!node || node.type.name !== 'html_block') return false;
  const paragraphType = view.state.schema.nodes.paragraph;
  if (!paragraphType) return false;

  const debugEnabled = isMarkdownBlankLineDebugEnabled();
  const beforeRect = debugEnabled ? blankLine.getBoundingClientRect() : null;
  const nextElement = debugEnabled && blankLine.nextElementSibling instanceof HTMLElement
    ? blankLine.nextElementSibling
    : null;
  const nextTopBefore = nextElement?.getBoundingClientRect().top ?? null;
  event.preventDefault();
  const paragraph = paragraphType.create(null, view.state.schema.text(EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER));
  let tr = view.state.tr.replaceWith(nodePos, nodePos + node.nodeSize, paragraph);
  tr = tr
    .setSelection(TextSelection.create(tr.doc, nodePos + 1))
    .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  view.dispatch(tr.scrollIntoView());
  view.focus();

  const editableBlankLine = debugEnabled
    ? findEditableMarkdownBlankLineElement(view.dom)
    : null;
  const afterRect = editableBlankLine?.getBoundingClientRect() ?? null;
  const nextTopAfter = nextElement?.getBoundingClientRect().top ?? null;
  logMarkdownBlankLineDebug('click converted placeholder to editable paragraph', {
    nodePos,
    selectionType: view.state.selection.constructor.name,
    blankLineHeightBefore: beforeRect?.height ?? null,
    blankLineHeightAfter: afterRect?.height ?? null,
    nextTopBefore,
    nextTopAfter,
    nextTopDelta: nextTopBefore !== null && nextTopAfter !== null ? nextTopAfter - nextTopBefore : null,
  });
  return true;
}

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
  if (
    selection.$from.parent.type.name !== 'paragraph'
    || selection.$from.parent.textContent !== EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER
  ) return false;

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
    if (
      node.type.name === 'paragraph'
      && node.textContent === EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER
    ) {
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
