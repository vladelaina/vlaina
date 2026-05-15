import { $prose } from '@milkdown/kit/utils';
import { parserCtx, serializerCtx } from '@milkdown/kit/core';
import { Plugin, PluginKey, Selection, TextSelection } from '@milkdown/kit/prose/state';
import { Fragment, Slice, type Node as ProseNode } from '@milkdown/kit/prose/model';
import type { Mark } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { Parser, Serializer } from '@milkdown/kit/transformer';
import { preserveMarkdownBlankLinesForEditor } from '@/lib/notes/markdown/markdownSerializationUtils';
import { collapseSelectionAndHideFloatingToolbar } from './copyCleanup';
import { sanitizeHtml } from './sanitizer';
import { serializeSelectionToClipboardText } from './selectionSerialization';
import { normalizeCodeBlockLanguage } from '../code/codeBlockLanguage';
import { createCodeBlockAttrs } from '../code/codeBlockSettings';
import { normalizeLeadingFrontmatterMarkdown } from '../frontmatter/frontmatterMarkdown';
import { normalizeMermaidFenceCode } from '../mermaid/mermaidFenceCode';
import { isMermaidFenceLanguage } from '../mermaid/mermaidLanguage';
import { isTocShortcutText } from '../toc/tocShortcut';
import {
    extractLargestMarkdownFenceContent,
    looksLikePlainTextWithOnlyBackslashHardBreakSignal,
    looksLikeMarkdownForPaste,
    normalizeInterruptedOrderedListsForPaste,
    normalizeStandaloneThematicBreaksForPaste,
    parseStandaloneAtxHeading,
    parseStandaloneFencedCodeBlock,
} from './fencedCodePaste';
import { findTailCursorPosInRange, isMarkdownStructuralResult, resolvePasteRange } from './pasteCursorUtils';
import { createMarkdownPasteSlice, hasOnlyParagraphNodes } from './markdownPasteSlice';
import { createMarkdownTableFromTabSeparatedText } from './tabSeparatedTablePaste';

export const clipboardPluginKey = new PluginKey('vlaina-clipboard');
const MAX_MARKDOWN_PASTE_CHARS = 1024 * 1024;
const MAX_HTML_PASTE_CHARS = 2 * 1024 * 1024;
const INLINE_FOOTNOTE_REFERENCE_PATTERN = /\[\^([^\]\r\n]+)\]/g;

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

type FootnoteReferenceState = {
    schema: {
        text: (text: string, marks?: readonly Mark[]) => ProseNode;
        nodes: {
            footnote_reference?: { create: (attrs: { label: string }) => ProseNode };
            footnote_ref?: { create: (attrs: { id: string }) => ProseNode };
        };
    };
};

function createFootnoteReferenceNode(state: FootnoteReferenceState, id: string): ProseNode | null {
    const footnoteReferenceType = state.schema.nodes.footnote_reference;
    if (footnoteReferenceType) {
        return footnoteReferenceType.create({ label: id });
    }

    const legacyFootnoteRefType = state.schema.nodes.footnote_ref;
    if (legacyFootnoteRefType) {
        return legacyFootnoteRefType.create({ id });
    }

    return null;
}

function splitTextNodeWithInlineFootnotes(state: FootnoteReferenceState, node: ProseNode): ProseNode[] | null {
    const text = node.text ?? '';
    if (!text || !text.includes('[^') || node.marks.some((mark) => mark.type.name === 'inlineCode')) {
        return null;
    }

    const nodes: ProseNode[] = [];
    let lastIndex = 0;
    let hasFootnote = false;

    for (const match of text.matchAll(INLINE_FOOTNOTE_REFERENCE_PATTERN)) {
        const rawId = match[1]?.trim();
        if (!rawId) continue;

        const index = match.index ?? 0;
        if (index > lastIndex) {
            nodes.push(state.schema.text(text.slice(lastIndex, index), node.marks));
        }

        const footnoteNode = createFootnoteReferenceNode(state, rawId);
        if (!footnoteNode) return null;
        nodes.push(footnoteNode);
        lastIndex = index + match[0].length;
        hasFootnote = true;
    }

    if (!hasFootnote) return null;

    if (lastIndex < text.length) {
        nodes.push(state.schema.text(text.slice(lastIndex), node.marks));
    }

    return nodes;
}

