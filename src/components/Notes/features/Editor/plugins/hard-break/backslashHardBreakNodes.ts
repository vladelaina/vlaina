import type { Node as ProseNode } from '@milkdown/kit/prose/model';

export const BACKSLASH_HARD_BREAK_TEXT_DATA_FIELD = 'vlainaBackslashHardBreakText';
export const BACKSLASH_HARD_BREAK_SOURCE_TEXT_NODE_TYPE = 'vlainaBackslashHardBreakSourceText';
export const BACKSLASH_HARD_BREAK_SOURCE_TEXT_MARK_NAME = 'backslash_hard_break_source_text';

export function isBackslashHardBreakSourceTextNode(node: ProseNode | null | undefined): boolean {
  return Boolean(
    node?.isText
    && node.text === '\\'
    && node.marks.some((mark) => mark.type.name === BACKSLASH_HARD_BREAK_SOURCE_TEXT_MARK_NAME),
  );
}

export function isNonInlineHardBreakNode(node: ProseNode | null | undefined): boolean {
  return node?.type.name === 'hardbreak' && node.attrs?.isInline !== true;
}
