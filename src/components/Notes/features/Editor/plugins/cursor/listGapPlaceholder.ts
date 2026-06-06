import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { createBlockRectResolver } from './blockRectResolver';
import { blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION } from './blockSelectionPluginState';
import {
  isSameEditorScrollRoot,
  resolvePosAtCoordsForBlankClick,
  SCROLL_ROOT_SELECTOR,
} from './blankAreaInteractionUtils';

const EDITABLE_LIST_GAP_PLACEHOLDER = '\u2800';
export const MAX_LIST_GAP_TEXT_HIT_CHARS = 100_000;
export const MAX_LIST_GAP_TEXT_HIT_NODES = 512;
export const MAX_LIST_GAP_TEXT_HIT_RECTS = 1024;

export function resolvePointInsideActualText(root: HTMLElement, clientX: number, clientY: number): boolean | null {
  if ((root.textContent?.length ?? 0) > MAX_LIST_GAP_TEXT_HIT_CHARS) {
    return null;
  }

  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || parent.closest('[contenteditable="false"]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let measuredTextNodes = 0;
  let measuredRects = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    measuredTextNodes += 1;
    if (measuredTextNodes > MAX_LIST_GAP_TEXT_HIT_NODES) {
      return null;
    }

    const range = doc.createRange();
    try {
      range.selectNodeContents(node);
      const rects = range.getClientRects();

      for (let index = 0; index < rects.length; index += 1) {
        measuredRects += 1;
        if (measuredRects > MAX_LIST_GAP_TEXT_HIT_RECTS) {
          return null;
        }

        const rect = rects[index];
        if (!rect || rect.width <= 0 || rect.height <= 0) continue;
        const verticalSlack = Math.max(2, Math.min(5, rect.height * 0.15));
        if (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top - verticalSlack &&
          clientY <= rect.bottom + verticalSlack
        ) {
          return true;
        }
      }
    } finally {
      range.detach();
    }
  }

  return false;
}

function shouldResolveNearbyListGapPlaceholder(view: EditorView, event: MouseEvent): boolean {
  const target = event.target instanceof HTMLElement ? event.target : event.target instanceof Node ? event.target.parentElement : null;
  if (!target || !view.dom.contains(target)) return true;
  const textBlock = target.closest('p, li') as HTMLElement | null;
  if (!textBlock || !view.dom.contains(textBlock)) return true;
  return resolvePointInsideActualText(textBlock, event.clientX, event.clientY) === false;
}

function isListGapPlaceholderText(text: string): boolean {
  return text.replace(new RegExp(EDITABLE_LIST_GAP_PLACEHOLDER, 'g'), '').trim().length === 0
    && text.includes(EDITABLE_LIST_GAP_PLACEHOLDER);
}

function findListGapPlaceholderParagraphStartInListItem(listItem: { type: { name: string }; childCount: number; child: (index: number) => { type: { name: string }; nodeSize: number; textContent: string } }, listItemStart: number): number | null {
  if (listItem.type.name !== 'list_item') return null;
  let childStart = listItemStart + 1;
  for (let index = 0; index < listItem.childCount; index += 1) {
    const child = listItem.child(index);
    if (child.type.name === 'paragraph' && isListGapPlaceholderText(child.textContent)) {
      return childStart;
    }
    childStart += child.nodeSize;
  }
  return null;
}

function findListGapPlaceholderParagraphStart(view: EditorView, pos: number): number | null {
  const docSize = view.state.doc.content.size;
  const safePos = Math.max(0, Math.min(pos, docSize));
  const $pos = view.state.doc.resolve(safePos);
  const afterStart = $pos.nodeAfter
    ? findListGapPlaceholderParagraphStartInListItem($pos.nodeAfter, safePos)
    : null;
  if (afterStart !== null) return afterStart;
  if (
    $pos.nodeAfter?.type.name === 'paragraph'
    && isListGapPlaceholderText($pos.nodeAfter.textContent)
  ) {
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      if ($pos.node(depth).type.name === 'list_item') {
        return safePos;
      }
    }
  }

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (node.type.name !== 'paragraph') continue;
    if (!isListGapPlaceholderText(node.textContent)) continue;

    for (let parentDepth = depth - 1; parentDepth > 0; parentDepth -= 1) {
      if ($pos.node(parentDepth).type.name === 'list_item') {
        return $pos.before(depth);
      }
    }
  }

  return null;
}

function resolveListGapPlaceholderFromNearbyBlock(view: EditorView, event: MouseEvent): number | null {
  const resolver = createBlockRectResolver({
    view,
    scrollRootSelector: SCROLL_ROOT_SELECTOR,
  });
  const blockRects = resolver.getTopLevelBlockRects();
  resolver.invalidate();

  let nearestParagraphStart: number | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const block of blockRects) {
    const paragraphStart = findListGapPlaceholderParagraphStart(view, block.from)
      ?? findListGapPlaceholderParagraphStart(view, block.from + 1);
    if (paragraphStart === null) continue;

    const distance = event.clientY < block.top
      ? block.top - event.clientY
      : event.clientY > block.bottom
        ? event.clientY - block.bottom
        : 0;
    if (distance > nearestDistance) continue;

    nearestParagraphStart = paragraphStart;
    nearestDistance = distance;
  }

  const maxDistance = shouldResolveNearbyListGapPlaceholder(view, event) ? 32 : 12;
  if (nearestParagraphStart === null || nearestDistance > maxDistance) {
    return null;
  }

  return nearestParagraphStart;
}

export function handleListGapPlaceholderPointerDown(view: EditorView, event: MouseEvent): boolean {
  if (!isSameEditorScrollRoot(view, event.target)) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;

  const coords = resolvePosAtCoordsForBlankClick(view, event);
  if (!coords) {
    return false;
  }

  const paragraphStart = findListGapPlaceholderParagraphStart(view, coords.pos)
    ?? resolveListGapPlaceholderFromNearbyBlock(view, event);
  if (paragraphStart === null) return false;

  const targetPos = Math.min(paragraphStart + 1, view.state.doc.content.size);
  const selection = TextSelection.create(view.state.doc, targetPos);
  event.preventDefault();
  view.dispatch(view.state.tr.setSelection(selection).setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION));
  view.focus();
  return true;
}
