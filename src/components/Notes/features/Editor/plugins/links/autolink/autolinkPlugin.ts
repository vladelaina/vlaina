import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { collectHtmlTagRanges, isOffsetInRanges, type ContentRange } from '@/lib/markdown/markdownRanges';
import { isLocalNetworkHttpUrl } from '@/lib/notes/markdown/urlSecurity';
import { URL_PATTERNS } from '../utils/constants';
import { sanitizeEditorExternalLinkHref } from '../utils/linkHref';
import {
    DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT,
    STOP_PROSE_SCAN,
    scanProseDescendants,
} from '../../shared/boundedProseNodeScan';
import { getTransactionChangedRanges } from '../../shared/transactionStepText';

export const autolinkPluginKey = new PluginKey('autolink');
export const MAX_AUTOLINK_DECORATIONS = 1000;
export const MAX_AUTOLINK_DOC_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
export const MAX_AUTOLINK_UPDATE_RANGE_SCAN_NODES = MAX_AUTOLINK_DOC_SCAN_NODES;
export const MAX_AUTOLINK_TEXT_SCAN_CHARS = 1024 * 1024;
export const MAX_AUTOLINK_TRANSACTION_STEP_TEXT_CHARS = 200_000;
export const MAX_AUTOLINK_CHANGED_CONTEXT_CHARS = 512;
const AUTOLINK_TRIGGER_TEXT_PATTERN = /[:/.@]/;
const SKIPPED_TEXT_PARENT_TYPES = new Set(['code_block', 'html_block']);
const SKIPPED_MARK_TYPES = new Set(['inlineCode', 'code']);

interface LinkMatch {
    start: number;
    end: number;
    url: string;
    href: string;
}

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
        // Reset regex state
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

            // Add protocol if missing
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

function transactionStepMayCreateAutolink(step: unknown): boolean {
    const slice = (step as { slice?: { content?: { textBetween?: (from: number, to: number, blockSeparator?: string, leafText?: string) => string; size?: number } } }).slice;
    const content = slice?.content;
    if (!content || typeof content.textBetween !== 'function' || typeof content.size !== 'number') {
        return false;
    }
    if (content.size > MAX_AUTOLINK_TRANSACTION_STEP_TEXT_CHARS) {
        return true;
    }
    return AUTOLINK_TRIGGER_TEXT_PATTERN.test(content.textBetween(0, content.size, '\n', '\ufffc'));
}

export function transactionMayCreateAutolink(tr: unknown): boolean {
    const steps = (tr as { steps?: readonly unknown[] }).steps ?? [];
    if (steps.length === 0) {
        return false;
    }

    return steps.some(transactionStepMayCreateAutolink);
}

export function textMayContainAutolinkCandidate(text: string): boolean {
    AUTOLINK_TRIGGER_TEXT_PATTERN.lastIndex = 0;
    if (!AUTOLINK_TRIGGER_TEXT_PATTERN.test(text)) {
        return false;
    }
    return findUrls(text, 0, 1).length > 0;
}

function transactionChangedContextMayContainAutolinkCandidate(doc: any, tr: unknown): boolean {
    if (typeof doc.textBetween !== 'function') return false;

    const docSize = typeof doc.content?.size === 'number' ? doc.content.size : 0;
    for (const range of getTransactionChangedRanges(tr)) {
        for (const pos of [range.newFrom, range.newTo]) {
            const safePos = Math.max(0, Math.min(pos, docSize));
            const from = Math.max(0, safePos - MAX_AUTOLINK_CHANGED_CONTEXT_CHARS);
            const to = Math.min(docSize, safePos + MAX_AUTOLINK_CHANGED_CONTEXT_CHARS);
            if (from >= to) continue;
            if (textMayContainAutolinkCandidate(doc.textBetween(from, to, '\n', '\ufffc'))) {
                return true;
            }
        }
    }

    return false;
}

type AutolinkDecorationSetLike = {
    find: (from?: number, to?: number) => unknown[];
};

type MappingLike = {
    maps?: readonly {
        forEach?: (
            callback: (oldStart: number, oldEnd: number, newStart: number, newEnd: number) => void,
        ) => void;
    }[];
};

export function transactionMayAffectExistingAutolinks(
    decorations: AutolinkDecorationSetLike,
    tr: unknown,
): boolean {
    const mapping = (tr as { mapping?: MappingLike }).mapping;
    const maps = mapping?.maps ?? [];
    for (const map of maps) {
        if (typeof map.forEach !== 'function') {
            continue;
        }

        let affectsAutolink = false;
        map.forEach((oldStart, oldEnd) => {
            if (affectsAutolink) {
                return;
            }

            const from = Math.max(0, Math.min(oldStart, oldEnd) - 1);
            const to = Math.max(oldStart, oldEnd) + 1;
            affectsAutolink = decorations.find(from, to).length > 0;
        });

        if (affectsAutolink) {
            return true;
        }
    }

    return false;
}

type AutolinkUpdateRange = {
    from: number;
    to: number;
};