function replaceInlineFootnoteReferencesInNode(state: FootnoteReferenceState, node: ProseNode): ProseNode[] {
    if (node.isText) {
        return splitTextNodeWithInlineFootnotes(state, node) ?? [node];
    }

    if (node.type.spec.code || node.isLeaf || node.content.childCount === 0) {
        return [node];
    }

    let changed = false;
    const children: ProseNode[] = [];
    node.content.forEach((child) => {
        const replacement = replaceInlineFootnoteReferencesInNode(state, child);
        children.push(...replacement);
        if (replacement.length !== 1 || replacement[0] !== child) {
            changed = true;
        }
    });

    return changed ? [node.copy(Fragment.fromArray(children))] : [node];
}

function replaceInlineFootnoteReferencesInNodes(state: FootnoteReferenceState, nodes: ProseNode[]): ProseNode[] {
    return nodes.flatMap((node) => replaceInlineFootnoteReferencesInNode(state, node));
}

function createInlineFootnoteReferenceSlice(state: FootnoteReferenceState, text: string): Slice | null {
    if (!text || /[\r\n]/.test(text)) return null;

    const textNode = state.schema.text(text);
    const nodes = splitTextNodeWithInlineFootnotes(state, textNode);
    if (!nodes) return null;

    return new Slice(Fragment.fromArray(nodes), 0, 0);
}

