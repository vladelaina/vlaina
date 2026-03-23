import { mathBlockEnterPlugin } from './mathBlockEnterPlugin';
import { $remark } from '@milkdown/kit/utils';
import remarkMath from 'remark-math';
import { mathBlockInputRule, mathInlineInputRule } from './mathInputRules';
import {
  mathBlockIdAttr,
  mathBlockSchema,
  mathInlineIdAttr,
  mathInlineSchema,
} from './mathSchema';

export const remarkMathPlugin = $remark('remarkMath', () => remarkMath);

export const mathPlugin = [
  remarkMathPlugin,
  mathBlockIdAttr,
  mathBlockSchema,
  mathInlineIdAttr,
  mathInlineSchema,
  mathBlockEnterPlugin,
  mathBlockInputRule,
  mathInlineInputRule
].flat();
