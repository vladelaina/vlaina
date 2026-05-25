import { $remark } from '@milkdown/kit/utils';
import {
  remarkInlineColorHtml,
  sanitizeCssColorValue,
  type ColorMarkdownMdastNode as MdastNode,
} from '@/components/common/markdown/colorMarkdown';

export { sanitizeCssColorValue, type MdastNode };

export const remarkInlineColorHtmlPlugin = $remark('remarkInlineColorHtml', () => remarkInlineColorHtml);
