import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Fragment, Slice, type Mark as ProseMark, type Node as ProseNode } from '@milkdown/kit/prose/model';
import { resolvePasteRange } from '../../clipboard/pasteCursorUtils';
import { sanitizeExplicitMarkdownLinkHref } from '../utils/linkHref';
import {
    getMarkdownLinkHref,
    MARKDOWN_LINK_PATTERN_BEFORE,
    MARKDOWN_LINK_PATTERN_GLOBAL,
    MARKDOWN_LINK_REGEX,
    shouldHandleMarkdownLinkPaste,
} from './markdownLinkParser';
import {
    DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT,
    STOP_PROSE_SCAN,
    scanProseDescendants,
} from '../../shared/boundedProseNodeScan';

export const markdownLinkPluginKey = new PluginKey('markdown-link-paste');
const MAX_MARKDOWN_LINK_DOC_SCAN_SIZE = 1024 * 1024;
export const MAX_MARKDOWN_LINK_DOC_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
export const MAX_MARKDOWN_LINK_AUTO_COLLAPSE_MATCHES = 5000;
export const MAX_MARKDOWN_LINK_TEXT_SCAN_CHARS = 1024 * 1024;
export const MAX_MARKDOWN_LINK_INPUT_LOOKBACK_CHARS = 1024 * 1024;
export const MAX_MARKDOWN_LINK_TRANSACTION_STEP_TEXT_CHARS = 200_000;
const MAX_MARKDOWN_LINK_PASTE_CHARS = 1024 * 1024;
export const MAX_MARKDOWN_LINK_PASTE_NODES = 5000;
const MARKDOWN_LINK_TRIGGER_TEXT_PATTERN = /[\[\]\(\)]/;

interface MarkdownLinkPluginState {
    hasRawMarkdownLink: boolean;
}

export interface RawMarkdownLinkMatch {
    from: number;
    linkText: string;
    linkUrl: string;
    to: number;
}

function transactionStepMayCreateMarkdownLink(step: unknown): boolean {
    const slice = (step as { slice?: { content?: { textBetween?: (from: number, to: number, blockSeparator?: string, leafText?: string) => string; size?: number } } }).slice;
    const content = slice?.content;
    if (!content || typeof content.textBetween !== 'function' || typeof content.size !== 'number') {
        return false;
    }
    if (content.size > MAX_MARKDOWN_LINK_TRANSACTION_STEP_TEXT_CHARS) {
        return true;
    }
    return MARKDOWN_LINK_TRIGGER_TEXT_PATTERN.test(content.textBetween(0, content.size, '\n', '\ufffc'));
}

export function transactionMayCreateMarkdownLink(tr: unknown): boolean {
    const steps = (tr as { steps?: readonly unknown[] }).steps ?? [];
    return steps.some(transactionStepMayCreateMarkdownLink);
}

function textContainsRawMarkdownLink(text: string): boolean {
    MARKDOWN_LINK_PATTERN_GLOBAL.lastIndex = 0;
    return MARKDOWN_LINK_PATTERN_GLOBAL.test(text.slice(0, MAX_MARKDOWN_LINK_TEXT_SCAN_CHARS));
}

export function getMarkdownLinkInputTextBeforeCursor(
    parent: { textBetween: (from: number, to: number, blockSeparator?: string | null, leafText?: string | null) => string },
    parentOffset: number,
): string {
    return parent.textBetween(
        Math.max(0, parentOffset - MAX_MARKDOWN_LINK_INPUT_LOOKBACK_CHARS),
        parentOffset,
        '\0',
        '\0'
    );
}

function positionTouchesRawMarkdownLink(doc: ProseNode, pos: number): boolean {
    const resolvedPos = Math.max(0, Math.min(pos, doc.content.size));
    const $pos = doc.resolve(resolvedPos);

    for (let depth = $pos.depth; depth > 0; depth -= 1) {
        const node = $pos.node(depth);
        if (node.isTextblock && textContainsRawMarkdownLink(node.textBetween(0, node.content.size, '\n', '\ufffc'))) {
            return true;
        }
    }

    const nodeBefore = $pos.nodeBefore;
    const nodeAfter = $pos.nodeAfter;
    return Boolean(
        (nodeBefore?.isText && textContainsRawMarkdownLink(nodeBefore.text ?? ''))
        || (nodeAfter?.isText && textContainsRawMarkdownLink(nodeAfter.text ?? ''))
    );
}

