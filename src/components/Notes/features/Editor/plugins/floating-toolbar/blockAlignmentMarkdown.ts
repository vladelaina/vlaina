import { $remark } from '@milkdown/kit/utils';
import type { TextAlignment } from './types';

interface AlignmentAwareMdastNode {
  type: string;
  value?: string;
  children?: AlignmentAwareMdastNode[];
  align?: TextAlignment;
  depth?: number;
}

const ALIGNMENT_COMMENT_PATTERN = /^<!--\s*align:(left|center|right)\s*-->$/;

export function isTextAlignment(value: unknown): value is TextAlignment {
  return value === 'left' || value === 'center' || value === 'right';
}

export function getTextAlignmentComment(alignment: TextAlignment): string {
  return `<!--align:${alignment}-->`;
}

export function extractTextAlignmentComment(value: unknown): TextAlignment | null {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.trim().match(ALIGNMENT_COMMENT_PATTERN);
  if (!match) {
    return null;
  }

  return match[1] as TextAlignment;
}

export function readMarkdownNodeAlignment(node: { align?: unknown } | null | undefined): TextAlignment {
  if (node && isTextAlignment(node.align)) {
    return node.align;
  }

  return 'left';
}

function isAlignableNode(node: AlignmentAwareMdastNode): boolean {
  return node.type === 'paragraph' || node.type === 'heading';
}

function visitAlignmentComments(node: AlignmentAwareMdastNode): void {
  if (!node.children?.length) {
    return;
  }

  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index];
    const nextSibling = node.children[index + 1];
    const alignment = extractTextAlignmentComment(nextSibling?.value);

    if (alignment && isAlignableNode(child)) {
      child.align = alignment;
      node.children.splice(index + 1, 1);
    }

    visitAlignmentComments(child);
  }
}

function remarkBlockAlignment() {
  return (tree: unknown) => {
    visitAlignmentComments(tree as AlignmentAwareMdastNode);
  };
}

export const remarkBlockAlignmentPlugin = $remark(
  'remarkBlockAlignment',
  () => remarkBlockAlignment
);

export const blockAlignmentPlugin = [remarkBlockAlignmentPlugin].flat();
