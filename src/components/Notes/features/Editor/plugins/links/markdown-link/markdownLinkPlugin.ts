import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Fragment, Slice } from '@milkdown/kit/prose/model';

export const markdownLinkPluginKey = new PluginKey('markdown-link-paste');

// Regex to capture [text](url) - Markdown link format
const LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;
// Regex to find a markdown link pattern ending at position (for live conversion)
const LINK_PATTERN_BEFORE = /\[([^\]]+)\]\(([^)]+)\)$/;
// Regex to find markdown link at any position in text
const LINK_PATTERN_GLOBAL = /\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Plugin to handle Markdown link syntax:
 * 1. Paste: Convert [text](url) to Link Marks
 * 2. Live conversion: When user types space/newline after [text](url), convert to Link Mark
 * 3. Auto-collapse: When cursor moves away from [text](url), convert to Link Mark
 * 4. Copy: Serialize Link Marks as [text](url)
 */
export const markdownLinkPlugin = $prose(() => {
    return new Plugin({
        key: markdownLinkPluginKey,

        // Auto-collapse when selection moves away from a markdown link pattern
        // AND cleanup unwanted styles (code, strong) from raw markdown link syntax
        appendTransaction(_transactions, oldState, newState) {
            let tr = newState.tr;
            let hasChanges = false;
            const schema = newState.schema;
            const linkMarkType = schema.marks.link;

            if (!linkMarkType) return null;

            // Scan for markdown link patterns in text nodes
            newState.doc.descendants((node, pos) => {
                if (!node.isText || !node.text) return;

                const text = node.text;
                LINK_PATTERN_GLOBAL.lastIndex = 0;

                let match;
                while ((match = LINK_PATTERN_GLOBAL.exec(text)) !== null) {
                    const fullMatch = match[0];
                    const linkText = match[1];
                    const linkUrl = match[2];
                    const matchStart = pos + match.index;
                    const matchEnd = matchStart + fullMatch.length;

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
                                const linkMark = linkMarkType.create({ href: linkUrl });
                                tr = tr
                                    .delete(mappedStart, mappedEnd)
                                    .insert(mappedStart, schema.text(linkText, [linkMark]));

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
                if (!/^[\s.,;:!?]$/.test(inputText)) {
                    return false;
                }

                const state = view.state;
                const doc = state.doc;

                // Get text before cursor
                const $from = doc.resolve(from);
                const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\0', '\0');

                // Check if there's a markdown link pattern ending at cursor
                const match = textBefore.match(LINK_PATTERN_BEFORE);
                if (!match) return false;

                const fullMatch = match[0];
                const linkText = match[1];
                const linkUrl = match[2];
                const linkMarkType = state.schema.marks.link;
                if (!linkMarkType) return false;

                // Calculate positions
                const linkStart = from - fullMatch.length;

                // Create transaction
                const linkMark = linkMarkType.create({ href: linkUrl });
                const linkedText = state.schema.text(linkText, [linkMark]);
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
                if (!text) return false;

                LINK_REGEX.lastIndex = 0;
                if (!LINK_REGEX.test(text)) {
                    return false;
                }

                const linkMarkType = view.state.schema.marks.link;
                if (!linkMarkType) return false;

                LINK_REGEX.lastIndex = 0;
                const nodes: any[] = [];
                let lastIndex = 0;

                let match;
                while ((match = LINK_REGEX.exec(text)) !== null) {
                    const fullMatch = match[0];
                    const linkText = match[1];
                    const linkUrl = match[2];
                    const matchStart = match.index;

                    if (matchStart > lastIndex) {
                        const beforeText = text.slice(lastIndex, matchStart);
                        nodes.push(view.state.schema.text(beforeText));
                    }

                    const linkMark = linkMarkType.create({ href: linkUrl });
                    nodes.push(view.state.schema.text(linkText, [linkMark]));

                    lastIndex = matchStart + fullMatch.length;
                }

                if (lastIndex < text.length) {
                    const afterText = text.slice(lastIndex);
                    nodes.push(view.state.schema.text(afterText));
                }

                if (nodes.length === 0) return false;

                const fragment = Fragment.from(nodes);
                const slice = new Slice(fragment, 0, 0);

                const selFrom = view.state.selection.from;
                const selTo = view.state.selection.to;
                const tr = view.state.tr.replaceRange(selFrom, selTo, slice);
                view.dispatch(tr);

                event.preventDefault();
                return true;
            }
        }
    });
});