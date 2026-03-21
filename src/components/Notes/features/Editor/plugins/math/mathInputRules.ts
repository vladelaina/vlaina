import { $inputRule } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';

export const MATH_BLOCK_INPUT_RULE_PATTERN = /^\$\$([^$]+)\$\$\s$/;
export const MATH_INLINE_INPUT_RULE_PATTERN = /(?<!\$)\$([^$\s][^$]*[^$\s]|[^$\s])\$$/;

export function applyMathBlockInputRule(
  state: {
    tr: {
      delete: (start: number, end: number) => {
        replaceSelectionWith: (node: any, inheritMarks?: boolean) => any;
      };
    };
    schema: { nodes: { math_block?: { create: (attrs: { latex: string }) => any } } };
  },
  match: RegExpMatchArray,
  start: number,
  end: number
) {
  const latex = match[1] || '';
  const { tr, schema } = state;
  const mathBlockType = schema.nodes.math_block;

  if (!mathBlockType) {
    return null;
  }

  return tr
    .delete(start, end)
    .replaceSelectionWith(mathBlockType.create({ latex }));
}

export function applyMathInlineInputRule(
  state: {
    tr: {
      delete: (start: number, end: number) => {
        replaceSelectionWith: (node: any, inheritMarks?: boolean) => any;
      };
    };
    schema: { nodes: { math_inline?: { create: (attrs: { latex: string }) => any } } };
  },
  match: RegExpMatchArray,
  start: number,
  end: number
) {
  const latex = match[1] || '';
  const { tr, schema } = state;
  const mathInlineType = schema.nodes.math_inline;

  if (!mathInlineType) {
    return null;
  }

  return tr
    .delete(start, end)
    .replaceSelectionWith(mathInlineType.create({ latex }));
}

export const mathBlockInputRule = $inputRule(() => {
  return new InputRule(MATH_BLOCK_INPUT_RULE_PATTERN, applyMathBlockInputRule);
});

export const mathInlineInputRule = $inputRule(() => {
  return new InputRule(MATH_INLINE_INPUT_RULE_PATTERN, applyMathInlineInputRule);
});
