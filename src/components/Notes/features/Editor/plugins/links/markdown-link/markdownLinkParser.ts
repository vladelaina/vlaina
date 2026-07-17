import { isStandaloneFencedCodeBlock } from '../../clipboard/fencedCodePaste';
import {
    MARKDOWN_LINK_REGEX,
    MARKDOWN_LINK_SOURCE,
} from '@/lib/notes/markdown/markdownLinkParser';

export const MARKDOWN_LINK_PATTERN_BEFORE = new RegExp(`${MARKDOWN_LINK_SOURCE}$`);
export {
    getMarkdownLinkHref,
    MARKDOWN_LINK_REGEX,
    MARKDOWN_LINK_PATTERN_GLOBAL,
} from '@/lib/notes/markdown/markdownLinkParser';

const IMAGE_LINK_PATTERN = /!(?:\[|【)[^】\]\r\n]+(?:\]|】)(?:\(|（)[^)）\r\n]+(?:\)|）)/;
const MULTI_LINE_PATTERN = /[\r\n]/;
const STRUCTURAL_MARKDOWN_PREFIX_PATTERN = /^\s{0,3}([#＃]{1,6}\s+|[-+*－＋＊]\s+|[0-9０-９]+[.)．]\s+|[>》]\s+|```|~~~|···|～～～|[-*_－＿＊]{3,}\s*$|[|｜].+[|｜])/;
export function shouldHandleMarkdownLinkPaste(text: string): boolean {
    if (!text) return false;
    if (MULTI_LINE_PATTERN.test(text)) return false;
    if (IMAGE_LINK_PATTERN.test(text)) return false;
    if (STRUCTURAL_MARKDOWN_PREFIX_PATTERN.test(text)) return false;
    if (isStandaloneFencedCodeBlock(text)) return false;
    MARKDOWN_LINK_REGEX.lastIndex = 0;
    return MARKDOWN_LINK_REGEX.test(text);
}