export function rangeTouchesRawMarkdownLink(
    doc: ProseNode,
    from: number,
    to: number,
    checkBoundaryPositions = true
): boolean {
    const start = Math.max(0, Math.min(from, doc.content.size));
    const end = Math.max(start, Math.min(to, doc.content.size));
    if (
        checkBoundaryPositions
        && (positionTouchesRawMarkdownLink(doc, start) || positionTouchesRawMarkdownLink(doc, end))
    ) {
        return true;
    }

    let touchesRawMarkdownLink = false;
    const scanTo = Math.min(doc.content.size, Math.max(start + 1, end));
    scanProseDescendants(doc, (node, pos) => {
        const nodeSize = typeof node.nodeSize === 'number' ? node.nodeSize : 1;
        const nodeEnd = pos + nodeSize;
        if (nodeEnd < start) return true;
        if (pos > scanTo) return STOP_PROSE_SCAN;
        if (node.isText && textContainsRawMarkdownLink(node.text ?? '')) {
            touchesRawMarkdownLink = true;
            return STOP_PROSE_SCAN;
        }
        return true;
    }, MAX_MARKDOWN_LINK_DOC_SCAN_NODES);

    return touchesRawMarkdownLink;
}

export function docChangeMayAffectRawMarkdownLink(prevDoc: ProseNode, nextDoc: ProseNode): boolean {
    const diffStart = prevDoc.content.findDiffStart(nextDoc.content);
    if (diffStart === null) return false;

    const diffEnd = prevDoc.content.findDiffEnd(nextDoc.content);
    if (!diffEnd) return true;

    return (
        rangeTouchesRawMarkdownLink(prevDoc, diffStart, diffEnd.a)
        || rangeTouchesRawMarkdownLink(nextDoc, diffStart, diffEnd.b)
    );
}

export function isMarkdownImagePatternBeforeCursor(textBefore: string, fullMatch: string): boolean {
    const matchStart = textBefore.length - fullMatch.length;
    return matchStart > 0 && textBefore[matchStart - 1] === '!';
}

export function docHasRawMarkdownLink(doc: ProseNode): boolean {
    let hasRawMarkdownLink = false;
    scanProseDescendants(doc, (node) => {
        if (!node.isText || !node.text) return true;

        hasRawMarkdownLink = textContainsRawMarkdownLink(node.text);
        return hasRawMarkdownLink ? STOP_PROSE_SCAN : true;
    }, MAX_MARKDOWN_LINK_DOC_SCAN_NODES);
    return hasRawMarkdownLink;
}

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

