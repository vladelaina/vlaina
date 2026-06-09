import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { isLocalNetworkHttpUrl } from '@/lib/notes/markdown/urlSecurity';
import { URL_PATTERNS } from '../utils/constants';
import { sanitizeEditorExternalLinkHref } from '../utils/linkHref';
import {
    STOP_PROSE_SCAN,
    scanProseDescendants,
} from '../../shared/boundedProseNodeScan';

export const autolinkPluginKey = new PluginKey('autolink');
export const MAX_AUTOLINK_DECORATIONS = 1000;
export const MAX_AUTOLINK_TEXT_SCAN_CHARS = 1024 * 1024;
export const MAX_AUTOLINK_TRANSACTION_STEP_TEXT_CHARS = 200_000;
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

function hasUnbalancedTrailingCloseParen(url: string): boolean {
    let balance = 0;
    for (const char of url) {
        if (char === '(') balance += 1;
        if (char === ')') balance -= 1;
    }
    return balance < 0;
}

export function trimTrailingUrlPunctuation(url: string): string {
    let trimmed = url;
    while (trimmed.length > 0) {
        const lastChar = trimmed[trimmed.length - 1];
        if (/[.,;:!?]/.test(lastChar)) {
            trimmed = trimmed.slice(0, -1);
            continue;
        }
        if (lastChar === ')' && hasUnbalancedTrailingCloseParen(trimmed)) {
            trimmed = trimmed.slice(0, -1);
            continue;
        }
        break;
    }
    return trimmed;
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
            } else if (url.includes('@') && !url.startsWith('mailto:')) {
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

export function collectAutolinkDecorations(doc: any): Decoration[] {
    const decorations: Decoration[] = [];

    scanProseDescendants(doc, (node, pos, parent) => {
        if (decorations.length >= MAX_AUTOLINK_DECORATIONS) {
            return STOP_PROSE_SCAN;
        }

        const parentType = parent.type?.name;
        if (parentType && SKIPPED_TEXT_PARENT_TYPES.has(parentType)) {
            return;
        }

        if (node.marks?.some((mark: any) => SKIPPED_MARK_TYPES.has(mark.type?.name))) {
            return;
        }

        if (node.isText) {
            const text = (node.text || '').slice(0, MAX_AUTOLINK_TEXT_SCAN_CHARS);
            if (!AUTOLINK_TRIGGER_TEXT_PATTERN.test(text)) {
                return;
            }
            const matches = findUrls(text, pos, MAX_AUTOLINK_DECORATIONS - decorations.length);

            for (const match of matches) {
                // Check if already inside a link mark
                const $pos = doc.resolve(match.start);
                const marks = $pos.marks();
                const hasLinkMark = marks.some((m: any) => m.type.name === 'link');

                // Check if this URL is inside a Markdown link syntax ](url)
                // Look backwards from the match start to see if there's a ](
                const textBefore = text.slice(0, match.start - pos);
                const isInMarkdownLink = /\]\($/.test(textBefore);

                if (!hasLinkMark && !isInMarkdownLink) {
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
                    if (decorations.length >= MAX_AUTOLINK_DECORATIONS) break;
                }
            }
        }

        return decorations.length < MAX_AUTOLINK_DECORATIONS ? undefined : STOP_PROSE_SCAN;
    });

    return decorations;
}

export function createAutolinkDecorations(doc: any): DecorationSet {
    return DecorationSet.create(doc, collectAutolinkDecorations(doc));
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
                if (!mayCreateAutolink && !transactionMayAffectExistingAutolinks(old, tr)) {
                    return old.map(tr.mapping, tr.doc);
                }

                // For small changes, try mapping first
                // Optimization removed: We need to check every change because:
                // 1. Typing a URL char-by-char needs to extend the link
                // 2. Typing a space needs to terminate the link (re-run regex to exclude space)
                // The previous check (text.includes('http')) failed these cases.
                // if (tr.steps.length <= 2) { ... }

                return createAutolinkDecorations(tr.doc);
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
