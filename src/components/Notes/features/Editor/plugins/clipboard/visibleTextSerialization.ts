import type { Slice } from '@milkdown/kit/prose/model';

import {
  consumeClipboardTraversalNode,
  createClipboardTraversalBudget,
  getProseNodeChildren,
  type ClipboardTraversalBudget,
} from './clipboardTraversalBudget';
import { isBackslashHardBreakSourceTextNode } from '../hard-break/backslashHardBreakNodes';

function isHardBreakNodeName(name: string | undefined): boolean {
  return name === 'hardbreak' || name === 'hard_break';
}

function isVisiblePlainTextNodeWithBudget(
  node: any,
  budget: ClipboardTraversalBudget,
  depth: number
): boolean {
  if (!consumeClipboardTraversalNode(budget, depth)) return false;
  if (!node) return true;
  if (node.isText) return true;
  if (isHardBreakNodeName(node.type?.name)) return true;
  if (!node.isTextblock && !['paragraph', 'heading', 'code_block'].includes(node.type?.name)) return false;

  return getProseNodeChildren(node).every((child) => (
    isVisiblePlainTextNodeWithBudget(child, budget, depth + 1)
  ));
}

export function isVisiblePlainTextNode(node: any): boolean {
  return isVisiblePlainTextNodeWithBudget(node, createClipboardTraversalBudget(), 0);
}

function serializeVisiblePlainTextNode(
  node: any,
  budget: ClipboardTraversalBudget,
  depth: number
): string | null {
  if (!consumeClipboardTraversalNode(budget, depth)) return null;
  if (!node) return '';
  if (node.isText) return node.text ?? '';
  if (isHardBreakNodeName(node.type?.name)) return '\n';

  const pieces: string[] = [];
  const children = getProseNodeChildren(node);
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const next = children[index + 1];
    if (
      isBackslashHardBreakSourceTextNode(child)
      && isHardBreakNodeName(next?.type?.name)
    ) {
      continue;
    }

    if (isHardBreakNodeName(child.type?.name)) {
      pieces.push('\n');
      continue;
    }

    const piece = serializeVisiblePlainTextNode(child, budget, depth + 1);
    if (piece === null) return null;
    pieces.push(piece);
  }
  return pieces.join('');
}

export function serializeSliceAsVisiblePlainText(slice: Pick<Slice, 'content'>): string {
  const budget = createClipboardTraversalBudget();
  const pieces: string[] = [];
  const children = getProseNodeChildren({ content: slice.content });
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const next = children[index + 1];
    if (
      isBackslashHardBreakSourceTextNode(child)
      && isHardBreakNodeName(next?.type?.name)
    ) {
      continue;
    }

    const piece = serializeVisiblePlainTextNode(child, budget, 0);
    if (piece === null) return '';
    pieces.push(piece);
  }
  return pieces.join('\n').replace(/\n+$/, '');
}

export function isVisiblePlainTextSlice(slice: Pick<Slice, 'content'>): boolean {
  const budget = createClipboardTraversalBudget();
  return getProseNodeChildren({ content: slice.content }).every((child) => (
    isVisiblePlainTextNodeWithBudget(child, budget, 0)
  ));
}
