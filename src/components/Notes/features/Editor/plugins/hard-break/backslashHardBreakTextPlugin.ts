import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { $mark, $prose, $remark } from '@milkdown/kit/utils';

interface MdastPosition {
  start?: { offset?: number };
  end?: { offset?: number };
}

interface MdastNode {
  children?: MdastNode[];
  data?: Record<string, unknown>;
  position?: MdastPosition;
  type?: string;
  value?: string;
}

interface VFileLike {
  value?: unknown;
  toString?: () => string;
}

const BACKSLASH_HARD_BREAK_TEXT_DATA_FIELD = 'vlainaBackslashHardBreakText';
const BACKSLASH_HARD_BREAK_SOURCE_TEXT_NODE_TYPE = 'vlainaBackslashHardBreakSourceText';
const BACKSLASH_HARD_BREAK_SOURCE_TEXT_MARK_NAME = 'backslash_hard_break_source_text';
export const backslashHardBreakCursorPluginKey = new PluginKey('backslashHardBreakCursor');

function getFileMarkdown(file: VFileLike | undefined): string {
  if (typeof file?.value === 'string') return file.value;
  if (typeof file?.toString === 'function') return file.toString();
  return '';
}

function isBackslashHardBreakNode(node: MdastNode, markdown: string): boolean {
  if (node.type !== 'break') return false;
  if (node.data?.[BACKSLASH_HARD_BREAK_TEXT_DATA_FIELD]) return false;

  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;
  if (
    typeof start !== 'number'
    || typeof end !== 'number'
    || start < 0
    || end <= start
    || end > markdown.length
  ) {
    return false;
  }

  return /^\\(?:\r\n|\n|\r)$/.test(markdown.slice(start, end));
}

function transformChildren(children: MdastNode[] | undefined, markdown: string) {
  if (!children) return;

  for (let index = 0; index < children.length; index += 1) {
    const node = children[index];
    transformChildren(node.children, markdown);

    if (
      !isBackslashHardBreakNode(node, markdown)
    ) {
      continue;
    }

    node.data = {
      ...(node.data || {}),
      [BACKSLASH_HARD_BREAK_TEXT_DATA_FIELD]: true,
    };
    children.splice(index, 0, {
      children: [{
        type: 'text',
        value: '\\',
      }],
      position: node.position,
      type: BACKSLASH_HARD_BREAK_SOURCE_TEXT_NODE_TYPE,
    });
    index += 1;
  }
}

export function transformBackslashHardBreaksToText(tree: MdastNode, file?: VFileLike) {
  const markdown = getFileMarkdown(file);
  if (!markdown.includes('\\')) return;
  transformChildren(tree.children, markdown);
}

export const backslashHardBreakTextPlugin = $remark(
  'backslashHardBreakText',
  () => () => transformBackslashHardBreaksToText,
);

export const backslashHardBreakSourceTextMark = $mark(BACKSLASH_HARD_BREAK_SOURCE_TEXT_MARK_NAME, () => ({
  inclusive: false,
  parseDOM: [
    { tag: 'span[data-vlaina-backslash-hard-break-source-text]' },
  ],
  toDOM: () => ['span', { 'data-vlaina-backslash-hard-break-source-text': 'true' }, 0],
  parseMarkdown: {
    match: (node: MdastNode) => node.type === BACKSLASH_HARD_BREAK_SOURCE_TEXT_NODE_TYPE,
    runner: (state: any, node: MdastNode, markType: any) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark: any) => mark.type.name === BACKSLASH_HARD_BREAK_SOURCE_TEXT_MARK_NAME,
    runner: () => true,
  },
}));

function isBackslashHardBreakSourceTextNode(node: ProseNode | null | undefined): boolean {
  return Boolean(
    node?.isText
    && node.text === '\\'
    && node.marks.some((mark) => mark.type.name === BACKSLASH_HARD_BREAK_SOURCE_TEXT_MARK_NAME),
  );
}

function isNonInlineHardBreakNode(node: ProseNode | null | undefined): boolean {
  return node?.type.name === 'hardbreak' && node.attrs?.isInline !== true;
}

