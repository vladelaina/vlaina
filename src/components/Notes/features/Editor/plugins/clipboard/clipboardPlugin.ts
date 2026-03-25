import { $prose } from '@milkdown/kit/utils';
import { parserCtx, serializerCtx } from '@milkdown/kit/core';
import { Plugin, PluginKey, Selection } from '@milkdown/kit/prose/state';
import { Fragment, Slice, type Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { Parser, Serializer } from '@milkdown/kit/transformer';
import { collapseSelectionAndHideFloatingToolbar } from './copyCleanup';
import { sanitizeHtml } from './sanitizer';
import { serializeSelectionToClipboardText } from './selectionSerialization';
import { writeTextToClipboard } from '../cursor/blockSelectionCommands';
import { createCodeBlockAttrs } from '../code/codeBlockSettings';
import { normalizeLeadingFrontmatterMarkdown } from '../frontmatter/frontmatterMarkdown';
import { isTocShortcutText } from '../toc/tocShortcut';
import {
    extractLargestMarkdownFenceContent,
    looksLikeMarkdownForPaste,
    normalizeStandaloneThematicBreaksForPaste,
    parseStandaloneAtxHeading,
    parseStandaloneFencedCodeBlock,
} from './fencedCodePaste';
import { findTailCursorPosInRange, isMarkdownStructuralResult } from './pasteCursorUtils';

export const clipboardPluginKey = new PluginKey('vlaina-clipboard');

export function createStandaloneTocPasteNode(schema: {
    nodes: {
        toc?: {
            create: (attrs: { maxLevel: number }) => ProseNode;
        };
    };
}, text: string): ProseNode | null {
    if (!isTocShortcutText(text)) return null;

    const tocType = schema.nodes.toc;
    if (!tocType) return null;

    return tocType.create({ maxLevel: 6 });
}

export const clipboardPlugin = $prose((ctx) => {
    let markdownParser: Parser | null = null;
    let markdownSerializer: Serializer | null = null;
    const getMarkdownParser = () => {
        if (markdownParser) return markdownParser;
        try {
            markdownParser = ctx.get(parserCtx);
            return markdownParser;
        } catch {
            return null;
        }
    };
    const getMarkdownSerializer = () => {
        if (markdownSerializer) return markdownSerializer;
        try {
            markdownSerializer = ctx.get(serializerCtx);
            return markdownSerializer;
        } catch {
            return null;
        }
    };

    const dispatchSliceAndKeepCursorAtTail = (view: EditorView, slice: Slice) => {
        const { state } = view;
        const { from, to } = state.selection;
        const tr = state.tr.replaceRange(from, to, slice);
        const mappedFrom = tr.mapping.map(from, -1);
        const mappedTo = Math.min(mappedFrom + slice.content.size, tr.doc.content.size);
        const tailPos = findTailCursorPosInRange(tr.doc, mappedFrom, mappedTo) ?? mappedTo;
        const safePos = Math.max(0, Math.min(tailPos, tr.doc.content.size));

        tr.setSelection(Selection.near(tr.doc.resolve(safePos), -1));
        view.dispatch(tr.scrollIntoView());

        return safePos;
    };

    const parseMarkdownNodes = (text: string): ProseNode[] | null => {
        if (!looksLikeMarkdownForPaste(text)) return null;

        const parser = getMarkdownParser();
        if (!parser) return null;

        let parsedDoc: ProseNode;
        try {
            parsedDoc = parser(
                normalizeStandaloneThematicBreaksForPaste(
                    normalizeLeadingFrontmatterMarkdown(text)
                )
            );
        } catch {
            return null;
        }

        const parsedNodes: ProseNode[] = [];
        parsedDoc.content.forEach((node) => {
            parsedNodes.push(node);
        });

        return isMarkdownStructuralResult(parsedNodes) ? parsedNodes : null;
    };

    return new Plugin({
        key: clipboardPluginKey,
        props: {
            handleKeyDown(view, event) {
                const key = event.key.toLowerCase();
                const hasPrimaryModifier = (event.metaKey || event.ctrlKey) && !event.altKey;

                if (!hasPrimaryModifier || event.shiftKey || key !== 'c') return false;

                const text = serializeSelectionToClipboardText(
                    view.state,
                    getMarkdownSerializer(),
                );
                if (text.length === 0) return false;

                event.preventDefault();
                void writeTextToClipboard(text).then(() => {
                    collapseSelectionAndHideFloatingToolbar(view);
                });
                return true;
            },
            handleDOMEvents: {
                copy(view, event) {
                    const text = serializeSelectionToClipboardText(
                        view.state,
                        getMarkdownSerializer(),
                    );
                    if (text.length === 0) return false;

                    event.preventDefault();
                    event.clipboardData?.setData('text/plain', text);
                    collapseSelectionAndHideFloatingToolbar(view);

                    return true;
                }
            },
            handlePaste(view, event) {
                const text = event.clipboardData?.getData('text/plain');
                if (!text) return false;

                const fencedPayload = parseStandaloneFencedCodeBlock(text);
                const state = view.state;
                if (state.selection.$from.parent.type.spec.code || state.selection.$to.parent.type.spec.code) {
                    return false;
                }

                const tocNode = createStandaloneTocPasteNode(state.schema, text);
                if (tocNode) {
                    dispatchSliceAndKeepCursorAtTail(view, new Slice(Fragment.from(tocNode), 0, 0));
                    event.preventDefault();
                    return true;
                }

                if (fencedPayload) {
                    const fencedLanguage = fencedPayload.language?.toLowerCase() ?? null;
                    const fencedMarkdownCandidate = (
                        fencedLanguage === 'markdown'
                        || fencedLanguage === 'md'
                        || fencedLanguage === 'mdx'
                    ) ? fencedPayload.code : null;

                    if (fencedMarkdownCandidate) {
                        const markdownNodes = parseMarkdownNodes(fencedMarkdownCandidate);
                        if (markdownNodes) {
                            dispatchSliceAndKeepCursorAtTail(
                                view,
                                new Slice(Fragment.from(markdownNodes), 0, 0),
                            );
                            event.preventDefault();
                            return true;
                        }
                    }

                    const codeBlockType = state.schema.nodes.code_block;
                    if (!codeBlockType) return false;

                    const attrs = createCodeBlockAttrs({
                        language: codeBlockType.spec.attrs?.language ? fencedPayload.language : null,
                    });

                    const codeTextNode = fencedPayload.code ? state.schema.text(fencedPayload.code) : null;
                    const codeBlockNode = codeBlockType.create(attrs, codeTextNode ? [codeTextNode] : null);

                    const slice = new Slice(Fragment.from(codeBlockNode), 0, 0);
                    dispatchSliceAndKeepCursorAtTail(view, slice);
                    event.preventDefault();
                    return true;
                }

                const headingPayload = parseStandaloneAtxHeading(text);
                if (headingPayload) {
                    const headingType = state.schema.nodes.heading;
                    if (!headingType) return false;

                    const headingNode = headingType.create(
                        { level: headingPayload.level },
                        state.schema.text(headingPayload.text),
                    );
                    dispatchSliceAndKeepCursorAtTail(
                        view,
                        new Slice(Fragment.from(headingNode), 0, 0),
                    );
                    event.preventDefault();
                    return true;
                }

                // Try broader markdown parsing for mixed content.
                const markdownFenceCandidate = extractLargestMarkdownFenceContent(text);
                const markdownNodes = parseMarkdownNodes(text) ?? (
                    markdownFenceCandidate ? parseMarkdownNodes(markdownFenceCandidate) : null
                );
                if (!markdownNodes) return false;

                dispatchSliceAndKeepCursorAtTail(view, new Slice(Fragment.from(markdownNodes), 0, 0));
                event.preventDefault();
                return true;
            },
            // Intercept paste and sanitize HTML using our strict policy
            transformPastedHTML(html) {
                return sanitizeHtml(html);
            }
        }
    });
});
