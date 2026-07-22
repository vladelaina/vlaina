import { mathBlockEnterPlugin } from './mathBlockEnterPlugin';
import { $prose, $remark } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import remarkMath from 'remark-math';
import { remarkMathCodeFence } from '@/components/common/markdown/remarkMathCodeFence';
import { remarkParenthesizedMath } from '@/components/common/markdown/remarkParenthesizedMath';
import { MathNodeView } from './MathNodeView';
import { mathBlockInputRule, mathInlineInputRule } from './mathInputRules';
import { mathBlockSchema, mathInlineSchema } from './mathSchema';

export const remarkMathPlugin = $remark('remarkMath', () => remarkMath);
export const remarkParenthesizedMathPlugin = $remark(
  'remarkParenthesizedMath',
  () => remarkParenthesizedMath,
);
export const remarkMathCodeFencePlugin = $remark('remarkMathCodeFence', () => remarkMathCodeFence);

export const mathNodeViewPlugin = $prose(() => {
  return new Plugin({
    props: {
      nodeViews: {
        math_block: (node, view, getPos) =>
          new MathNodeView(node, view, getPos as () => number | undefined),
        math_inline: (node, view, getPos) =>
          new MathNodeView(node, view, getPos as () => number | undefined),
      },
    },
  });
});

export const mathPlugin = [
  remarkMathPlugin,
  remarkParenthesizedMathPlugin,
  remarkMathCodeFencePlugin,
  mathBlockSchema,
  mathInlineSchema,
  mathNodeViewPlugin,
  mathBlockEnterPlugin,
  mathBlockInputRule,
  mathInlineInputRule
].flat();