function createPlainTextLineBreakSlice(state: {
    schema: {
        text: (text: string) => ProseNode;
        nodes: {
            hardbreak?: { create: () => ProseNode };
            paragraph?: { create: (attrs?: unknown, content?: Fragment | ProseNode[] | null) => ProseNode };
        };
    };
}, text: string): Slice | null {
    const paragraphType = state.schema.nodes.paragraph;
    if (!paragraphType) return null;

    const hardbreakType = state.schema.nodes.hardbreak;
    const normalized = text.replace(/\r\n?/g, '\n');

    if (!hardbreakType) {
        const paragraphs = normalized.split('\n').map((line) => {
            const content = line ? [state.schema.text(line)] : null;
            return paragraphType.create(undefined, content);
        });
        return new Slice(Fragment.fromArray(paragraphs), 0, 0);
    }

    const inlineNodes: ProseNode[] = [];
    const lines = normalized.split('\n');
    lines.forEach((line, index) => {
        if (line) {
            inlineNodes.push(state.schema.text(line));
        }
        if (index < lines.length - 1) {
            inlineNodes.push(hardbreakType.create());
        }
    });

    return new Slice(Fragment.from(paragraphType.create(undefined, Fragment.fromArray(inlineNodes))), 0, 0);
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

    const dispatchSliceAndKeepCursorAtTail = (
        view: EditorView,
        slice: Slice,
        options?: {
            preferRangeEnd?: boolean;
        },
    ) => {
        const { state } = view;
        const { from, to } = resolvePasteRange(state, slice);
        const tr = state.tr.replaceRange(from, to, slice);
        tr.setMeta(clipboardPluginKey, true);
        const mappedFrom = tr.mapping.map(from, -1);
        const mappedTo = Math.min(mappedFrom + slice.content.size, tr.doc.content.size);
        const tailPos = options?.preferRangeEnd
            ? mappedTo
            : findTailCursorPosInRange(tr.doc, mappedFrom, mappedTo) ?? mappedTo;
        const safePos = Math.max(0, Math.min(tailPos, tr.doc.content.size));

        tr.setSelection(
            options?.preferRangeEnd
                ? TextSelection.create(tr.doc, safePos)
                : tailPos == null
                ? Selection.near(tr.doc.resolve(safePos), -1)
                : Selection.near(tr.doc.resolve(safePos), 1)
        );
        view.dispatch(tr.scrollIntoView());

        return safePos;
    };

    const parseMarkdownNodes = (text: string): ProseNode[] | null => {
        if (!looksLikeMarkdownForPaste(text)) return null;

        const parser = getMarkdownParser();
        if (!parser) return null;

        let parsedDoc: ProseNode;
        const withFrontmatter = normalizeLeadingFrontmatterMarkdown(text);
        const withInterruptedLists = normalizeInterruptedOrderedListsForPaste(withFrontmatter);
        const withThematicBreaks = normalizeStandaloneThematicBreaksForPaste(withInterruptedLists);
        const editorInput = preserveMarkdownBlankLinesForEditor(withThematicBreaks);
        try {
            parsedDoc = parser(editorInput);
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
                if (text.length > MAX_MARKDOWN_PASTE_CHARS) {
                    event.preventDefault();
                    return true;
                }

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

                const tabSeparatedTableMarkdown = createMarkdownTableFromTabSeparatedText(text);
                if (tabSeparatedTableMarkdown) {
                    const tableNodes = parseMarkdownNodes(tabSeparatedTableMarkdown);
                    if (tableNodes) {
                        const tableSlice = createMarkdownPasteSlice(state, tableNodes);
                        dispatchSliceAndKeepCursorAtTail(view, tableSlice);
                        event.preventDefault();
                        return true;
                    }
                }

                if (fencedPayload) {
                    const fencedLanguage = fencedPayload.language?.toLowerCase() ?? null;
                    if (isMermaidFenceLanguage(fencedLanguage)) {
                        const mermaidType = state.schema.nodes.mermaid;
                        if (mermaidType) {
                            const mermaidNode = mermaidType.create({
                                code: normalizeMermaidFenceCode(fencedLanguage, fencedPayload.code),
                            });
                            dispatchSliceAndKeepCursorAtTail(
                                view,
                                new Slice(Fragment.from(mermaidNode), 0, 0),
                            );
                            event.preventDefault();
                            return true;
                        }
                    }

                    const fencedMarkdownCandidate = (
                        fencedLanguage === 'markdown'
                        || fencedLanguage === 'md'
                        || fencedLanguage === 'mdx'
                    ) ? fencedPayload.code : null;

                    if (fencedMarkdownCandidate) {
                        const markdownNodes = parseMarkdownNodes(fencedMarkdownCandidate);
                        if (markdownNodes) {
                            const markdownSlice = createMarkdownPasteSlice(state, markdownNodes);
                            dispatchSliceAndKeepCursorAtTail(
                                view,
                                markdownSlice,
                                { preferRangeEnd: hasOnlyParagraphNodes(markdownNodes) },
                            );
                            event.preventDefault();
                            return true;
                        }
                    }

                    const codeBlockType = state.schema.nodes.code_block;
                    if (!codeBlockType) return false;

                    const attrs = createCodeBlockAttrs({
                        language: codeBlockType.spec.attrs?.language
                            ? normalizeCodeBlockLanguage(fencedPayload.language)
                            : null,
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
                if (looksLikePlainTextWithOnlyBackslashHardBreakSignal(text)) {
                    const plainTextSlice = createPlainTextLineBreakSlice(state, text);
                    if (plainTextSlice) {
                        dispatchSliceAndKeepCursorAtTail(
                            view,
                            plainTextSlice,
                        );
                        event.preventDefault();
                        return true;
                    }
                }

                const markdownFenceCandidate = extractLargestMarkdownFenceContent(text);
                const markdownNodes = parseMarkdownNodes(text) ?? (
                    markdownFenceCandidate ? parseMarkdownNodes(markdownFenceCandidate) : null
                );
                if (!markdownNodes) {
                    const inlineFootnoteSlice = createInlineFootnoteReferenceSlice(state, text);
                    if (!inlineFootnoteSlice) return false;

                    dispatchSliceAndKeepCursorAtTail(
                        view,
                        inlineFootnoteSlice,
                        { preferRangeEnd: true },
                    );
                    event.preventDefault();
                    return true;
                }

                const normalizedMarkdownNodes = replaceInlineFootnoteReferencesInNodes(state, markdownNodes);
                const markdownSlice = createMarkdownPasteSlice(state, normalizedMarkdownNodes);
                dispatchSliceAndKeepCursorAtTail(
                    view,
                    markdownSlice,
                    { preferRangeEnd: hasOnlyParagraphNodes(normalizedMarkdownNodes) },
                );
                event.preventDefault();
                return true;
            },
            // Intercept paste and sanitize HTML using our strict policy
            transformPastedHTML(html) {
                if (html.length > MAX_HTML_PASTE_CHARS) {
                    return '';
                }
                return sanitizeHtml(html);
            }
        }
    });
});
