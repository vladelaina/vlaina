import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { collectHtmlTagRanges, isOffsetInRanges, type ContentRange } from '@/lib/markdown/markdownRanges';
import { isLocalNetworkHttpUrl } from '@/lib/notes/markdown/urlSecurity';
import { URL_PATTERNS } from '../utils/constants';
import { sanitizeEditorExternalLinkHref } from '../utils/linkHref';
import {
    STOP_PROSE_SCAN,
    scanProseDescendants,
} from '../../shared/boundedProseNodeScan';
import {
    AUTOLINK_TRIGGER_TEXT_PATTERN,
    MAX_AUTOLINK_DECORATIONS,
    MAX_AUTOLINK_DOC_SCAN_NODES,
    MAX_AUTOLINK_TEXT_SCAN_CHARS,
} from './autolinkConstants';

interface LinkMatch {
    start: number;
    end: number;
    url: string;
    href: string;
}

const SKIPPED_TEXT_PARENT_TYPES = new Set(['code_block', 'html_block']);
const SKIPPED_MARK_TYPES = new Set(['inlineCode', 'code']);

function overlapsExistingMatch(start: number, end: number, matches: LinkMatch[]): boolean {
    return matches.some((match) => start < match.end && end > match.start);
}

function getParenBalance(url: string): number {
    let balance = 0;
    for (const char of url) {
        if (char === '(') balance += 1;
        if (char === ')') balance -= 1;
    }
    return balance;
}

function getAutolinkHtmlTagProtectionRanges(text: string): ContentRange[] {
    const scan = collectHtmlTagRanges(text, { start: 0, end: text.length }, MAX_AUTOLINK_DECORATIONS);
    return [...scan.ranges, ...scan.protectedRanges]
        .sort((left, right) => left.start - right.start || left.end - right.end);
}

export function trimTrailingUrlPunctuation(url: string): string {
    let end = url.length;
    let parenBalance = getParenBalance(url);
    while (end > 0) {
        const lastChar = url[end - 1];
        if (/[.,;:!?]/.test(lastChar)) {
            end -= 1;
            continue;
        }
        if (lastChar === ')' && parenBalance < 0) {
            end -= 1;
            parenBalance += 1;
            continue;
        }
        break;
    }
    return end === url.length ? url : url.slice(0, end);
}

export function findUrls(text: string, offset: number, maxMatches = Number.POSITIVE_INFINITY): LinkMatch[] {
    const matches: LinkMatch[] = [];
    if (maxMatches <= 0) {
        return matches;
    }

    for (const pattern of URL_PATTERNS) {
        pattern.lastIndex = 0;
        let match;

        while ((match = pattern.exec(text)) !== null) {
            if (matches.length >= maxMatches) {
                return matches;
            }

            let url = match[0];
            let href = url;

            url = trimTrailingUrlPunctuation(url);
            href = url;
            const start = offset + match.index;
            const end = start + url.length;
            if (overlapsExistingMatch(start, end, matches)) {
                continue;
            }

            if (url.startsWith('www.')) {
                href = 'https://' + url;
            } else if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) {
                href = url;
            } else if (url.includes('@')) {
                href = 'mailto:' + url;
            } else if (!/^https?:\/\//i.test(url)) {
                href = 'https://' + url;
            }

            matches.push({
                start,
                end,
                url,
                href
            });
            if (matches.length >= maxMatches) {
                return matches;
            }
        }
    }

    return matches;
}

