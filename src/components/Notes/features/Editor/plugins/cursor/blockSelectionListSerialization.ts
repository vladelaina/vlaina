import type { EditorState } from '@milkdown/kit/prose/state';
import { LIST_CONTAINER_NODE_NAMES } from '../shared/blockNodeTypes';
import type { BlockRange } from './blockSelectionUtils';

export const LIST_ITEM_MARKER_PATTERN = /^\s*(?:[-+*]|\d+[.)])(?:\s+(?:\[(?: |x|X)\]\s+)?|$)/;
export const ORDERED_LIST_ITEM_MARKER_PATTERN = /^(\s*)(\d+)([.)])(\s+(?:\[(?: |x|X)\]\s+)?|(?=$))/;
const ORDERED_LIST_ORDER_PATTERN = /^-?\d+$/;

export function getNodeChildren(node: any): any[] {
  const children: any[] = [];
  node?.content?.forEach?.((child: any) => {
    children.push(child);
  });
  return children;
}

export function resolveTopLevelBlockInfo(
  doc: EditorState['doc'],
  pos: number,
): { from: number; to: number; name: string } | null {
  let resolved: { from: number; to: number; name: string } | null = null;

  doc.forEach((node, offset) => {
    if (resolved) return;
    const from = offset;
    const to = offset + node.nodeSize;
    if (pos < from || pos >= to) return;
    resolved = { from, to, name: node.type.name };
  });

  return resolved;
}

export function resolveContainingListContainerInfo(
  doc: EditorState['doc'],
  pos: number,
): { from: number; to: number; name: string } | null {
  try {
    const safePos = Math.max(0, Math.min(pos, doc.content.size));
    const $pos = doc.resolve(safePos);

    for (let depth = $pos.depth; depth >= 0; depth -= 1) {
      const node = $pos.node(depth);
      if (!isListContainerName(node.type.name)) continue;

      return {
        from: depth === 0 ? 0 : $pos.before(depth),
        to: depth === 0 ? doc.content.size : $pos.after(depth),
        name: node.type.name,
      };
    }

    const nodeAfter = $pos.nodeAfter;
    if (nodeAfter && isListContainerName(nodeAfter.type.name)) {
      return {
        from: safePos,
        to: safePos + nodeAfter.nodeSize,
        name: nodeAfter.type.name,
      };
    }
  } catch {
  }

  return null;
}

function isListContainerName(name: string): boolean {
  return LIST_CONTAINER_NODE_NAMES.has(name);
}

function normalizeOrderedListOrder(value: unknown): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && ORDERED_LIST_ORDER_PATTERN.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  if (!Number.isSafeInteger(parsed)) return 1;
  return parsed;
}

export function renumberOrderedListMarker(text: string, number: number): string {
  return text.replace(
    ORDERED_LIST_ITEM_MARKER_PATTERN,
    (_match, indent: string, _oldNumber: string, delimiter: string, suffix: string) =>
      `${indent}${number}${delimiter}${suffix}`
  );
}

export function resolveOrderedListItemNumber(
  doc: EditorState['doc'],
  pos: number,
): number | null {
  const listContainer = resolveContainingListContainerInfo(doc, pos);
  const listItem = resolveContainingListItemInfo(doc, pos);
  if (!listContainer || listContainer.name !== 'ordered_list' || !listItem) return null;

  try {
    const listNode = doc.resolve(listContainer.from).nodeAfter;
    if (!listNode || listNode.type.name !== 'ordered_list') return null;

    const start = normalizeOrderedListOrder(listNode.attrs?.order);
    let index = 0;
    let foundIndex: number | null = null;
    listNode.forEach((child: any, offset: number) => {
      if (foundIndex !== null || child?.type?.name !== 'list_item') return;
      const childFrom = listContainer.from + 1 + offset;
      if (childFrom === listItem.from) {
        foundIndex = index;
        return;
      }
      index += 1;
    });

    return foundIndex === null ? null : start + foundIndex;
  } catch {
    return null;
  }
}

export function resolveListItemNodeAtRangeStart(
  state: EditorState,
  range: BlockRange,
): any | null {
  try {
    const safeFrom = Math.max(0, Math.min(range.from, state.doc.content.size));
    const node = state.doc.resolve(safeFrom).nodeAfter;
    return node?.type?.name === 'list_item' ? node : null;
  } catch {
    return null;
  }
}

export function resolveContainingListItemAtRange(
  state: EditorState,
  range: BlockRange,
): any | null {
  try {
    const safeFrom = Math.max(0, Math.min(range.from, state.doc.content.size));
    const $from = state.doc.resolve(safeFrom);

    if ($from.nodeAfter?.type?.name === 'list_item') {
      return $from.nodeAfter;
    }

    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth);
      if (node.type.name !== 'list_item') continue;

      const nodeFrom = $from.before(depth);
      if (nodeFrom <= safeFrom) {
        return node;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function resolveContainingListItemInfo(
  doc: EditorState['doc'],
  pos: number,
): { from: number; to: number } | null {
  try {
    const safePos = Math.max(0, Math.min(pos, doc.content.size));
    const $pos = doc.resolve(safePos);

    if ($pos.nodeAfter?.type?.name === 'list_item') {
      return { from: safePos, to: safePos + $pos.nodeAfter.nodeSize };
    }

    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      const node = $pos.node(depth);
      if (node.type.name !== 'list_item') continue;
      return { from: $pos.before(depth), to: $pos.after(depth) };
    }
  } catch {
  }

  return null;
}

export function stripSingleListBlockMarker(text: string): string {
  const lines = text.split('\n');
  let firstLine = lines[0] ?? '';
  let previous = '';
  while (firstLine !== previous) {
    previous = firstLine;
    firstLine = firstLine.replace(LIST_ITEM_MARKER_PATTERN, '');
  }
  lines[0] = firstLine;
  return lines.join('\n');
}

export function stripOuterListBlockMarkers(text: string): string {
  const lines = text.split('\n');
  let firstLine = lines[0] ?? '';

  while (LIST_ITEM_MARKER_PATTERN.test(firstLine)) {
    const withoutOuterMarker = firstLine.replace(LIST_ITEM_MARKER_PATTERN, '');
    if (withoutOuterMarker === firstLine || !LIST_ITEM_MARKER_PATTERN.test(withoutOuterMarker)) {
      break;
    }
    firstLine = withoutOuterMarker;
  }

  lines[0] = firstLine;
  return lines.join('\n');
}

export function isNestedListRange(state: EditorState, range: BlockRange): boolean {
  try {
    if (typeof state.doc?.forEach !== 'function' || typeof state.doc?.resolve !== 'function') {
      return false;
    }
    const topLevel = resolveTopLevelBlockInfo(state.doc, range.from);
    const listContainer = resolveContainingListContainerInfo(state.doc, range.from);
    return Boolean(
      topLevel
      && listContainer
      && isListContainerName(topLevel.name)
      && (topLevel.from !== listContainer.from || topLevel.to !== listContainer.to)
    );
  } catch {
    return false;
  }
}