function addTextblockRangeAt(doc: any, pos: number, ranges: AutolinkUpdateRange[]): void {
    if (typeof doc.resolve !== 'function') return;
    const docSize = typeof doc.content?.size === 'number' ? doc.content.size : 0;
    const safePos = Math.max(0, Math.min(pos, docSize));

    try {
        const $pos = doc.resolve(safePos);
        for (let depth = $pos.depth; depth > 0; depth -= 1) {
            const node = $pos.node(depth);
            if (!node?.isTextblock) continue;
            ranges.push({
                from: $pos.start(depth),
                to: $pos.end(depth),
            });
            return;
        }
    } catch {
    }
}

function mergeAutolinkUpdateRanges(ranges: AutolinkUpdateRange[]): AutolinkUpdateRange[] {
    if (ranges.length <= 1) return ranges;

    const sorted = [...ranges]
        .filter((range) => Number.isFinite(range.from) && Number.isFinite(range.to) && range.to > range.from)
        .sort((a, b) => a.from - b.from || a.to - b.to);
    const merged: AutolinkUpdateRange[] = [];

    for (const range of sorted) {
        const previous = merged[merged.length - 1];
        if (!previous || range.from > previous.to + 1) {
            merged.push({ ...range });
            continue;
        }
        previous.to = Math.max(previous.to, range.to);
    }

    return merged;
}

export function collectAutolinkUpdateRanges(
    doc: any,
    tr: unknown,
    maxScanNodes = MAX_AUTOLINK_UPDATE_RANGE_SCAN_NODES,
): AutolinkUpdateRange[] {
    const ranges: AutolinkUpdateRange[] = [];
    const docSize = typeof doc.content?.size === 'number' ? doc.content.size : 0;
    let scannedNodes = 0;

    for (const range of getTransactionChangedRanges(tr)) {
        const from = Math.max(0, Math.min(range.newFrom, range.newTo, docSize));
        const to = Math.max(from, Math.min(Math.max(range.newFrom, range.newTo), docSize));

        addTextblockRangeAt(doc, from, ranges);
        addTextblockRangeAt(doc, to, ranges);

        if (to > from && typeof doc.nodesBetween === 'function') {
            let exhausted = false;
            doc.nodesBetween(from, to, (node: any, pos: number) => {
                scannedNodes += 1;
                if (scannedNodes > maxScanNodes) {
                    exhausted = true;
                    return false;
                }
                if (!node.isTextblock || typeof node.nodeSize !== 'number') return true;
                ranges.push({
                    from: pos + 1,
                    to: Math.max(pos + 1, pos + node.nodeSize - 1),
                });
                return true;
            });
            if (exhausted) {
                return [{ from: 0, to: docSize }];
            }
        }
    }

    return mergeAutolinkUpdateRanges(ranges);
}

export function updateAutolinkDecorationsForTransaction(
    previous: DecorationSet,
    tr: unknown,
    doc: any,
): DecorationSet {
    const mapped = previous.map((tr as { mapping: any }).mapping, doc);
    const ranges = collectAutolinkUpdateRanges(doc, tr);
    if (ranges.length === 0) {
        return mapped;
    }

    const decorationsToRemove: Decoration[] = [];
    for (const range of ranges) {
        decorationsToRemove.push(...mapped.find(range.from, range.to) as Decoration[]);
    }

    let next = decorationsToRemove.length > 0
        ? mapped.remove(decorationsToRemove)
        : mapped;
    let remainingBudget = MAX_AUTOLINK_DECORATIONS - next.find().length;
    if (remainingBudget <= 0) {
        return next;
    }

    for (const range of ranges) {
        if (remainingBudget <= 0) break;
        const decorations = collectAutolinkDecorationsInRange(doc, range.from, range.to, remainingBudget);
        if (decorations.length === 0) continue;
        next = next.add(doc, decorations);
        remainingBudget -= decorations.length;
    }

    return next;
}

export const autolinkPlugin = $prose(() => {
    return new Plugin({
        key: autolinkPluginKey,
        state: {
            init(_, { doc }) {
                return createAutolinkDecorations(doc);
            },
            apply(tr, old) {
                if (!tr.docChanged) {
                    return old;
                }

                const mayCreateAutolink = transactionMayCreateAutolink(tr);
                if (
                    !mayCreateAutolink
                    && !transactionMayAffectExistingAutolinks(old, tr)
                    && !transactionChangedContextMayContainAutolinkCandidate(tr.doc, tr)
                ) {
                    return old.map(tr.mapping, tr.doc);
                }

                return updateAutolinkDecorationsForTransaction(old, tr, tr.doc);
            }
        },
        props: {
            decorations(state) {
                return this.getState(state);
            },
            handleTextInput(view, from, to, text) {
                // LINK BREAKER: If user types a space (or other whitespace) at the end of a link, break out of the link mark.
                // This prevents "greedy links" that eat the space and following text.
                if (/\s/.test(text)) {
                    const { state } = view;
                    const { selection } = state;
                    const $pos = selection.$from;

                    // Check if we are inside a link mark
                    const linkMark = state.schema.marks.link;
                    const hasLink = linkMark && $pos.marks().some(m => m.type.name === linkMark.name);

                    // And if we are at the end of that mark (or simply inside one, we want space to break it)
                    if (hasLink) {
                        // Dispatch a transaction that inserts the space WITHOUT the link mark
                        // This effectively "turns off" the link for future typing
                        const tr = state.tr.insertText(text, from, to);
                        tr.removeStoredMark(linkMark);
                        view.dispatch(tr);
                        return true; // We handled the input
                    }
                }
                return false;
            }
        }
    });
});
