import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockType, TextAlignment } from './types';
import { BARE_DOMAIN_HREF_PATTERN } from '../links/utils/constants';
import { themeDomStyleTokens } from '@/styles/themeTokens';
import { DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT } from '../shared/boundedProseNodeScan';

type MarkLike = {
  type: { name: string };
  attrs?: Record<string, unknown>;
};

type TextNodeLike = {
  isText?: boolean;
  text?: string | null;
  nodeSize: number;
  marks: readonly MarkLike[];
};

type NodeWithTypeAndAttrs = {
  type: { name: string };
  attrs?: Record<string, unknown>;
};

type ResolvedPosLike = {
  depth: number;
  node: (depth: number) => NodeWithTypeAndAttrs;
  before: (depth: number) => number;
  parent?: NodeWithTypeAndAttrs;
};

type TextRange = {
  from: number;
  to: number;
};

type SelectedTextContext = {
  node: TextNodeLike;
  pos: number;
  selectedFrom: number;
  selectedTo: number;
};

const NO_COMMON_VALUE = Symbol('no-common-value');
const RESTRICTED_SELECTION_BLOCK_TYPES = new Set(['code_block', 'frontmatter']);
export const MAX_FLOATING_TOOLBAR_SELECTION_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
export const MAX_FLOATING_TOOLBAR_SELECTED_TEXT_CHARS = 200_000;
export const MAX_FLOATING_TOOLBAR_FORMATTABLE_RANGES = 5_000;

type TraversableNode = {
  child?: (index: number) => TraversableNode;
  childCount?: number;
  nodeSize?: number;
};

function isTraversableNode(value: unknown): value is TraversableNode {
  const node = value as TraversableNode | null | undefined;
  return typeof node?.child === 'function' && typeof node.childCount === 'number';
}

function forEachSelectedNode(
  doc: unknown,
  from: number,
  to: number,
  callback: (node: unknown, pos: number, parent?: unknown) => void,
  maxScanNodes = MAX_FLOATING_TOOLBAR_SELECTION_SCAN_NODES
) {
  if (!isTraversableNode(doc)) {
    let scanned = 0;
    (doc as { nodesBetween?: (...args: any[]) => void }).nodesBetween?.(from, to, (node: unknown, pos: number, parent?: unknown) => {
      if (scanned >= maxScanNodes) return false;
      scanned += 1;
      callback(node, pos, parent);
      return undefined;
    });
    return;
  }

  let scanned = 0;
  const stack: Array<{
    contentStart: number;
    index: number;
    node: TraversableNode;
    offset: number;
    parent?: unknown;
  }> = [{
    contentStart: 0,
    index: 0,
    node: doc,
    offset: 0,
  }];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.index >= (frame.node.childCount ?? 0)) {
      stack.pop();
      continue;
    }
    if (scanned >= maxScanNodes) {
      return;
    }

    const node = frame.node.child!(frame.index);
    const pos = frame.contentStart + frame.offset;
    const nodeSize = typeof node.nodeSize === 'number' && node.nodeSize > 0 ? node.nodeSize : 1;
    frame.index += 1;
    frame.offset += nodeSize;

    if (pos >= to) {
      frame.index = frame.node.childCount ?? frame.index;
      continue;
    }
    if (pos + nodeSize <= from) {
      continue;
    }

    scanned += 1;
    callback(node, pos, frame.node);

    if (isTraversableNode(node) && (node.childCount ?? 0) > 0) {
      stack.push({
        contentStart: pos + 1,
        index: 0,
        node,
        offset: 0,
        parent: frame.node,
      });
    }
  }
}