export function findBackslashHardBreakArrowLeftTarget(doc: ProseNode, pos: number): number | null {
  if (pos < 0 || pos > doc.content.size) return null;

  const $pos = doc.resolve(pos);
  const parent = $pos.parent;
  if (!parent.inlineContent) return null;

  const parentStart = $pos.start();
  let childStart = parentStart;

  for (let index = 0; index < parent.childCount; index += 1) {
    const child = parent.child(index);
    const childEnd = childStart + child.nodeSize;
    const previous = index > 0 ? parent.child(index - 1) : null;
    const previousStart = previous ? childStart - previous.nodeSize : null;
    const next = index + 1 < parent.childCount ? parent.child(index + 1) : null;

    if (
      pos === childEnd
      && isNonInlineHardBreakNode(child)
      && isBackslashHardBreakSourceTextNode(previous)
      && previousStart !== null
    ) {
      return previousStart;
    }

    if (
      pos === childStart
      && isNonInlineHardBreakNode(child)
      && isBackslashHardBreakSourceTextNode(previous)
      && previousStart !== null
    ) {
      return previousStart;
    }

    if (
      pos === childEnd
      && isBackslashHardBreakSourceTextNode(child)
      && isNonInlineHardBreakNode(next)
    ) {
      return childStart;
    }

    childStart = childEnd;
  }

  return null;
}

function handleBackslashHardBreakArrowLeft(view: EditorView, event: KeyboardEvent): boolean {
  if (
    event.key !== 'ArrowLeft'
    || event.shiftKey
    || event.altKey
    || event.metaKey
    || event.ctrlKey
    || !view.state.selection.empty
  ) {
    return false;
  }

  const target = findBackslashHardBreakArrowLeftTarget(view.state.doc, view.state.selection.from);
  if (target === null) return false;

  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === 'function') {
    event.stopImmediatePropagation();
  }
  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.create(view.state.doc, target))
      .scrollIntoView(),
  );
  return true;
}

function isEditorKeyboardEvent(view: EditorView, event: KeyboardEvent): boolean {
  const target = event.target;
  if (target instanceof Node && (target === view.dom || view.dom.contains(target))) {
    return true;
  }

  const selection = document.getSelection();
  return Boolean(
    view.hasFocus()
    || (
      selection
      && (
        (selection.anchorNode && view.dom.contains(selection.anchorNode))
        || (selection.focusNode && view.dom.contains(selection.focusNode))
      )
    )
  );
}

export function findBackslashHardBreakBlankClickTarget(view: EditorView, event: MouseEvent): number | null {
  if (
    event.button !== 0
    || event.shiftKey
    || event.altKey
    || event.metaKey
    || event.ctrlKey
  ) {
    return null;
  }

  const { doc } = view.state;
  let target: number | null = null;

  doc.descendants((node, pos) => {
    if (target !== null) return false;
    if (!node.inlineContent) return true;

    let childStart = pos + 1;
    for (let index = 0; index < node.childCount; index += 1) {
      const child = node.child(index);
      const childEnd = childStart + child.nodeSize;
      const next = index + 1 < node.childCount ? node.child(index + 1) : null;

      if (
        isBackslashHardBreakSourceTextNode(child)
        && isNonInlineHardBreakNode(next)
      ) {
        const coords = view.coordsAtPos(childEnd);
        const verticalTolerance = Math.max(4, (coords.bottom - coords.top) / 2);
        if (
          event.clientX >= coords.left - 1
          && event.clientY >= coords.top - verticalTolerance
          && event.clientY <= coords.bottom + verticalTolerance
        ) {
          target = childEnd;
          return false;
        }
      }

      childStart = childEnd;
    }

    return true;
  });

  return target;
}

export const backslashHardBreakCursorPlugin = $prose(() => new Plugin({
  key: backslashHardBreakCursorPluginKey,
  view(view) {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isEditorKeyboardEvent(view, event)) return;
      handleBackslashHardBreakArrowLeft(view, event);
    };

    view.dom.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return {
      destroy() {
        view.dom.removeEventListener('keydown', handleKeyDown, true);
        document.removeEventListener('keydown', handleKeyDown, true);
      },
    };
  },
  props: {
    handleDOMEvents: {
      mousedown(view, event) {
        if (!(event instanceof MouseEvent)) return false;

        const target = findBackslashHardBreakBlankClickTarget(view, event);
        if (target === null) return false;

        event.preventDefault();
        event.stopPropagation();
        view.dispatch(
          view.state.tr
            .setSelection(TextSelection.create(view.state.doc, target))
            .scrollIntoView(),
        );
        view.focus();
        return true;
      },
    },
    handleKeyDown(view, event) {
      return handleBackslashHardBreakArrowLeft(view, event);
    },
  },
}));

export const backslashHardBreakTextPlugins = [
  backslashHardBreakTextPlugin,
  backslashHardBreakSourceTextMark,
  backslashHardBreakCursorPlugin,
];
