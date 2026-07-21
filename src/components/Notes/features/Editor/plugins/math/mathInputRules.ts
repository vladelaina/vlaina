import { $inputRule } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import {
  getMathBlockLatexFromInputMatch,
  MATH_BLOCK_INPUT_RULE_PATTERN,
} from './mathBlockFence';
import {
  findInsertedNodePos,
  moveSelectionAfterInsertedNode,
} from '../shared/insertedNodeSelection';

type UndoableInputRule = InputRule & { undoable?: boolean };

export { MATH_BLOCK_INPUT_RULE_PATTERN } from './mathBlockFence';

export const MATH_INLINE_INPUT_RULE_PATTERN = /(?:(?<!\$)\$([^$\s][^$]*[^$\s]|[^$\s])\$|(?<!\\)\\\((\S(?:.*?\S)?)\\\))$/;

export function applyMathBlockInputRule(
  state: {
    tr: {
      delete: (start: number, end: number) => {
        replaceSelectionWith: (node: any, inheritMarks?: boolean) => any;
      };
    };
    schema: {
      nodes: {
        math_block?: { create: (attrs: { latex: string }) => any };
        paragraph?: { create: () => any };
      };
    };
  },
  match: RegExpMatchArray,
  start: number,
  end: number
) {
  const latex = getMathBlockLatexFromInputMatch(match);
  const { tr, schema } = state;
  const mathBlockType = schema.nodes.math_block;

  if (!mathBlockType) {
    return null;
  }

  const mathNode = mathBlockType.create({ latex });
  const nextTr = tr
    .delete(start, end)
    .replaceSelectionWith(mathNode);

  return moveSelectionAfterMathInputRuleNode(nextTr, start, 'math_block', mathNode, schema.nodes.paragraph);
}

export function applyMathInlineInputRule(
  state: {
    tr: {
      delete: (start: number, end: number) => {
        replaceSelectionWith: (node: any, inheritMarks?: boolean) => any;
      };
    };
    schema: {
      nodes: {
        math_inline?: { create: (attrs: { latex: string }) => any };
        paragraph?: { create: () => any };
      };
    };
  },
  match: RegExpMatchArray,
  start: number,
  end: number
) {
  const latex = match[1] ?? match[2] ?? '';
  const { tr, schema } = state;
  const mathInlineType = schema.nodes.math_inline;

  if (!mathInlineType) {
    return null;
  }

  const mathNode = mathInlineType.create({ latex });
  const nextTr = tr
    .delete(start, end)
    .replaceSelectionWith(mathNode);

  return moveSelectionAfterMathInputRuleNode(nextTr, start, 'math_inline', mathNode, schema.nodes.paragraph);
}

function moveSelectionAfterMathInputRuleNode(
  tr: any,
  start: number,
  nodeTypeName: string,
  node: { nodeSize?: number; isInline?: boolean },
  paragraphType?: { create: () => any },
) {
  if (!tr?.doc || typeof tr.mapping?.map !== 'function') {
    return tr;
  }

  const preferredPos = tr.mapping.map(start, -1);
  const nodePos = findInsertedNodePos({
    doc: tr.doc,
    preferredPos,
    nodeTypeName,
  });
  return moveSelectionAfterInsertedNode({
    tr,
    nodePos,
    insertedNodeFallback: node,
    paragraphType,
  });
}

export const mathBlockInputRule = $inputRule(() => {
  return new InputRule(MATH_BLOCK_INPUT_RULE_PATTERN, applyMathBlockInputRule);
});

export const mathInlineInputRule = $inputRule(() => {
  const rule = new InputRule(MATH_INLINE_INPUT_RULE_PATTERN, applyMathInlineInputRule);
  (rule as UndoableInputRule).undoable = false;
  return rule;
});