function forEachSelectedTextNode(
  view: EditorView,
  callback: (context: SelectedTextContext) => void,
  options?: { excludeRestrictedParents?: boolean }
): boolean {
  const { state } = view;
  const { from, to, empty } = state.selection;
  let hasSelectedText = false;

  if (empty) {
    return false;
  }

  forEachSelectedNode(state.doc, from, to, (node, pos, parent) => {
    const textNode = node as unknown as TextNodeLike;
    const parentNode = parent as NodeWithTypeAndAttrs | undefined;
    if (
      options?.excludeRestrictedParents &&
      parentNode &&
      RESTRICTED_SELECTION_BLOCK_TYPES.has(parentNode.type.name)
    ) {
      return;
    }

    if (!textNode.isText || !textNode.text || textNode.text.length === 0) {
      return;
    }

    const nodeStart = pos;
    const nodeEnd = pos + textNode.nodeSize;
    const selectedStart = Math.max(from, nodeStart);
    const selectedEnd = Math.min(to, nodeEnd);

    if (selectedStart >= selectedEnd) {
      return;
    }

    hasSelectedText = true;
    callback({
      node: textNode,
      pos,
      selectedFrom: selectedStart,
      selectedTo: selectedEnd,
    });
  });

  return hasSelectedText;
}

export function getActiveMarks(view: EditorView): Set<string> {
  let activeMarks: Set<string> | null = null;

  const hasSelectedText = forEachSelectedTextNode(view, ({ node }) => {
    const nodeMarks = new Set(node.marks.map((mark) => mark.type.name));

    if (activeMarks === null) {
      activeMarks = nodeMarks;
      return;
    }

    activeMarks.forEach((markName) => {
      if (!nodeMarks.has(markName)) {
        activeMarks?.delete(markName);
      }
    });
  }, { excludeRestrictedParents: true });

  if (!hasSelectedText || activeMarks === null) {
    return new Set<string>();
  }

  return activeMarks;
}

function findAncestorDepth(
  $pos: ResolvedPosLike,
  predicate: (node: NodeWithTypeAndAttrs) => boolean
): number | null {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if (predicate($pos.node(depth))) {
      return depth;
    }
  }

  return null;
}

function getBlockTypeFromResolvedPos($pos: ResolvedPosLike): { key: string; value: BlockType } | null {
  const codeBlockDepth = findAncestorDepth($pos, (node) => node.type.name === 'code_block');
  if (codeBlockDepth !== null) {
    return {
      key: `code:${$pos.before(codeBlockDepth)}`,
      value: 'codeBlock',
    };
  }

  const blockquoteDepth = findAncestorDepth($pos, (node) => node.type.name === 'blockquote');
  if (blockquoteDepth !== null) {
    return {
      key: `blockquote:${$pos.before(blockquoteDepth)}`,
      value: 'blockquote',
    };
  }

  const listItemDepth = findAncestorDepth($pos, (node) => node.type.name === 'list_item');
  if (listItemDepth !== null) {
    const listItem = $pos.node(listItemDepth);
    if (listItem.attrs?.checked != null) {
      return {
        key: `task:${$pos.before(listItemDepth)}`,
        value: 'taskList',
      };
    }

    const orderedListDepth = findAncestorDepth(
      $pos,
      (node) => node.type.name === 'ordered_list'
    );
    if (orderedListDepth !== null) {
      return {
        key: `ordered:${$pos.before(listItemDepth)}`,
        value: 'orderedList',
      };
    }

    const bulletListDepth = findAncestorDepth(
      $pos,
      (node) => node.type.name === 'bullet_list'
    );
    if (bulletListDepth !== null) {
      return {
        key: `bullet:${$pos.before(listItemDepth)}`,
        value: 'bulletList',
      };
    }
  }

  const headingDepth = findAncestorDepth($pos, (node) => node.type.name === 'heading');
  if (headingDepth !== null) {
    const level = $pos.node(headingDepth).attrs?.level;
    const headingLevel =
      typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 6
        ? level
        : 1;

    return {
      key: `heading:${$pos.before(headingDepth)}`,
      value: `heading${headingLevel}` as BlockType,
    };
  }

  const paragraphDepth = findAncestorDepth($pos, (node) => node.type.name === 'paragraph');
  if (paragraphDepth !== null) {
    return {
      key: `paragraph:${$pos.before(paragraphDepth)}`,
      value: 'paragraph',
    };
  }

  return null;
}

