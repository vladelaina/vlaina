import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT } from '../shared/boundedProseNodeScan';

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

interface NormalizedSearchText {
  text: string;
  startOffsets: number[];
  endOffsets: number[];
}

export const MAX_EDITOR_FIND_MATCHES = 20_000;
export const MAX_EDITOR_FIND_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;

function appendInlineSegments(
  node: ProseNode,
  pos: number,
  segments: BlockSegment[],
  offsetRef: { value: number },
  budget: { scannedNodes: number; stopped: boolean },
) {
  if (budget.stopped) {
    return;
  }

  budget.scannedNodes += 1;
  if (budget.scannedNodes > MAX_EDITOR_FIND_SCAN_NODES) {
    budget.stopped = true;
    return;
  }

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
    appendInlineSegments(child as ProseNode, pos + 1 + offset, segments, offsetRef, budget);
  });
}

function appendMatchesForBlock(
  block: SearchableBlock,
  normalizedQuery: string,
  matches: EditorFindMatch[],
) {
  const normalized = normalizeSearchTextWithOffsets(block.text);
  const normalizedText = normalized.text;
  let searchFrom = 0;

  while (searchFrom <= normalizedText.length - normalizedQuery.length) {
    const matchIndex = normalizedText.indexOf(normalizedQuery, searchFrom);
    if (matchIndex === -1) {
      break;
    }

    matches.push(
      createMatchFromOffsets(
        block.segments,
        normalized.startOffsets[matchIndex] ?? 0,
        normalized.endOffsets[matchIndex + normalizedQuery.length] ?? block.text.length,
      ),
    );
    if (matches.length >= MAX_EDITOR_FIND_MATCHES) {
      return;
    }
    searchFrom = matchIndex + Math.max(1, normalizedQuery.length);
  }
}

function normalizeSearchTextWithOffsets(value: string): NormalizedSearchText {
  let text = '';
  const startOffsets: number[] = [];
  const endOffsets: number[] = [0];

  for (let index = 0; index < value.length;) {
    const codePoint = value.codePointAt(index);
    const source = codePoint === undefined ? value[index] : String.fromCodePoint(codePoint);
    const sourceLength = source.length;
    const sourceEnd = index + sourceLength;
    const normalized = source.toLocaleLowerCase();
    const normalizedStart = text.length;

    for (let offset = 0; offset < normalized.length; offset += 1) {
      startOffsets[normalizedStart + offset] = index;
      endOffsets[normalizedStart + offset + 1] = sourceEnd;
    }

    text += normalized;
    index = sourceEnd;
  }

  startOffsets[text.length] = value.length;
  endOffsets[text.length] = value.length;

  return { text, startOffsets, endOffsets };
}

function collectSearchableMatches(
  node: ProseNode,
  normalizedQuery: string,
  matches: EditorFindMatch[],
  budget: { scannedNodes: number; stopped: boolean },
  pos = -1,
): void {
  if (budget.stopped || matches.length >= MAX_EDITOR_FIND_MATCHES) {
    budget.stopped = true;
    return;
  }

  budget.scannedNodes += 1;
  if (budget.scannedNodes > MAX_EDITOR_FIND_SCAN_NODES) {
    budget.stopped = true;
    return;
  }

  if (node.isTextblock) {
    const segments: BlockSegment[] = [];
    const offsetRef = { value: 0 };

    node.forEach((child, offset) => {
      appendInlineSegments(child as ProseNode, pos + 1 + offset, segments, offsetRef, budget);
    });

    if (!budget.stopped && segments.length > 0) {
      appendMatchesForBlock({
        text: segments.map((segment) => segment.text).join(''),
        segments,
      }, normalizedQuery, matches);
    }

    return;
  }

  node.forEach((child, offset) => {
    if (budget.stopped || matches.length >= MAX_EDITOR_FIND_MATCHES) {
      budget.stopped = true;
      return;
    }
    collectSearchableMatches(child as ProseNode, normalizedQuery, matches, budget, pos + 1 + offset);
  });
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
  const budget = { scannedNodes: 0, stopped: false };

  collectSearchableMatches(doc, normalizedQuery, matches, budget);

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
