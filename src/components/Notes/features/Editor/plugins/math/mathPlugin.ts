import { mathBlockEnterPlugin } from './mathBlockEnterPlugin';
import { $prose, $remark } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import remarkMath from 'remark-math';
import { MathNodeView } from './MathNodeView';
import { mathBlockInputRule, mathInlineInputRule } from './mathInputRules';
import {
  mathBlockIdAttr,
  mathBlockSchema,
  mathInlineIdAttr,
  mathInlineSchema,
} from './mathSchema';

export const remarkMathPlugin = $remark('remarkMath', () => remarkMath);

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
  mathBlockIdAttr,
  mathBlockSchema,
  mathInlineIdAttr,
  mathInlineSchema,
  mathNodeViewPlugin,
  mathBlockEnterPlugin,
  mathBlockInputRule,
  mathInlineInputRule
].flat();