function isUnsupportedAlignmentContainer($pos: ResolvedPosLike, alignableDepth: number): boolean {
  for (let depth = alignableDepth - 1; depth > 0; depth -= 1) {
    const typeName = $pos.node(depth).type.name;
    if (typeName === 'table_cell' || typeName === 'table_header') {
      return true;
    }
  }

  return false;
}

function getAlignmentFromResolvedPos(
  $pos: ResolvedPosLike
): { key: string; value: TextAlignment } | null {
  const alignableDepth = findAncestorDepth(
    $pos,
    (node) => node.type.name === 'paragraph' || node.type.name === 'heading'
  );

  if (alignableDepth === null || isUnsupportedAlignmentContainer($pos, alignableDepth)) {
    return null;
  }

  const align = $pos.node(alignableDepth).attrs?.align;

  return {
    key: `align:${$pos.before(alignableDepth)}`,
    value: align === 'center' || align === 'right' ? align : 'left',
  };
}

function getCommonSelectedValue<T>(
  view: EditorView,
  getter: ($pos: ResolvedPosLike) => { key: string; value: T } | null
): T | null {
  const seenKeys = new Set<string>();
  let commonValue: T | typeof NO_COMMON_VALUE | undefined;

  const hasSelectedText = forEachSelectedTextNode(view, ({ selectedFrom }) => {
    const resolvedPos = view.state.doc.resolve(selectedFrom);
    const context = getter(resolvedPos as unknown as ResolvedPosLike);
    if (!context || seenKeys.has(context.key)) {
      return;
    }

    seenKeys.add(context.key);

    if (commonValue === undefined) {
      commonValue = context.value;
      return;
    }

    if (commonValue !== context.value) {
      commonValue = NO_COMMON_VALUE;
    }
  });

  if (!hasSelectedText || commonValue === undefined || commonValue === NO_COMMON_VALUE) {
    return null;
  }

  return commonValue;
}

export function getCurrentBlockType(view: EditorView): BlockType | null {
  const { state } = view;
  if (!state.selection.empty) {
    return getCommonSelectedValue(view, getBlockTypeFromResolvedPos);
  }

  return getBlockTypeFromResolvedPos(state.selection.$from as unknown as ResolvedPosLike)?.value ?? 'paragraph';
}

export function getCurrentAlignment(view: EditorView): TextAlignment | null {
  const { state } = view;
  if (!state.selection.empty) {
    return getCommonSelectedValue(view, getAlignmentFromResolvedPos);
  }

  return getAlignmentFromResolvedPos(state.selection.$from as unknown as ResolvedPosLike)?.value ?? 'left';
}

export function isSelectionInFirstH1(view: EditorView): boolean {
  const { state } = view;
  const { $from } = state.selection;
  const parent = $from.parent;

  if (parent.type.name !== 'heading' || parent.attrs.level !== 1) {
    return false;
  }

  const pos = $from.before($from.depth);
  return pos === 0;
}

export function getLinkUrl(view: EditorView): string | null {
  const linkUrl = getCommonMarkAttributeForFormattableText(view, 'link', 'href');
  if (linkUrl === null) {
    return null;
  }

  const selectedText = getSelectedFormattableText(view)?.trim();
  if (selectedText === undefined) {
    return null;
  }
  if (isPlainUrlLinkSelection(selectedText, linkUrl)) {
    return null;
  }

  return linkUrl;
}

export function getTextColor(view: EditorView): string | null {
  return getCommonMarkAttributeForFormattableText(view, 'textColor', 'color');
}

export function getBgColor(view: EditorView): string | null {
  return getCommonMarkAttributeForFormattableText(view, 'bgColor', 'color');
}

function getCommonMarkAttributeForFormattableText(
  view: EditorView,
  markName: string,
  attrName: string
): string | null {
  let commonValue: string | null | typeof NO_COMMON_VALUE | undefined;

  const hasSelectedText = forEachSelectedTextNode(view, ({ node }) => {
    const value = node.marks.find((mark) => mark.type.name === markName)?.attrs?.[attrName] ?? null;
    const normalizedValue = typeof value === 'string' && value.length > 0 ? value : null;

    if (commonValue === undefined) {
      commonValue = normalizedValue;
      return;
    }

    if (commonValue !== normalizedValue) {
      commonValue = NO_COMMON_VALUE;
    }
  }, { excludeRestrictedParents: true });

  if (!hasSelectedText || commonValue === undefined || commonValue === NO_COMMON_VALUE) {
    return null;
  }

  return commonValue;
}

