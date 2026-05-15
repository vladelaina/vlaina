import { isStandaloneFencedCodeBlock } from '../../clipboard/fencedCodePaste';

export const MARKDOWN_LINK_REGEX = /(?:\[|【)([^】\]]+)(?:\]|】)(?:\(|（)([^)）]+)(?:\)|）)/g;
export const MARKDOWN_LINK_PATTERN_BEFORE = /(?:\[|【)([^】\]]+)(?:\]|】)(?:\(|（)([^)）]+)(?:\)|）)$/;
export const MARKDOWN_LINK_PATTERN_GLOBAL = /(?:\[|【)([^】\]]+)(?:\]|】)(?:\(|（)([^)）]+)(?:\)|）)/g;

const IMAGE_LINK_PATTERN = /!(?:\[|【)[^】\]\r\n]+(?:\]|】)(?:\(|（)[^)）\r\n]+(?:\)|）)/;
const MULTI_LINE_PATTERN = /[\r\n]/;
const STRUCTURAL_MARKDOWN_PREFIX_PATTERN = /^\s{0,3}([#＃]{1,6}\s+|[-+*－＋＊]\s+|[0-9０-９]+[.)．]\s+|[>》]\s+|```|~~~|···|～～～|[-*_－＿＊]{3,}\s*$|[|｜].+[|｜])/;
const LINK_DESTINATION_WITH_TITLE_PATTERN = /^(<[^>\r\n]+>|[^\s"'()]+)(?:\s+(?:"[^"\r\n]*"|'[^'\r\n]*'|\([^)\r\n]*\)))?\s*$/;

export function getMarkdownLinkHref(rawDestination: string): string {
    const destination = rawDestination.trim();
    const match = LINK_DESTINATION_WITH_TITLE_PATTERN.exec(destination);
    if (!match) return destination;

    const href = match[1];
    return href.startsWith('<') && href.endsWith('>')
        ? href.slice(1, -1)
        : href;
}

export function shouldHandleMarkdownLinkPaste(text: string): boolean {
    if (!text) return false;
    if (MULTI_LINE_PATTERN.test(text)) return false;
    if (IMAGE_LINK_PATTERN.test(text)) return false;
    if (STRUCTURAL_MARKDOWN_PREFIX_PATTERN.test(text)) return false;
    if (isStandaloneFencedCodeBlock(text)) return false;
    MARKDOWN_LINK_REGEX.lastIndex = 0;
    return MARKDOWN_LINK_REGEX.test(text);
}
