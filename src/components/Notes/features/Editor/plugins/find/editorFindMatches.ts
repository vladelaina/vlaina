import type { Node as ProseNode } from '@milkdown/kit/prose/model';

export interface EditorFindRange {
  from: number;
  to: number;
}

export interface EditorFindMatch extends EditorFindRange {
  ranges: EditorFindRange[];
}

interface BlockSegment extends EditorFindRange {
  text: string;
  startOffset: number;
}

interface SearchableBlock {
  text: string;
  segments: BlockSegment[];
}

function appendInlineSegments(
  node: ProseNode,
  pos: number,
  segments: BlockSegment[],
  offsetRef: { value: number },
) {
  if (node.isText) {
    const text = node.text ?? '';
    if (!text) {
      return;
    }

    segments.push({
      from: pos,
      to: pos + text.length,
      text,
      startOffset: offsetRef.value,
    });
    offsetRef.value += text.length;
    return;
  }

  node.forEach((child, offset) => {
    appendInlineSegments(child as ProseNode, pos + 1 + offset, segments, offsetRef);
  });
}

function collectSearchableBlocks(
  node: ProseNode,
  pos = -1,
  blocks: SearchableBlock[] = [],
): SearchableBlock[] {
  if (node.isTextblock) {
    const segments: BlockSegment[] = [];
    const offsetRef = { value: 0 };

    node.forEach((child, offset) => {
      appendInlineSegments(child as ProseNode, pos + 1 + offset, segments, offsetRef);
    });

    if (segments.length > 0) {
      blocks.push({
        text: segments.map((segment) => segment.text).join(''),
        segments,
      });
    }

    return blocks;
  }

  node.forEach((child, offset) => {
    collectSearchableBlocks(child as ProseNode, pos + 1 + offset, blocks);
  });

  return blocks;
}

function createMatchFromOffsets(
  segments: BlockSegment[],
  startOffset: number,
  endOffset: number,
): EditorFindMatch {
  const ranges: EditorFindRange[] = [];

  for (const segment of segments) {
    const segmentStart = segment.startOffset;
    const segmentEnd = segment.startOffset + segment.text.length;
    const overlapStart = Math.max(startOffset, segmentStart);
    const overlapEnd = Math.min(endOffset, segmentEnd);

    if (overlapStart >= overlapEnd) {
      continue;
    }

    ranges.push({
      from: segment.from + overlapStart - segmentStart,
      to: segment.from + overlapEnd - segmentStart,
    });
  }

  if (ranges.length === 0) {
    throw new Error('Editor find match could not be mapped back to document ranges.');
  }

  return {
    from: ranges[0].from,
    to: ranges[ranges.length - 1].to,
    ranges,
  };
}

export function buildEditorFindMatches(doc: ProseNode, query: string): EditorFindMatch[] {
  if (query.length === 0) {
    return [];
  }

  const normalizedQuery = query.toLocaleLowerCase();
  const matches: EditorFindMatch[] = [];

  for (const block of collectSearchableBlocks(doc)) {
    const normalizedText = block.text.toLocaleLowerCase();
    let searchFrom = 0;

    while (searchFrom <= normalizedText.length - normalizedQuery.length) {
      const matchIndex = normalizedText.indexOf(normalizedQuery, searchFrom);
      if (matchIndex === -1) {
        break;
      }

      matches.push(
        createMatchFromOffsets(block.segments, matchIndex, matchIndex + normalizedQuery.length),
      );
      searchFrom = matchIndex + Math.max(1, normalizedQuery.length);
    }
  }

  return matches;
}

export function resolveEditorFindStartIndex(
  matches: EditorFindMatch[],
  selectionFrom: number,
): number {
  if (matches.length === 0) {
    return -1;
  }

  const nextIndex = matches.findIndex((match) => match.to >= selectionFrom);
  return nextIndex === -1 ? 0 : nextIndex;
}

export function resolveEditorFindIndexAfterDocChange(
  matches: EditorFindMatch[],
  previousMatch: EditorFindMatch | null,
  selectionFrom: number,
): number {
  if (matches.length === 0) {
    return -1;
  }

  if (!previousMatch) {
    return resolveEditorFindStartIndex(matches, selectionFrom);
  }

  const exactIndex = matches.findIndex(
    (match) => match.from === previousMatch.from && match.to === previousMatch.to,
  );
  if (exactIndex !== -1) {
    return exactIndex;
  }

  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  matches.forEach((match, index) => {
    const distance = Math.abs(match.from - previousMatch.from);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}

export function normalizeEditorFindActiveIndex(index: number, count: number): number {
  if (count === 0) {
    return -1;
  }

  const remainder = index % count;
  return remainder >= 0 ? remainder : remainder + count;
}
