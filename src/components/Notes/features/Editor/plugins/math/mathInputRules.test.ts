import { describe, expect, it, vi } from 'vitest';
import {
  applyMathBlockInputRule,
  applyMathInlineInputRule,
  MATH_BLOCK_INPUT_RULE_PATTERN,
  MATH_INLINE_INPUT_RULE_PATTERN,
} from './mathInputRules';

function createInputRuleState() {
  const replaceSelectionWith = vi.fn(() => 'transaction-result');
  const deleteStep = vi.fn(() => ({ replaceSelectionWith }));
  const nodes: {
    math_block?: { create: ReturnType<typeof vi.fn> };
    math_inline?: { create: ReturnType<typeof vi.fn> };
  } = {
    math_block: {
      create: vi.fn((attrs: { latex: string }) => ({ kind: 'math_block', attrs })),
    },
    math_inline: {
      create: vi.fn((attrs: { latex: string }) => ({ kind: 'math_inline', attrs })),
    },
  };

  return {
    state: {
      tr: {
        delete: deleteStep,
      },
      schema: {
        nodes,
      },
    },
    deleteStep,
    replaceSelectionWith,
  };
}

describe('mathInputRules', () => {
  it('matches block math fences with a trailing space', () => {
    const match = '$$x^2$$ '.match(MATH_BLOCK_INPUT_RULE_PATTERN);

    expect(match?.[2]).toBe('x^2');
  });

  it('matches localized block math fences with a trailing space', () => {
    const match = '￥￥x^2￥￥ '.match(MATH_BLOCK_INPUT_RULE_PATTERN);

    expect(match?.[2]).toBe('x^2');
  });

  it('matches inline math and ignores doubled dollar prefixes', () => {
    const inlineMatch = 'value $x_1$'.match(MATH_INLINE_INPUT_RULE_PATTERN);
    const doubleDollarMatch = '$$x$$'.match(MATH_INLINE_INPUT_RULE_PATTERN);

    expect(inlineMatch?.[1]).toBe('x_1');
    expect(doubleDollarMatch).toBeNull();
  });

  it('applies the block input rule by replacing the fence text with a math block node', () => {
    const { state, deleteStep, replaceSelectionWith } = createInputRuleState();
    const match = '$$\\frac{1}{2}$$ '.match(MATH_BLOCK_INPUT_RULE_PATTERN) as RegExpMatchArray;

    const result = applyMathBlockInputRule(state as any, match, 3, 16);

    expect(result).toBe('transaction-result');
    expect(deleteStep).toHaveBeenCalledWith(3, 16);
    expect(state.schema.nodes.math_block!.create).toHaveBeenCalledWith({ latex: '\\frac{1}{2}' });
    expect(replaceSelectionWith).toHaveBeenCalledWith({
      kind: 'math_block',
      attrs: { latex: '\\frac{1}{2}' },
    });
  });

  it('applies the localized block input rule by replacing the fence text with a math block node', () => {
    const { state, deleteStep, replaceSelectionWith } = createInputRuleState();
    const match = '￥￥s￥￥ '.match(MATH_BLOCK_INPUT_RULE_PATTERN) as RegExpMatchArray;

    const result = applyMathBlockInputRule(state as any, match, 2, 8);

    expect(result).toBe('transaction-result');
    expect(deleteStep).toHaveBeenCalledWith(2, 8);
    expect(state.schema.nodes.math_block!.create).toHaveBeenCalledWith({ latex: 's' });
    expect(replaceSelectionWith).toHaveBeenCalledWith({
      kind: 'math_block',
      attrs: { latex: 's' },
    });
  });

  it('applies the inline input rule by replacing the fence text with a math inline node', () => {
    const { state, deleteStep, replaceSelectionWith } = createInputRuleState();
    const match = '$x+y$'.match(MATH_INLINE_INPUT_RULE_PATTERN) as RegExpMatchArray;

    const result = applyMathInlineInputRule(state as any, match, 8, 13);

    expect(result).toBe('transaction-result');
    expect(deleteStep).toHaveBeenCalledWith(8, 13);
    expect(state.schema.nodes.math_inline!.create).toHaveBeenCalledWith({ latex: 'x+y' });
    expect(replaceSelectionWith).toHaveBeenCalledWith({
      kind: 'math_inline',
      attrs: { latex: 'x+y' },
    });
  });

  it('returns null when the target math node type is unavailable', () => {
    const { state } = createInputRuleState();
    const blockMatch = '$$x$$ '.match(MATH_BLOCK_INPUT_RULE_PATTERN) as RegExpMatchArray;
    const inlineMatch = '$x$'.match(MATH_INLINE_INPUT_RULE_PATTERN) as RegExpMatchArray;
    state.schema.nodes.math_block = undefined;
    state.schema.nodes.math_inline = undefined;

    expect(applyMathBlockInputRule(state as any, blockMatch, 0, 6)).toBeNull();
    expect(applyMathInlineInputRule(state as any, inlineMatch, 0, 3)).toBeNull();
  });
});
