import { $prose } from '@milkdown/kit/utils';
import { parserCtx, serializerCtx } from '@milkdown/kit/core';
import { Plugin, PluginKey, Selection } from '@milkdown/kit/prose/state';
import { Fragment, Slice, type Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { Parser, Serializer } from '@milkdown/kit/transformer';
import { sanitizeHtml } from './sanitizer';
import { serializeSliceToText } from './serializer';
import { normalizeSerializedMarkdownSelection } from './markdownSerializationUtils';
import {
    extractLargestMarkdownFenceContent,
    looksLikeMarkdownForPaste,
    parseStandaloneAtxHeading,
    parseStandaloneFencedCodeBlock,
} from './fencedCodePaste';
import { findTailCursorPosInRange, isMarkdownStructuralResult } from './pasteCursorUtils';

export const clipboardPluginKey = new PluginKey('neko-clipboard');

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
            parsedDoc = parser(text);
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
            handleDOMEvents: {
                copy(view, event) {
                    const { from, to } = view.state.selection;
                    if (from === to) return false; // No selection

                    let text = '';
                    const serializer = getMarkdownSerializer();
                    if (serializer) {
                        try {
                            text = normalizeSerializedMarkdownSelection(
                                serializer(view.state.doc.cut(from, to)),
                            );
                        } catch {
                            text = '';
                        }
                    }

                    if (text.length === 0) {
                        const slice = view.state.doc.slice(from, to);
                        text = normalizeSerializedMarkdownSelection(serializeSliceToText(slice));
                    }

                    // Manually set clipboard content
                    event.preventDefault();
                    event.clipboardData?.setData('text/plain', text);

                    return true; // Prevent default behavior
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

                    const attrs: Record<string, unknown> = {};
                    if (codeBlockType.spec.attrs?.language) {
                        attrs.language = fencedPayload.language;
                    }

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
