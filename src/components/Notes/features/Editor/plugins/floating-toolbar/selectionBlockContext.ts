import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockType, TextAlignment } from './types';
import { NO_COMMON_VALUE } from './selectionHelperConstants';
import { forEachSelectedTextNode } from './selectionTraversal';
import type { NodeWithTypeAndAttrs, ResolvedPosLike } from './selectionHelperTypes';

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
