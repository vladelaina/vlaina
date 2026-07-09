import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { sanitizeExplicitMarkdownLinkHref } from '../utils/linkHref';
import {
    RAW_MARKDOWN_LINK_TEXT_CLASS,
    type RawMarkdownLinkMatch,
} from './markdownLinkConfig';
import { collectRawMarkdownLinkMatches } from './markdownLinkMatches';
import { getMarkdownLinkHref } from './markdownLinkParser';

function getSafeMarkdownLinkHref(match: RawMarkdownLinkMatch): string | null {
    return sanitizeExplicitMarkdownLinkHref(getMarkdownLinkHref(match.linkUrl));
}

function getMarkdownLinkTextRange(match: RawMarkdownLinkMatch): { from: number; to: number } | null {
    const from = match.from + 1;
    const to = from + match.linkText.length;
    if (to <= from || to > match.to) return null;
    return { from, to };
}

export function createRawMarkdownLinkTextDecorations(
    doc: ProseNode,
    rawMarkdownLinks = collectRawMarkdownLinkMatches(doc),
): DecorationSet {
    const decorations = rawMarkdownLinks.flatMap((match) => {
        const safeHref = getSafeMarkdownLinkHref(match);
        const textRange = safeHref ? getMarkdownLinkTextRange(match) : null;
        if (!textRange) return [];

        return Decoration.inline(textRange.from, textRange.to, {
            class: RAW_MARKDOWN_LINK_TEXT_CLASS,
            'data-editor-raw-markdown-link-text': 'true',
            'data-href': safeHref,
        }, {
            inclusiveStart: false,
            inclusiveEnd: false,
        });
    });

    return decorations.length > 0
        ? DecorationSet.create(doc, decorations)
        : DecorationSet.empty;
}