function getSelectedFormattableText(view: EditorView): string | null {
  let text = '';
  let complete = true;

  forEachSelectedTextNode(view, ({ node, pos, selectedFrom, selectedTo }) => {
    if (!complete) return;
    const fromOffset = Math.max(0, selectedFrom - pos);
    const toOffset = Math.max(fromOffset, selectedTo - pos);
    const selectedText = (node.text ?? '').slice(fromOffset, toOffset);
    const remaining = MAX_FLOATING_TOOLBAR_SELECTED_TEXT_CHARS - text.length;
    if (selectedText.length > remaining) {
      text += selectedText.slice(0, Math.max(0, remaining));
      complete = false;
      return;
    }
    text += selectedText;
  }, { excludeRestrictedParents: true });

  return complete ? text : null;
}

function isPlainUrlLinkSelection(selectedText: string, href: string): boolean {
  if (!selectedText || !href) {
    return false;
  }

  const normalizedText = selectedText.trim();
  const normalizedHref = href.trim();
  if (normalizedText === normalizedHref) {
    return true;
  }

  if (normalizedText.startsWith('www.') && `https://${normalizedText}` === normalizedHref) {
    return true;
  }

  if (BARE_DOMAIN_HREF_PATTERN.test(normalizedText) && `https://${normalizedText}` === normalizedHref) {
    return true;
  }

  return normalizedHref.toLowerCase().startsWith('mailto:') &&
    normalizedHref.slice('mailto:'.length) === normalizedText;
}

export function getFormattableTextRanges(view: EditorView): TextRange[] {
  const ranges: TextRange[] = [];

  forEachSelectedTextNode(view, ({ selectedFrom, selectedTo }) => {
    if (ranges.length >= MAX_FLOATING_TOOLBAR_FORMATTABLE_RANGES) return;
    const previousRange = ranges.length > 0 ? ranges[ranges.length - 1] : null;
    if (previousRange && previousRange.to === selectedFrom) {
      previousRange.to = selectedTo;
      return;
    }

    ranges.push({
      from: selectedFrom,
      to: selectedTo,
    });
  }, { excludeRestrictedParents: true });

  return ranges;
}

export function calculatePositionForRange(view: EditorView, from: number, to: number): {
  x: number; 
  y: number; 
  placement: 'top' | 'bottom' 
} {
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);

  const x = (start.left + end.left) / 2;
  const viewportBottom =
    typeof window !== 'undefined' ? window.innerHeight : Number.POSITIVE_INFINITY;
  const placement = viewportBottom - end.bottom < 80 ? 'top' : 'bottom';
  const finalY = placement === 'bottom'
    ? end.bottom + themeDomStyleTokens.editorPopupAnchorOffsetPx
    : start.top - themeDomStyleTokens.editorPopupAnchorOffsetPx;

  return { x, y: finalY, placement };
}

export function calculatePosition(view: EditorView): {
  x: number;
  y: number;
  placement: 'top' | 'bottom'
} {
  const { state } = view;
  const { from, to } = state.selection;

  return calculatePositionForRange(view, from, to);
}

export function calculateBottomPositionForRange(view: EditorView, from: number, to: number): {
  x: number;
  y: number;
  placement: 'bottom';
} {
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);

  return {
    x: start.left,
    y: end.bottom + themeDomStyleTokens.editorPopupAnchorOffsetPx,
    placement: 'bottom',
  };
}

export function calculateBottomPosition(view: EditorView): {
  x: number;
  y: number;
  placement: 'bottom';
} {
  const { state } = view;
  const { from, to } = state.selection;

  return calculateBottomPositionForRange(view, from, to);
}
