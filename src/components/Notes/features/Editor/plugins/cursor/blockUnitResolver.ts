import type { EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';
import { resolveBlockElementAtPos } from './topLevelBlockDom';

export interface SelectableBlockTarget {
  range: BlockRange;
  element: HTMLElement;
  rect: DOMRect;
}

function isListContainerNode(name: string): boolean {
  return name === 'bullet_list' || name === 'ordered_list';
}

export function collectSelectableBlockRanges(doc: EditorState['doc']): BlockRange[] {
  const ranges: BlockRange[] = [];
  doc.forEach((node, offset) => {
    if (isListContainerNode(node.type.name)) {
      node.forEach((child, childOffset) => {
        if (child.type.name !== 'list_item') return;
        const from = offset + 1 + childOffset;
        ranges.push({
          from,
          to: from + child.nodeSize,
        });
      });
      return;
    }

    ranges.push({
      from: offset,
      to: offset + node.nodeSize,
    });
  });
  return ranges;
}

export function resolveSelectableBlockRange(doc: EditorState['doc'], pos: number): BlockRange | null {
  const ranges = collectSelectableBlockRanges(doc);
  if (ranges.length === 0) return null;

  const docSize = doc.content.size;
  const safePos = Math.max(0, Math.min(pos, docSize));
  for (const range of ranges) {
    if (safePos >= range.from && safePos < range.to) return range;
    if (safePos < range.from) return range;
  }
  return ranges[ranges.length - 1];
}

export function mapRangesToSelectableBlocks(
  doc: EditorState['doc'],
  ranges: readonly BlockRange[],
): BlockRange[] {
  if (ranges.length === 0) return [];
  const resolved = ranges
    .map((range) => resolveSelectableBlockRange(doc, range.from))
    .filter((range): range is BlockRange => range !== null);
  return normalizeBlockRanges(resolved);
}

export function resolveSelectableBlockTargetByPos(view: EditorView, blockPos: number): SelectableBlockTarget | null {
  const range = resolveSelectableBlockRange(view.state.doc, blockPos);
  if (!range) return null;

  const element = resolveBlockElementAtPos(view, range.from);
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { range, element, rect };
}

export function collectSelectableBlockTargets(
  view: EditorView,
  ranges?: readonly BlockRange[],
): SelectableBlockTarget[] {
  const targetRanges = ranges
    ? mapRangesToSelectableBlocks(view.state.doc, ranges)
    : collectSelectableBlockRanges(view.state.doc);
  if (targetRanges.length === 0) return [];

  const unique = new Set<HTMLElement>();
  const targets: SelectableBlockTarget[] = [];
  for (const range of targetRanges) {
    const element = resolveBlockElementAtPos(view, range.from);
    if (!element || unique.has(element)) continue;

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;

    unique.add(element);
    targets.push({ range, element, rect });
  }
  return targets;
}
