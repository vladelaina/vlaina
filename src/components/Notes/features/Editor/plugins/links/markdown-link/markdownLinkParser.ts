import { isStandaloneFencedCodeBlock } from '../../clipboard/fencedCodePaste';
import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';

const MARKDOWN_LINK_DESTINATION_ESCAPE_PATTERN = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;
const MARKDOWN_LINK_DESTINATION_SOURCE = String.raw`(?:<[^>\r\n]+>|[^\s"'()（）\r\n]+(?:[(（][^()（）\r\n]*[)）][^\s"'()（）\r\n]*)*)`;
const MARKDOWN_LINK_TITLE_SOURCE = String.raw`(?:\s+(?:"[^"\r\n]*"|'[^'\r\n]*'|[(（][^()（）\r\n]*[)）]))?`;
const MARKDOWN_LINK_TARGET_SOURCE = String.raw`${MARKDOWN_LINK_DESTINATION_SOURCE}${MARKDOWN_LINK_TITLE_SOURCE}\s*`;
const MARKDOWN_LINK_SOURCE = String.raw`(?:\[|【)([^】\]]+)(?:\]|】)(?:\(|（)(${MARKDOWN_LINK_TARGET_SOURCE})(?:\)|）)`;

export const MARKDOWN_LINK_REGEX = new RegExp(MARKDOWN_LINK_SOURCE, 'g');
export const MARKDOWN_LINK_PATTERN_BEFORE = new RegExp(`${MARKDOWN_LINK_SOURCE}$`);
export const MARKDOWN_LINK_PATTERN_GLOBAL = new RegExp(MARKDOWN_LINK_SOURCE, 'g');

const IMAGE_LINK_PATTERN = /!(?:\[|【)[^】\]\r\n]+(?:\]|】)(?:\(|（)[^)）\r\n]+(?:\)|）)/;
const MULTI_LINE_PATTERN = /[\r\n]/;
const STRUCTURAL_MARKDOWN_PREFIX_PATTERN = /^\s{0,3}([#＃]{1,6}\s+|[-+*－＋＊]\s+|[0-9０-９]+[.)．]\s+|[>》]\s+|```|~~~|···|～～～|[-*_－＿＊]{3,}\s*$|[|｜].+[|｜])/;
const LINK_DESTINATION_WITH_TITLE_PATTERN = new RegExp(
    String.raw`^(${MARKDOWN_LINK_DESTINATION_SOURCE})${MARKDOWN_LINK_TITLE_SOURCE}\s*$`,
);

function unescapeMarkdownLinkDestination(value: string): string {
    return value.replace(MARKDOWN_LINK_DESTINATION_ESCAPE_PATTERN, '$1');
}

export function getMarkdownLinkHref(rawDestination: string): string {
    const destination = rawDestination.trim();
    const match = LINK_DESTINATION_WITH_TITLE_PATTERN.exec(destination);
    if (!match) return destination;

    const href = match[1];
    const unwrapped = href.startsWith('<') && href.endsWith('>')
        ? href.slice(1, -1)
        : href;
    return decodeMarkdownHtmlText(unescapeMarkdownLinkDestination(unwrapped));
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