export const markdownLinkPlugin = $prose(() => {
    return new Plugin<MarkdownLinkPluginState>({
        key: markdownLinkPluginKey,
        state: {
            init(_config, state) {
                return {
                    hasRawMarkdownLink: state.doc.content.size <= MAX_MARKDOWN_LINK_DOC_SCAN_SIZE
                        ? docHasRawMarkdownLink(state.doc)
                        : false,
                };
            },
            apply(tr, previous, oldState) {
                if (!tr.docChanged) {
                    return previous;
                }

                if (tr.doc.content.size > MAX_MARKDOWN_LINK_DOC_SCAN_SIZE) {
                    return { hasRawMarkdownLink: false };
                }

                if (!previous.hasRawMarkdownLink && !transactionMayCreateMarkdownLink(tr)) {
                    return previous;
                }

                if (
                    previous.hasRawMarkdownLink
                    && !transactionMayCreateMarkdownLink(tr)
                    && !docChangeMayAffectRawMarkdownLink(oldState.doc, tr.doc)
                ) {
                    return previous;
                }

                return {
                    hasRawMarkdownLink: docHasRawMarkdownLink(tr.doc),
                };
            },
        },

        // Auto-collapse when selection moves away from a markdown link pattern
        // AND cleanup unwanted styles (code, strong) from raw markdown link syntax
        appendTransaction(transactions, oldState, newState) {
            if (newState.doc.content.size > MAX_MARKDOWN_LINK_DOC_SCAN_SIZE) {
                return null;
            }

            if (!markdownLinkPluginKey.getState(newState)?.hasRawMarkdownLink) {
                return null;
            }

            const selectionChanged = !oldState.selection.eq(newState.selection);
            if (
                !selectionChanged
                && (
                    !transactions.some((tr) => tr.docChanged)
                    || !docChangeMayAffectRawMarkdownLink(oldState.doc, newState.doc)
                )
            ) {
                return null;
            }

            let tr = newState.tr;
            let hasChanges = false;
            const schema = newState.schema;
            const linkMarkType = schema.marks.link;

            if (!linkMarkType) return null;

            const rawMarkdownLinks = collectRawMarkdownLinkMatches(newState.doc);
            for (const rawMarkdownLink of rawMarkdownLinks) {
                const mapping = tr.mapping;
                const mappedStart = mapping.map(rawMarkdownLink.from);
                const mappedEnd = mapping.map(rawMarkdownLink.to);
                if (mappedEnd <= mappedStart) continue;

                // 1. SANITIZE STYLES: Remove ALL marks from the raw syntax [text](url)
                // This "Nuclear Option" strips any background/color/bold/code styles
                Object.values(schema.marks).forEach(markType => {
                    if (tr.doc.rangeHasMark(mappedStart, mappedEnd, markType)) {
                        tr.removeMark(mappedStart, mappedEnd, markType);
                        hasChanges = true;
                    }
                });

                // 2. AUTO-COLLAPSE: Check if new selection is OUTSIDE this pattern
                // Only if selection actually changed compared to old state
                if (!oldState.selection.eq(newState.selection)) {
                    const selFrom = newState.selection.from;
                    const selTo = newState.selection.to;
                    const isOutside = selTo < rawMarkdownLink.from || selFrom > rawMarkdownLink.to;

                    if (isOutside) {
                        const safeLinkUrl = sanitizeExplicitMarkdownLinkHref(getMarkdownLinkHref(rawMarkdownLink.linkUrl));
                        const marks = safeLinkUrl ? [linkMarkType.create({ href: safeLinkUrl })] : [];
                        tr = tr
                            .delete(mappedStart, mappedEnd)
                            .insert(mappedStart, schema.text(rawMarkdownLink.linkText, marks));

                        hasChanges = true;
                    }
                }
            }

            return hasChanges ? tr : null;
        },

        props: {
            handleTextInput(view, from, _to, inputText) {
                // Only trigger on space, newline, or certain punctuation
                if (!/^[\s.,;:!?，。；：！？、】【》）]$/.test(inputText)) {
                    return false;
                }

                const state = view.state;
                const doc = state.doc;

                // Get text before cursor
                const $from = doc.resolve(from);
                const textBefore = getMarkdownLinkInputTextBeforeCursor($from.parent, $from.parentOffset);

                // Check if there's a markdown link pattern ending at cursor
                const match = textBefore.match(MARKDOWN_LINK_PATTERN_BEFORE);
                if (!match) return false;

                const fullMatch = match[0];
                const linkText = match[1];
                const linkUrl = match[2];
                const linkMarkType = state.schema.marks.link;
                if (!linkMarkType) return false;

                // Calculate positions
                const linkStart = from - fullMatch.length;
                if (isMarkdownImagePatternBeforeCursor(textBefore, fullMatch)) {
                    return false;
                }

                // Create transaction
                const safeLinkUrl = sanitizeExplicitMarkdownLinkHref(getMarkdownLinkHref(linkUrl));
                const linkedText = safeLinkUrl
                    ? state.schema.text(linkText, [linkMarkType.create({ href: safeLinkUrl })])
                    : state.schema.text(linkText);
                const spaceText = state.schema.text(inputText);

                const tr = state.tr
                    .delete(linkStart, from)
                    .insert(linkStart, linkedText)
                    .insert(linkStart + linkText.length, spaceText);

                tr.removeStoredMark(linkMarkType);

                view.dispatch(tr);
                return true;
            },

            handlePaste(view, event) {
                const clipboardData = event.clipboardData;
                if (!clipboardData) return false;

                const text = clipboardData.getData('text/plain');
                if (text.length > MAX_MARKDOWN_LINK_PASTE_CHARS) {
                    event.preventDefault();
                    return true;
                }
                if (!shouldHandleMarkdownLinkPaste(text)) {
                    return false;
                }

                const linkMarkType = view.state.schema.marks.link;
                if (!linkMarkType) return false;

                const nodes = createMarkdownLinkPasteNodes(text, view.state.schema, linkMarkType);
                if (!nodes) {
                    const { from, to } = resolvePasteRange(view.state, Slice.empty);
                    const tr = view.state.tr.insertText(text, from, to);
                    view.dispatch(tr);
                    event.preventDefault();
                    return true;
                }

                const fragment = Fragment.from(nodes);
                const slice = new Slice(fragment, 0, 0);

                const { from, to } = resolvePasteRange(view.state, slice);
                const tr = view.state.tr.replaceRange(from, to, slice);
                view.dispatch(tr);

                event.preventDefault();
                return true;
            }
        }
    });
});
