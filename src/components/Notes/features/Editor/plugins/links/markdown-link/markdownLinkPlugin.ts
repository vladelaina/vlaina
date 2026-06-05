import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Fragment, Slice, type Node as ProseNode } from '@milkdown/kit/prose/model';
import { resolvePasteRange } from '../../clipboard/pasteCursorUtils';
import { sanitizeExplicitMarkdownLinkHref } from '../utils/linkHref';
import {
    getMarkdownLinkHref,
    MARKDOWN_LINK_PATTERN_BEFORE,
    MARKDOWN_LINK_PATTERN_GLOBAL,
    MARKDOWN_LINK_REGEX,
    shouldHandleMarkdownLinkPaste,
} from './markdownLinkParser';

export const markdownLinkPluginKey = new PluginKey('markdown-link-paste');
const MAX_MARKDOWN_LINK_DOC_SCAN_SIZE = 1024 * 1024;
const MAX_MARKDOWN_LINK_PASTE_CHARS = 1024 * 1024;
const MARKDOWN_LINK_TRIGGER_TEXT_PATTERN = /[\[\]\(\)]/;

interface MarkdownLinkPluginState {
    hasRawMarkdownLink: boolean;
}

function getInsertedStepText(step: unknown): string {
    const slice = (step as { slice?: { content?: { textBetween?: (from: number, to: number, blockSeparator?: string, leafText?: string) => string; size?: number } } }).slice;
    const content = slice?.content;
    if (!content || typeof content.textBetween !== 'function' || typeof content.size !== 'number') {
        return '';
    }
    return content.textBetween(0, content.size, '\n', '\ufffc');
}

function transactionMayCreateMarkdownLink(tr: unknown): boolean {
    const steps = (tr as { steps?: readonly unknown[] }).steps ?? [];
    return steps.some((step) => MARKDOWN_LINK_TRIGGER_TEXT_PATTERN.test(getInsertedStepText(step)));
}

export function isMarkdownImagePatternBeforeCursor(textBefore: string, fullMatch: string): boolean {
    const matchStart = textBefore.length - fullMatch.length;
    return matchStart > 0 && textBefore[matchStart - 1] === '!';
}

function docHasRawMarkdownLink(doc: ProseNode): boolean {
    let hasRawMarkdownLink = false;
    doc.descendants((node) => {
        if (hasRawMarkdownLink) return false;
        if (!node.isText || !node.text) return true;

        MARKDOWN_LINK_PATTERN_GLOBAL.lastIndex = 0;
        hasRawMarkdownLink = MARKDOWN_LINK_PATTERN_GLOBAL.test(node.text);
        return !hasRawMarkdownLink;
    });
    return hasRawMarkdownLink;
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
            apply(tr, previous) {
                if (!tr.docChanged) {
                    return previous;
                }

                if (tr.doc.content.size > MAX_MARKDOWN_LINK_DOC_SCAN_SIZE) {
                    return { hasRawMarkdownLink: false };
                }

                if (!previous.hasRawMarkdownLink && !transactionMayCreateMarkdownLink(tr)) {
                    return previous;
                }

                return {
                    hasRawMarkdownLink: docHasRawMarkdownLink(tr.doc),
                };
            },
        },

        // Auto-collapse when selection moves away from a markdown link pattern
        // AND cleanup unwanted styles (code, strong) from raw markdown link syntax
        appendTransaction(_transactions, oldState, newState) {
            if (newState.doc.content.size > MAX_MARKDOWN_LINK_DOC_SCAN_SIZE) {
                return null;
            }

            if (!markdownLinkPluginKey.getState(newState)?.hasRawMarkdownLink) {
                return null;
            }

            let tr = newState.tr;
            let hasChanges = false;
            const schema = newState.schema;
            const linkMarkType = schema.marks.link;

            if (!linkMarkType) return null;

            // Scan for markdown link patterns in text nodes
            newState.doc.descendants((node, pos) => {
                if (!node.isText || !node.text) return;

                const text = node.text;
                MARKDOWN_LINK_PATTERN_GLOBAL.lastIndex = 0;

                let match;
                while ((match = MARKDOWN_LINK_PATTERN_GLOBAL.exec(text)) !== null) {
                    const fullMatch = match[0];
                    const linkText = match[1];
                    const linkUrl = match[2];
                    const matchStart = pos + match.index;
                    const matchEnd = matchStart + fullMatch.length;
                    if (match.index > 0 && text[match.index - 1] === '!') {
                        continue;
                    }

                    // 1. SANITIZE STYLES: Remove ALL marks from the raw syntax [text](url)
                    // This "Nuclear Option" strips any background/color/bold/code styles
                    Object.values(schema.marks).forEach(markType => {
                        if (tr.doc.rangeHasMark(matchStart, matchEnd, markType)) {
                            tr.removeMark(matchStart, matchEnd, markType);
                            hasChanges = true;
                        }
                    });

                    // 2. AUTO-COLLAPSE: Check if new selection is OUTSIDE this pattern
                    // Only if selection actually changed compared to old state
                    if (!oldState.selection.eq(newState.selection)) {
                        const selFrom = newState.selection.from;
                        const selTo = newState.selection.to;
                        const isOutside = selTo < matchStart || selFrom > matchEnd;

                        if (isOutside) {
                            // Adjust positions for any previous changes in this transaction
                            // (Note: removeMark changes shouldn't shift positions, but delete/insert will)
                            const mapping = tr.mapping;
                            const mappedStart = mapping.map(matchStart);
                            const mappedEnd = mapping.map(matchEnd);

                            // Verify checking range validity after mapping
                            // (Simple check: ensure mappedEnd > mappedStart)
                            if (mappedEnd > mappedStart) {
                                const safeLinkUrl = sanitizeExplicitMarkdownLinkHref(getMarkdownLinkHref(linkUrl));
                                const marks = safeLinkUrl ? [linkMarkType.create({ href: safeLinkUrl })] : [];
                                tr = tr
                                    .delete(mappedStart, mappedEnd)
                                    .insert(mappedStart, schema.text(linkText, marks));

                                hasChanges = true;
                            }
                        }
                    }
                }
            });

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
                const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\0', '\0');

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

                MARKDOWN_LINK_REGEX.lastIndex = 0;
                const nodes: any[] = [];
                let lastIndex = 0;

                let match;
                while ((match = MARKDOWN_LINK_REGEX.exec(text)) !== null) {
                    const fullMatch = match[0];
                    const linkText = match[1];
                    const linkUrl = match[2];
                    const matchStart = match.index;

                    if (matchStart > lastIndex) {
                        const beforeText = text.slice(lastIndex, matchStart);
                        nodes.push(view.state.schema.text(beforeText));
                    }

                    const safeLinkUrl = sanitizeExplicitMarkdownLinkHref(getMarkdownLinkHref(linkUrl));
                    nodes.push(
                        safeLinkUrl
                            ? view.state.schema.text(linkText, [linkMarkType.create({ href: safeLinkUrl })])
                            : view.state.schema.text(linkText)
                    );

                    lastIndex = matchStart + fullMatch.length;
                }

                if (lastIndex < text.length) {
                    const afterText = text.slice(lastIndex);
                    nodes.push(view.state.schema.text(afterText));
                }

                if (nodes.length === 0) return false;

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
