import type { Mark as ProseMark, Node as ProseNode } from '@milkdown/kit/prose/model';
import { sanitizeExplicitMarkdownLinkHref } from '../utils/linkHref';
import { getMarkdownLinkHref, MARKDOWN_LINK_REGEX } from './markdownLinkParser';
import { MAX_MARKDOWN_LINK_PASTE_NODES } from './markdownLinkConfig';

export function createMarkdownLinkPasteNodes(
    text: string,
    schema: { text: (text: string, marks?: readonly ProseMark[] | null) => ProseNode },
    linkMarkType: { create: (attrs: { href: string }) => ProseMark },
    maxNodes = MAX_MARKDOWN_LINK_PASTE_NODES,
): ProseNode[] | null {
    const limit = Math.max(0, Math.floor(maxNodes));
    if (limit === 0) return null;

    MARKDOWN_LINK_REGEX.lastIndex = 0;
    const nodes: ProseNode[] = [];
    let lastIndex = 0;

    const pushNode = (node: ProseNode): boolean => {
        if (nodes.length >= limit) return false;
        nodes.push(node);
        return true;
    };

    let match;
    while ((match = MARKDOWN_LINK_REGEX.exec(text)) !== null) {
        const fullMatch = match[0];
        const linkText = match[1];
        const linkUrl = match[2];
        const matchStart = match.index;

        if (matchStart > lastIndex) {
            const beforeText = text.slice(lastIndex, matchStart);
            if (!pushNode(schema.text(beforeText))) return null;
        }

        const safeLinkUrl = sanitizeExplicitMarkdownLinkHref(getMarkdownLinkHref(linkUrl));
        if (!pushNode(
            safeLinkUrl
                ? schema.text(linkText, [linkMarkType.create({ href: safeLinkUrl })])
                : schema.text(linkText)
        )) {
            return null;
        }

        lastIndex = matchStart + fullMatch.length;
    }

    if (lastIndex < text.length) {
        const afterText = text.slice(lastIndex);
        if (!pushNode(schema.text(afterText))) return null;
    }

    return nodes.length === 0 ? null : nodes;
}
