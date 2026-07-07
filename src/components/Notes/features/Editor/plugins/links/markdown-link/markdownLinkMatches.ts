import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import {
    STOP_PROSE_SCAN,
    scanProseDescendants,
} from '../../shared/boundedProseNodeScan';
import {
    MARKDOWN_LINK_TRIGGER_TEXT_PATTERN,
    MAX_MARKDOWN_LINK_AUTO_COLLAPSE_MATCHES,
    MAX_MARKDOWN_LINK_DOC_SCAN_NODES,
    MAX_MARKDOWN_LINK_TEXT_SCAN_CHARS,
    type MarkdownLinkScanRange,
    type RawMarkdownLinkMatch,
} from './markdownLinkConfig';
import { MARKDOWN_LINK_PATTERN_GLOBAL } from './markdownLinkParser';

export function collectRawMarkdownLinkMatches(
    doc: ProseNode,
    maxMatches = MAX_MARKDOWN_LINK_AUTO_COLLAPSE_MATCHES
): RawMarkdownLinkMatch[] {
    const limit = Math.max(0, Math.floor(maxMatches));
    if (limit === 0) return [];

    const matches: RawMarkdownLinkMatch[] = [];
    let inspectedMatches = 0;

    scanProseDescendants(doc, (node, pos) => {
        if (inspectedMatches >= limit || matches.length >= limit) return STOP_PROSE_SCAN;
        if (!node.isText || !node.text) return true;

        const text = node.text.slice(0, MAX_MARKDOWN_LINK_TEXT_SCAN_CHARS);
        if (!MARKDOWN_LINK_TRIGGER_TEXT_PATTERN.test(text)) return true;

        MARKDOWN_LINK_PATTERN_GLOBAL.lastIndex = 0;

        let match;
        while ((match = MARKDOWN_LINK_PATTERN_GLOBAL.exec(text)) !== null) {
            inspectedMatches += 1;
            if (match.index > 0 && text[match.index - 1] === '!') {
                if (inspectedMatches >= limit) return STOP_PROSE_SCAN;
                continue;
            }

            const fullMatch = match[0];
            matches.push({
                from: pos + match.index,
                linkText: match[1],
                linkUrl: match[2],
                to: pos + match.index + fullMatch.length,
            });

            if (inspectedMatches >= limit || matches.length >= limit) {
                return STOP_PROSE_SCAN;
            }
        }

        return true;
    }, MAX_MARKDOWN_LINK_DOC_SCAN_NODES);

    return matches;
}

function collectRawMarkdownLinkMatchesFromTextNode(
    text: string,
    pos: number,
    matches: RawMarkdownLinkMatch[],
    limit: number,
): boolean {
    const scanText = text.slice(0, MAX_MARKDOWN_LINK_TEXT_SCAN_CHARS);
    if (!MARKDOWN_LINK_TRIGGER_TEXT_PATTERN.test(scanText)) {
        return true;
    }

    MARKDOWN_LINK_PATTERN_GLOBAL.lastIndex = 0;

    let match;
    while ((match = MARKDOWN_LINK_PATTERN_GLOBAL.exec(scanText)) !== null) {
        if (match.index > 0 && scanText[match.index - 1] === '!') {
            continue;
        }

        const fullMatch = match[0];
        matches.push({
            from: pos + match.index,
            linkText: match[1],
            linkUrl: match[2],
            to: pos + match.index + fullMatch.length,
        });

        if (matches.length >= limit) {
            return false;
        }
    }

    return true;
}

export function collectRawMarkdownLinkMatchesInRange(
    doc: ProseNode,
    from: number,
    to: number,
    maxMatches = MAX_MARKDOWN_LINK_AUTO_COLLAPSE_MATCHES,
    maxScanNodes = MAX_MARKDOWN_LINK_DOC_SCAN_NODES,
): RawMarkdownLinkMatch[] {
    const limit = Math.max(0, Math.floor(maxMatches));
    const matches: RawMarkdownLinkMatch[] = [];
    if (limit === 0 || typeof doc.nodesBetween !== 'function') return matches;

    const docSize = doc.content.size;
    const start = Math.max(0, Math.min(from, docSize));
    const end = Math.max(start, Math.min(to, docSize));
    if (start >= end) return matches;

    let scannedNodes = 0;
    doc.nodesBetween(start, end, (node, pos) => {
        scannedNodes += 1;
        if (scannedNodes > maxScanNodes) return false;
        if (!node.isText || !node.text) return true;
        return collectRawMarkdownLinkMatchesFromTextNode(node.text, pos, matches, limit);
    });

    return matches;
}

export function collectRawMarkdownLinkMatchesInRanges(
    doc: ProseNode,
    ranges: readonly MarkdownLinkScanRange[],
): RawMarkdownLinkMatch[] {
    const matches: RawMarkdownLinkMatch[] = [];

    for (const range of ranges) {
        if (matches.length >= MAX_MARKDOWN_LINK_AUTO_COLLAPSE_MATCHES) break;
        matches.push(...collectRawMarkdownLinkMatchesInRange(
            doc,
            range.from,
            range.to,
            MAX_MARKDOWN_LINK_AUTO_COLLAPSE_MATCHES - matches.length,
        ));
    }

    return matches;
}
