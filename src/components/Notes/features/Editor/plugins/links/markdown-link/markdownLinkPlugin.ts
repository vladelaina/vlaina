import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Fragment, Slice } from '@milkdown/kit/prose/model';
import { sanitizeNoteLinkHref } from '@/lib/notes/markdown/urlSecurity';
import { resolvePasteRange } from '../../clipboard/pasteCursorUtils';
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

export const markdownLinkPlugin = $prose(() => {
    return new Plugin({
        key: markdownLinkPluginKey,

        // Auto-collapse when selection moves away from a markdown link pattern
        // AND cleanup unwanted styles (code, strong) from raw markdown link syntax
        appendTransaction(_transactions, oldState, newState) {
            if (newState.doc.content.size > MAX_MARKDOWN_LINK_DOC_SCAN_SIZE) {
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
                                const safeLinkUrl = sanitizeNoteLinkHref(getMarkdownLinkHref(linkUrl));
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
                if (linkStart > 0 && textBefore[linkStart - 1] === '!') {
                    return false;
                }

                // Create transaction
                const safeLinkUrl = sanitizeNoteLinkHref(getMarkdownLinkHref(linkUrl));
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

                    const safeLinkUrl = sanitizeNoteLinkHref(getMarkdownLinkHref(linkUrl));
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
