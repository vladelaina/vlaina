import { $mark, $remark } from '@milkdown/kit/utils';
import { backslashHardBreakCursorPlugin } from './backslashHardBreakCursor';
import {
  BACKSLASH_HARD_BREAK_SOURCE_TEXT_MARK_NAME,
  BACKSLASH_HARD_BREAK_SOURCE_TEXT_NODE_TYPE,
  BACKSLASH_HARD_BREAK_TEXT_DATA_FIELD,
} from './backslashHardBreakNodes';

export {
  backslashHardBreakCursorPlugin,
  backslashHardBreakCursorPluginKey,
  findBackslashHardBreakArrowLeftTarget,
  findBackslashHardBreakBlankClickTarget,
} from './backslashHardBreakCursor';

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

export const backslashHardBreakTextPlugins = [
  backslashHardBreakTextPlugin,
  backslashHardBreakSourceTextMark,
  backslashHardBreakCursorPlugin,
];
