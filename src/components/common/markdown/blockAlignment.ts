import { canTransformMarkdownAst } from './markdownAstBudget';

export type TextAlignment = 'left' | 'center' | 'right';

export interface AlignmentAwareMdastNode {
  type: string;
  value?: string;
  children?: AlignmentAwareMdastNode[];
  align?: TextAlignment;
  data?: {
    hProperties?: Record<string, unknown>;
  };
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

function isAlignableNode(node: AlignmentAwareMdastNode | undefined): node is AlignmentAwareMdastNode {
  return !!node && (node.type === 'paragraph' || node.type === 'heading');
}

function applyAlignmentToNode(node: AlignmentAwareMdastNode, alignment: TextAlignment): void {
  node.align = alignment;
  if (alignment === 'left') return;

  node.data = {
    ...(node.data || {}),
    hProperties: {
      ...(node.data?.hProperties || {}),
      dataTextAlign: alignment,
      style: `text-align: ${alignment}`,
    },
  };
}

function visitAlignmentComments(node: AlignmentAwareMdastNode): void {
  if (!node.children?.length) {
    return;
  }

  const nextChildren: AlignmentAwareMdastNode[] = [];

  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index];
    const childAlignment = child.type === 'html'
      ? extractTextAlignmentComment(child.value)
      : null;

    if (childAlignment) {
      const previousSibling = nextChildren[nextChildren.length - 1];
      const nextSibling = node.children[index + 1];

      if (isAlignableNode(previousSibling) && !isTextAlignment(previousSibling.align)) {
        applyAlignmentToNode(previousSibling, childAlignment);
      } else if (isAlignableNode(nextSibling) && !isTextAlignment(nextSibling.align)) {
        applyAlignmentToNode(nextSibling, childAlignment);
      }

      continue;
    }

    visitAlignmentComments(child);
    nextChildren.push(child);
  }

  node.children = nextChildren;
}

export function applyAlignmentCommentsToTree(tree: AlignmentAwareMdastNode): void {
  if (!canTransformMarkdownAst(tree)) {
    return;
  }

  visitAlignmentComments(tree);
}

export function remarkBlockAlignment() {
  return (tree: unknown) => {
    applyAlignmentCommentsToTree(tree as AlignmentAwareMdastNode);
  };
}