function sanitizeAutolinkHref(href: string): string | null {
    const safeHref = sanitizeEditorExternalLinkHref(href);
    if (!safeHref) return null;
    if (/^https?:\/\//i.test(safeHref) && isLocalNetworkHttpUrl(safeHref)) return null;
    return safeHref;
}

function collectAutolinkDecorationsFromTextNode(
    doc: any,
    node: any,
    pos: number,
    parent: any,
    decorations: Decoration[],
    maxDecorations = MAX_AUTOLINK_DECORATIONS,
): void {
    if (decorations.length >= maxDecorations) return;

    const parentType = parent?.type?.name;
    if (parentType && SKIPPED_TEXT_PARENT_TYPES.has(parentType)) {
        return;
    }

    if (node.marks?.some((mark: any) => SKIPPED_MARK_TYPES.has(mark.type?.name))) {
        return;
    }

    const text = (node.text || '').slice(0, MAX_AUTOLINK_TEXT_SCAN_CHARS);
    AUTOLINK_TRIGGER_TEXT_PATTERN.lastIndex = 0;
    if (!AUTOLINK_TRIGGER_TEXT_PATTERN.test(text)) {
        return;
    }

    const matches = findUrls(text, pos, maxDecorations - decorations.length);
    const htmlTagProtectionRanges = text.includes('<')
        ? getAutolinkHtmlTagProtectionRanges(text)
        : [];

    for (const match of matches) {
        const $pos = doc.resolve(match.start);
        const marks = $pos.marks();
        const hasLinkMark = marks.some((m: any) => m.type.name === 'link');
        const textBefore = text.slice(0, match.start - pos);
        const isInMarkdownLink = /\]\($/.test(textBefore);
        const isInInlineHtmlTag = isOffsetInRanges(match.start - pos, htmlTagProtectionRanges);

        if (!hasLinkMark && !isInMarkdownLink && !isInInlineHtmlTag) {
            const safeHref = sanitizeAutolinkHref(match.href);
            if (!safeHref) continue;

            decorations.push(
                Decoration.inline(match.start, match.end, {
                    class: 'autolink',
                    'data-href': safeHref,
                    nodeName: 'a',
                    href: safeHref,
                    target: '_blank',
                    rel: 'noopener noreferrer'
                })
            );
            if (decorations.length >= maxDecorations) break;
        }
    }
}

export function collectAutolinkDecorations(doc: any): Decoration[] {
    const decorations: Decoration[] = [];

    scanProseDescendants(doc, (node, pos, parent) => {
        if (decorations.length >= MAX_AUTOLINK_DECORATIONS) {
            return STOP_PROSE_SCAN;
        }

        if (node.isText) {
            collectAutolinkDecorationsFromTextNode(
                doc,
                node,
                pos,
                parent,
                decorations,
                MAX_AUTOLINK_DECORATIONS,
            );
        }

        return decorations.length < MAX_AUTOLINK_DECORATIONS ? undefined : STOP_PROSE_SCAN;
    }, MAX_AUTOLINK_DOC_SCAN_NODES);

    return decorations;
}

export function createAutolinkDecorations(doc: any): DecorationSet {
    return DecorationSet.create(doc, collectAutolinkDecorations(doc));
}

export function collectAutolinkDecorationsInRange(
    doc: any,
    from: number,
    to: number,
    maxDecorations = MAX_AUTOLINK_DECORATIONS,
    maxScanNodes = MAX_AUTOLINK_DOC_SCAN_NODES,
): Decoration[] {
    const decorations: Decoration[] = [];
    const docSize = typeof doc.content?.size === 'number' ? doc.content.size : 0;
    const start = Math.max(0, Math.min(from, docSize));
    const end = Math.max(start, Math.min(to, docSize));
    if (start >= end || typeof doc.nodesBetween !== 'function') {
        return decorations;
    }

    let scannedNodes = 0;
    doc.nodesBetween(start, end, (node: any, pos: number, parent: any) => {
        scannedNodes += 1;
        if (scannedNodes > maxScanNodes) return false;
        if (decorations.length >= maxDecorations) return false;
        if (!node.isText) return true;
        collectAutolinkDecorationsFromTextNode(doc, node, pos, parent, decorations, maxDecorations);
        return decorations.length < maxDecorations;
    });

    return decorations;
}

export function textMayContainAutolinkCandidate(text: string): boolean {
    AUTOLINK_TRIGGER_TEXT_PATTERN.lastIndex = 0;
    if (!AUTOLINK_TRIGGER_TEXT_PATTERN.test(text)) {
        return false;
    }
    return findUrls(text, 0, 1).length > 0;
}
