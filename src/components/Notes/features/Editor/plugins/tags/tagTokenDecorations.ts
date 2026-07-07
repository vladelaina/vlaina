import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { isNoteTagToken } from '@/lib/notes/tags';
import {
  DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT,
  STOP_PROSE_SCAN,
  scanProseDescendants,
} from '../shared/boundedProseNodeScan';

export const TAG_TOKEN_HAS_NEXT_CLASS = 'editor-tag-token-has-next';
export const MAX_TAG_TOKEN_DECORATIONS = 1000;
export const MAX_TAG_TOKEN_DOC_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
export const MAX_TAG_TOKEN_CHARS = 128;

const TAG_TOKEN_PATTERN = /(?<![\p{L}\p{N}_/-])#([\p{L}\p{N}_/-][\p{L}\p{N}_/-]*)/gu;
const SKIPPED_TEXT_PARENT_TYPES = new Set(['code_block', 'html_block']);
const SKIPPED_MARK_TYPES = new Set(['inlineCode', 'code']);

type TagTokenDecorationCandidate = {
  from: number;
  parent: unknown;
  to: number;
};

export function createTagTokenDecorations(doc: any): DecorationSet {
  const candidates: TagTokenDecorationCandidate[] = [];

  scanProseDescendants(doc, (node, pos, parent) => {
    if (candidates.length >= MAX_TAG_TOKEN_DECORATIONS) {
      return STOP_PROSE_SCAN;
    }

    if (node.isText) {
      collectTagTokenCandidatesFromTextNode(node, pos, parent, candidates);
    }

    return candidates.length < MAX_TAG_TOKEN_DECORATIONS ? undefined : STOP_PROSE_SCAN;
  }, MAX_TAG_TOKEN_DOC_SCAN_NODES);

  const decorations = createTagTokenDecorationsFromCandidates(candidates);
  return decorations.length > 0
    ? DecorationSet.create(doc, decorations)
    : DecorationSet.empty;
}

function createTagTokenDecorationsFromCandidates(candidates: readonly TagTokenDecorationCandidate[]): Decoration[] {
  return candidates.map((candidate, index) => {
    const next = candidates[index + 1];
    const hasNext = Boolean(next && next.parent === candidate.parent);
    return Decoration.inline(candidate.from, candidate.to, {
      class: [
        'editor-tag-token tag cm-hashtag cm-meta v-tag',
        hasNext ? TAG_TOKEN_HAS_NEXT_CLASS : '',
        chatComposerPillSurfaceClass,
      ].filter(Boolean).join(' '),
      'data-editor-tag-token': 'true',
    }, {
      inclusiveStart: false,
      inclusiveEnd: false,
    });
  });
}

function collectTagTokenCandidatesFromTextNode(
  node: any,
  pos: number,
  parent: any,
  candidates: TagTokenDecorationCandidate[],
  maxDecorations = MAX_TAG_TOKEN_DECORATIONS,
): void {
  if (candidates.length >= maxDecorations) return;

  const parentType = parent?.type?.name;
  if (parentType && SKIPPED_TEXT_PARENT_TYPES.has(parentType)) {
    return;
  }

  if (node.marks?.some((mark: any) => SKIPPED_MARK_TYPES.has(mark.type?.name))) {
    return;
  }

  const text = node.text ?? '';
  TAG_TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_TOKEN_PATTERN.exec(text)) !== null) {
    const tag = match[1]?.trim();
    if (!tag || tag.length > MAX_TAG_TOKEN_CHARS || !isNoteTagToken(tag)) {
      continue;
    }

    candidates.push({
      from: pos + match.index,
      parent,
      to: pos + match.index + match[0].length,
    });
    if (candidates.length >= maxDecorations) {
      break;
    }
  }
}

export function collectTagTokenDecorationsInRange(
  doc: any,
  from: number,
  to: number,
  maxDecorations = MAX_TAG_TOKEN_DECORATIONS,
  maxScanNodes = MAX_TAG_TOKEN_DOC_SCAN_NODES,
): Decoration[] {
  const candidates: TagTokenDecorationCandidate[] = [];
  const docSize = typeof doc.content?.size === 'number' ? doc.content.size : 0;
  const start = Math.max(0, Math.min(from, docSize));
  const end = Math.max(start, Math.min(to, docSize));
  if (start >= end || typeof doc.nodesBetween !== 'function') {
    return [];
  }

  let scannedNodes = 0;
  doc.nodesBetween(start, end, (node: any, pos: number, parent: any) => {
    scannedNodes += 1;
    if (scannedNodes > maxScanNodes) return false;
    if (candidates.length >= maxDecorations) return false;
    if (!node.isText) return true;
    collectTagTokenCandidatesFromTextNode(node, pos, parent, candidates, maxDecorations);
    return candidates.length < maxDecorations;
  });

  return createTagTokenDecorationsFromCandidates(candidates);
}
