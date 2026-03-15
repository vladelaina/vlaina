import { remarkPluginsCtx, schemaTimerCtx } from '@milkdown/core';
import { createTimer, type MilkdownPlugin } from '@milkdown/ctx';
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

function isAlignableNode(node: AlignmentAwareMdastNode | undefined): node is AlignmentAwareMdastNode {
  return !!node && (node.type === 'paragraph' || node.type === 'heading');
}

function visitAlignmentComments(node: AlignmentAwareMdastNode): void {
  if (!node.children?.length) {
    return;
  }

  const nextChildren: AlignmentAwareMdastNode[] = [];

  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index];
    const childAlignment = extractTextAlignmentComment(child.value);

    if (childAlignment) {
      const previousSibling = nextChildren[nextChildren.length - 1];
      const nextSibling = node.children[index + 1];

      if (isAlignableNode(previousSibling) && !isTextAlignment(previousSibling.align)) {
        previousSibling.align = childAlignment;
      } else if (isAlignableNode(nextSibling) && !isTextAlignment(nextSibling.align)) {
        nextSibling.align = childAlignment;
      }

      continue;
    }

    visitAlignmentComments(child);
    nextChildren.push(child);
  }

  node.children = nextChildren;
}

export function applyAlignmentCommentsToTree(tree: AlignmentAwareMdastNode): void {
  visitAlignmentComments(tree);
}

function remarkBlockAlignment() {
  return (tree: unknown) => {
    applyAlignmentCommentsToTree(tree as AlignmentAwareMdastNode);
  };
}

const blockAlignmentRemarkReady = createTimer('blockAlignmentRemarkReady');

export const remarkBlockAlignmentPlugin: MilkdownPlugin = (ctx) => {
  ctx.record(blockAlignmentRemarkReady);
  ctx.update(schemaTimerCtx, (timers) => timers.concat(blockAlignmentRemarkReady));

  return async () => {
    const remarkPlugin = {
      plugin: remarkBlockAlignment,
      options: undefined,
    };

    ctx.update(remarkPluginsCtx, (plugins) => plugins.concat(remarkPlugin as any));
    ctx.done(blockAlignmentRemarkReady);

    return () => {
      ctx.update(remarkPluginsCtx, (plugins) => plugins.filter((plugin) => plugin !== remarkPlugin));
      ctx.update(schemaTimerCtx, (timers) => timers.filter((timer) => timer !== blockAlignmentRemarkReady));
      ctx.clearTimer(blockAlignmentRemarkReady);
    };
  };
};

export const blockAlignmentPlugin = [remarkBlockAlignmentPlugin].flat();
