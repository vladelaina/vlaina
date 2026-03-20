import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockType, TextAlignment } from './types';

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

type SelectedTextContext = {
  node: TextNodeLike;
  pos: number;
  selectedFrom: number;
  selectedTo: number;
};

const NO_COMMON_VALUE = Symbol('no-common-value');

function forEachSelectedTextNode(
  view: EditorView,
  callback: (context: SelectedTextContext) => void
): boolean {
  const { state } = view;
  const { from, to, empty } = state.selection;
  let hasSelectedText = false;

  if (empty) {
    return false;
  }

  state.doc.nodesBetween(from, to, (node, pos) => {
    const textNode = node as unknown as TextNodeLike;
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

function getCommonMarkAttribute(
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
  });

  if (!hasSelectedText || commonValue === undefined || commonValue === NO_COMMON_VALUE) {
    return null;
  }

  return commonValue;
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
  });

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
    const level = Number($pos.node(headingDepth).attrs?.level);
    const headingLevel = Number.isInteger(level) && level >= 1 && level <= 6 ? level : 1;

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
  return getCommonMarkAttribute(view, 'link', 'href');
}

export function getTextColor(view: EditorView): string | null {
  return getCommonMarkAttribute(view, 'textColor', 'color');
}

export function getBgColor(view: EditorView): string | null {
  return getCommonMarkAttribute(view, 'bgColor', 'color');
}

export function calculatePosition(view: EditorView): { 
  x: number; 
  y: number; 
  placement: 'top' | 'bottom' 
} {
  const { state } = view;
  const { from, to } = state.selection;

  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);

  const x = (start.left + end.left) / 2;
  const viewportBottom =
    typeof window !== 'undefined' ? window.innerHeight : Number.POSITIVE_INFINITY;
  const placement = viewportBottom - end.bottom < 80 ? 'top' : 'bottom';
  const finalY = placement === 'bottom' ? end.bottom + 8 : start.top - 8;

  return { x, y: finalY, placement };
}

export function calculateBottomPosition(view: EditorView): {
  x: number;
  y: number;
  placement: 'bottom';
} {
  const { state } = view;
  const { from, to } = state.selection;

  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);

  return {
    x: start.left,
    y: end.bottom + 8,
    placement: 'bottom',
  };
}
