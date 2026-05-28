import { $prose } from '@milkdown/kit/utils';
import { parserCtx, serializerCtx } from '@milkdown/kit/core';
import { AllSelection, NodeSelection, Plugin, PluginKey, Selection, TextSelection } from '@milkdown/kit/prose/state';
import { CellSelection } from '@milkdown/kit/prose/tables';
import { Fragment, Slice, type Node as ProseNode } from '@milkdown/kit/prose/model';
import type { Mark } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { Parser, Serializer } from '@milkdown/kit/transformer';
import {
    normalizeAlternativeMathBlockFences,
    normalizeLenientMarkdownLineMarkers,
    preserveMarkdownBlankLinesForEditor,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import { normalizeCanonicalMarkdownSpacingForPaste } from '@/lib/notes/markdown/markdownCanonicalSpacing';
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
import { writeTextToClipboard } from '@/lib/clipboard';
import {
    hasSelectedBlocks,
} from '../cursor/blockSelectionPluginState';
import { replaceVisibleBlockSelectionWithCursor } from '../cursor/blockSelectionReplacement';

export const clipboardPluginKey = new PluginKey('vlaina-clipboard');
const MAX_MARKDOWN_PASTE_CHARS = 1024 * 1024;
const MAX_HTML_PASTE_CHARS = 2 * 1024 * 1024;
const INLINE_FOOTNOTE_REFERENCE_PATTERN = /\[\^([^\]\r\n]+)\]/g;
const BLANK_LINE_PATTERN = /\n[ \t]*\n/;

function isClipboardCopyShortcut(event: KeyboardEvent): boolean {
    if (event.altKey) return false;

    const key = event.key.toLowerCase();
    return (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        (key === 'c' || key === 'insert')
    );
}

function isClipboardCutShortcut(event: KeyboardEvent): boolean {
    if (event.altKey) return false;

    const key = event.key.toLowerCase();
    return (
        ((event.metaKey || event.ctrlKey) && !event.shiftKey && key === 'x') ||
        (!(event.metaKey || event.ctrlKey) && event.shiftKey && key === 'delete')
    );
}

function isNonEmptyTextSelection(selection: Selection): boolean {
    return (
        (selection instanceof TextSelection || selection.constructor?.name === 'TextSelection') &&
        !selection.empty
    );
}

function shouldHandleCopyShortcutDirectly(selection: Selection): boolean {
    return (
        isNonEmptyTextSelection(selection) ||
        selection instanceof AllSelection ||
        selection instanceof CellSelection ||
        selection instanceof NodeSelection ||
        selection.constructor?.name === 'AllSelection' ||
        selection.constructor?.name === 'CellSelection' ||
        selection.constructor?.name === 'NodeSelection'
    );
}

function shouldHandleCutShortcutDirectly(selection: Selection): boolean {
    return shouldHandleCopyShortcutDirectly(selection);
}

function deleteCapturedSelection(view: EditorView, selection: Selection, doc: ProseNode): void {
    if (!view.state.doc.eq(doc)) {
        return;
    }

    view.dispatch(
        view.state.tr
            .setSelection(selection)
            .deleteSelection()
            .scrollIntoView(),
    );
    view.focus();
}

function collapseCapturedSelectionAndHideFloatingToolbar(view: EditorView, selection: Selection, doc: ProseNode): void {
    if (!view.state.doc.eq(doc) || !selection.eq(view.state.selection)) {
        return;
    }

    collapseSelectionAndHideFloatingToolbar(view);
}

function replaceBlockSelectionBeforePaste(view: EditorView): boolean {
    const tr = replaceVisibleBlockSelectionWithCursor(view);
    if (!tr.docChanged) {
        return false;
    }

    tr.setMeta(clipboardPluginKey, true);
    view.dispatch(tr);
    return true;
}

function hasClipboardPayload(event: ClipboardEvent): boolean {
    const clipboardData = event.clipboardData;
    if (!clipboardData) return false;
    if (clipboardData.getData('text/plain') || clipboardData.getData('text/html')) return true;
    return Array.from(clipboardData.types ?? []).length > 0;
}

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

function parseStandaloneMathBlockPaste(state: {
    schema: {
        nodes: {
            math_block?: { create: (attrs: { latex: string }) => ProseNode };
        };
    };
}, text: string): ProseNode | null {
    const mathBlockType = state.schema.nodes.math_block;
    if (!mathBlockType) return null;

    const normalized = normalizeAlternativeMathBlockFences(text).trim();
    const lines = normalized.split('\n');
    if (lines.length < 3 || lines[0]?.trim() !== '$$' || lines[lines.length - 1]?.trim() !== '$$') {
        return null;
    }

    const latex = lines.slice(1, -1).join('\n').trim();
    if (!latex) return null;

    return mathBlockType.create({ latex });
}

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

function joinWrappedPlainTextLines(lines: string[]): string {
    return lines
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .reduce((result, line) => {
            if (!result) return line;

            const previous = result[result.length - 1] ?? '';
            const next = line[0] ?? '';
            const shouldJoinWithoutSpace = /[\p{Script=Han}，。！？；：“”（）《》、]/u.test(previous)
                || /[\p{Script=Han}，。！？；：“”（）《》、]/u.test(next);

            return `${result}${shouldJoinWithoutSpace ? '' : ' '}${line}`;
        }, '');
}

const BULLET_PREFIXED_ORDERED_MARKER_PATTERN = /^(?:\s*)[•‣◦]\s*(\d{1,3})[.)][ \t]+(.+)$/u;
const ORDERED_OUTLINE_MARKER_PATTERN = /^(\s{0,3})(?:[•‣◦]\s*)?(\d{1,3})[.)][ \t]+(.+)$/u;
const INLINE_EMBEDDED_HTML_EXAMPLE_PATTERN =
    /<(video|audio|iframe)\b[^>\n]*>[^<\n]*<\/\1>|<(img|source|track|video|audio|iframe)\b[^>\n]*\/?>/gi;
const FENCED_CODE_LINE_PATTERN = /^(?: {0,3}>[ \t]*)* {0,3}(`{3,}|~{3,})/;

function getInlineCodeSpanRanges(line: string): Array<[number, number]> {
    const ranges: Array<[number, number]> = [];
    let index = 0;

    while (index < line.length) {
        const start = line.indexOf('`', index);
        if (start < 0) break;

        let markerSize = 1;
        while (line[start + markerSize] === '`') {
            markerSize += 1;
        }

        const marker = '`'.repeat(markerSize);
        const end = line.indexOf(marker, start + markerSize);
        if (end < 0) break;

        ranges.push([start, end + markerSize]);
        index = end + markerSize;
    }

    return ranges;
}

function isOffsetInRanges(offset: number, ranges: ReadonlyArray<[number, number]>): boolean {
    return ranges.some(([start, end]) => offset >= start && offset < end);
}

function stripMarkdownContainerPrefix(value: string): string {
    let normalized = value.replace(/^(?: {0,3}>[ \t]*)*/, '');
    normalized = normalized.replace(/^ {0,3}(?:[-+*]|\d+[.)])[ \t]+(?:\[(?: |x|X)\][ \t]+)?/, '');
    return normalized;
}

function startsWithRawHtmlAfterMarkdownContainerPrefix(value: string): boolean {
    return stripMarkdownContainerPrefix(value).trimStart().startsWith('<');
}

function isAtRawHtmlLineStart(line: string, offset: number): boolean {
    return stripMarkdownContainerPrefix(line.slice(0, offset)).trim().length === 0
        && stripMarkdownContainerPrefix(line).trimStart().startsWith('<');
}

function escapeInlineEmbeddedHtmlExamples(text: string): string {
    let activeFence: { marker: string; size: number } | null = null;

    return text.replace(/^.*$/gm, (line) => {
        const fenceMatch = FENCED_CODE_LINE_PATTERN.exec(line);
        if (activeFence) {
            if (
                fenceMatch
                && (fenceMatch[1]?.[0] ?? '') === activeFence.marker
                && (fenceMatch[1]?.length ?? 0) >= activeFence.size
            ) {
                activeFence = null;
            }
            return line;
        }

        if (fenceMatch) {
            activeFence = {
                marker: fenceMatch[1]?.[0] ?? '`',
                size: fenceMatch[1]?.length ?? 3,
            };
            return line;
        }

        INLINE_EMBEDDED_HTML_EXAMPLE_PATTERN.lastIndex = 0;
        if (!INLINE_EMBEDDED_HTML_EXAMPLE_PATTERN.test(line)) {
            return line;
        }

        INLINE_EMBEDDED_HTML_EXAMPLE_PATTERN.lastIndex = 0;
        const codeSpanRanges = getInlineCodeSpanRanges(line);
        return line.replace(INLINE_EMBEDDED_HTML_EXAMPLE_PATTERN, (match, _tagName, _voidTagName, offset: number) => {
            if (isOffsetInRanges(offset, codeSpanRanges)) {
                return match;
            }

            const before = line.slice(0, offset);
            const after = line.slice(offset + match.length);
            if (startsWithRawHtmlAfterMarkdownContainerPrefix(before)) {
                return match;
            }

            if (isAtRawHtmlLineStart(line, offset) && after.trimStart().startsWith('<')) {
                return match;
            }

            const isStandaloneHtmlLine = before.trim().length === 0 && after.trim().length === 0;
            if (isStandaloneHtmlLine) {
                return match;
            }

            return match.replace(/[<>/]/g, '\\$&');
        });
    });
}

function normalizeBulletPrefixedOrderedOutlinePaste(text: string): string {
    const normalized = text.replace(/\r\n?/g, '\n');
    const lines = normalized.split('\n');

    if (!lines.some((line) => BULLET_PREFIXED_ORDERED_MARKER_PATTERN.test(line))) {
        return text;
    }

    type OutlineItem = {
        number: string;
        title: string;
        bodyLines: string[];
    };

    const items: OutlineItem[] = [];
    let current: OutlineItem | null = null;
    let sawBulletPrefixedMarker = false;

    for (const line of lines) {
        const markerMatch = ORDERED_OUTLINE_MARKER_PATTERN.exec(line);
        if (markerMatch) {
            if (BULLET_PREFIXED_ORDERED_MARKER_PATTERN.test(line)) {
                sawBulletPrefixedMarker = true;
            }
            current = {
                number: markerMatch[2] ?? '1',
                title: (markerMatch[3] ?? '').trim(),
                bodyLines: [],
            };
            items.push(current);
            continue;
        }

        if (!current) {
            if (line.trim().length > 0) return text;
            continue;
        }

        if (line.trim().length > 0 && !/^[ \t]{2,}\S/.test(line)) {
            return text;
        }

        current.bodyLines.push(line);
    }

    if (!sawBulletPrefixedMarker || items.length < 2) return text;

    return items
        .map((item) => {
            const body = joinWrappedPlainTextLines(item.bodyLines);
            if (!body) return `${item.number}. ${item.title}`;
            return `${item.number}. ${item.title}\n\n   ${body}`;
        })
        .join('\n\n');
}

function createPlainParagraphNodesFromText(state: {
    schema: {
        text: (text: string) => ProseNode;
        nodes: {
            paragraph?: { create: (attrs?: unknown, content?: Fragment | ProseNode[] | null) => ProseNode };
        };
    };
}, text: string): ProseNode[] | null {
    const paragraphType = state.schema.nodes.paragraph;
    if (!paragraphType) return null;

    const normalized = text.replace(/\r\n?/g, '\n').trim();
    if (!BLANK_LINE_PATTERN.test(normalized)) return null;

    const paragraphs = normalized
        .split(/\n[ \t]*\n+/)
        .map((block) => joinWrappedPlainTextLines(block.split('\n')))
        .filter((block) => block.length > 0);

    if (paragraphs.length < 2) return null;

    return paragraphs.map((paragraph) => paragraphType.create(
        undefined,
        [state.schema.text(paragraph)],
    ));
}

function findAncestorDepth(state: {
    selection: {
        $from: {
            depth: number;
            node: (depth: number) => ProseNode;
        };
    };
}, predicate: (node: ProseNode) => boolean): number | null {
    const { $from } = state.selection;
    for (let depth = $from.depth; depth >= 0; depth -= 1) {
        if (predicate($from.node(depth))) return depth;
    }
    return null;
}

function dispatchParagraphPasteFromEmptyTaskItem(
    view: EditorView,
    paragraphNodes: ProseNode[],
): boolean {
    if (paragraphNodes.length < 2) return false;

    const { state } = view;
    const { selection } = state;
    if (!selection.empty || selection.$from.parent.type.name !== 'paragraph' || selection.$from.parent.content.size !== 0) {
        return false;
    }

    const itemDepth = findAncestorDepth(state, (node) => node.type.name === 'list_item');
    if (itemDepth === null || itemDepth < 1) return false;

    const listItem = selection.$from.node(itemDepth);
    if (listItem.attrs.checked == null || listItem.childCount !== 1) return false;

    const listDepth = itemDepth - 1;
    const listNode = selection.$from.node(listDepth);
    if (listNode.type.name !== 'bullet_list' && listNode.type.name !== 'ordered_list') return false;

    const itemIndex = selection.$from.index(listDepth);
    const leadingItems: ProseNode[] = [];
    const trailingItems: ProseNode[] = [];
    listNode.forEach((child, _offset, index) => {
        if (index < itemIndex) {
            leadingItems.push(child);
            return;
        }
        if (index === itemIndex) {
            leadingItems.push(listItem.copy(Fragment.from(paragraphNodes[0])));
            return;
        }
        trailingItems.push(child);
    });

    const leadingList = listNode.copy(Fragment.fromArray(leadingItems));
    const replacementNodes = [leadingList, ...paragraphNodes.slice(1)];
    if (trailingItems.length > 0) {
        const trailingAttrs = listNode.type.name === 'ordered_list'
            ? {
                ...listNode.attrs,
                order: (typeof listNode.attrs.order === 'number' ? listNode.attrs.order : 1) + itemIndex + 1,
            }
            : listNode.attrs;
        replacementNodes.push(listNode.type.create(
            trailingAttrs,
            trailingItems,
            listNode.marks,
        ));
    }

    const from = selection.$from.before(listDepth);
    const to = selection.$from.after(listDepth);
    const tr = state.tr.replaceWith(from, to, replacementNodes);
    tr.setMeta(clipboardPluginKey, true);

    const insertedEnd = Math.min(from + Fragment.fromArray(replacementNodes).size, tr.doc.content.size);
    const tailPos = findTailCursorPosInRange(tr.doc, from, insertedEnd) ?? insertedEnd;
    const safePos = Math.max(0, Math.min(tailPos, tr.doc.content.size));

    tr.setSelection(Selection.near(tr.doc.resolve(safePos), 1));
    view.dispatch(tr.scrollIntoView());
    return true;
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
        const withOrderedOutline = normalizeBulletPrefixedOrderedOutlinePaste(text);
        const withMathFences = normalizeAlternativeMathBlockFences(withOrderedOutline);
        const withEscapedInlineEmbeddedHtml = escapeInlineEmbeddedHtmlExamples(withMathFences);
        const withLenientLineMarkers = normalizeLenientMarkdownLineMarkers(withEscapedInlineEmbeddedHtml);
        if (
            !looksLikeMarkdownForPaste(withOrderedOutline)
            && !looksLikeMarkdownForPaste(withMathFences)
            && !looksLikeMarkdownForPaste(withLenientLineMarkers)
        ) {
            return null;
        }

        const parser = getMarkdownParser();
        if (!parser) return null;

        let parsedDoc: ProseNode;
        const withFrontmatter = normalizeLeadingFrontmatterMarkdown(withLenientLineMarkers);
        const withInterruptedLists = normalizeInterruptedOrderedListsForPaste(withFrontmatter);
        const withThematicBreaks = normalizeStandaloneThematicBreaksForPaste(withInterruptedLists);
        const shouldCompactLenientListGaps = withLenientLineMarkers !== withMathFences;
        const pasteMarkdown = shouldCompactLenientListGaps
            ? normalizeCanonicalMarkdownSpacingForPaste(withThematicBreaks)
            : withThematicBreaks;
        const editorInput = preserveMarkdownBlankLinesForEditor(pasteMarkdown);
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
            handleKeyDown(view, event) {
                if (hasSelectedBlocks(view.state)) {
                    return false;
                }

                const isDirectCopy =
                    isClipboardCopyShortcut(event) &&
                    shouldHandleCopyShortcutDirectly(view.state.selection);
                const isDirectCut =
                    isClipboardCutShortcut(event) &&
                    shouldHandleCutShortcutDirectly(view.state.selection);

                if (!isDirectCopy && !isDirectCut) {
                    return false;
                }

                const text = serializeSelectionToClipboardText(
                    view.state,
                    getMarkdownSerializer(),
                );
                if (text.length === 0) {
                    return false;
                }

                const selection = view.state.selection;
                const doc = view.state.doc;
                event.preventDefault();
                void writeTextToClipboard(text).then((didCopy) => {
                    if (didCopy) {
                        if (isDirectCut) {
                            deleteCapturedSelection(view, selection, doc);
                            return;
                        }

                        collapseCapturedSelectionAndHideFloatingToolbar(view, selection, doc);
                    }
                });
                return true;
            },
            handleDOMEvents: {
                copy(view, event) {
                    if (hasSelectedBlocks(view.state)) {
                        return false;
                    }

                    const text = serializeSelectionToClipboardText(
                        view.state,
                        getMarkdownSerializer(),
                    );
                    if (text.length === 0) return false;

                    const selection = view.state.selection;
                    const doc = view.state.doc;
                    event.preventDefault();
                    if (event.clipboardData) {
                        event.clipboardData.setData('text/plain', text);
                        collapseSelectionAndHideFloatingToolbar(view);
                        return true;
                    }

                    void writeTextToClipboard(text).then((didCopy) => {
                        if (didCopy) {
                            collapseCapturedSelectionAndHideFloatingToolbar(view, selection, doc);
                        }
                    });
                    return true;
                },
                cut(view, event) {
                    if (hasSelectedBlocks(view.state)) {
                        return false;
                    }

                    if (!shouldHandleCutShortcutDirectly(view.state.selection)) {
                        return false;
                    }

                    const text = serializeSelectionToClipboardText(
                        view.state,
                        getMarkdownSerializer(),
                    );
                    if (text.length === 0) return false;

                    const selection = view.state.selection;
                    const doc = view.state.doc;
                    event.preventDefault();
                    if (event.clipboardData) {
                        event.clipboardData.setData('text/plain', text);
                        deleteCapturedSelection(view, selection, doc);
                        return true;
                    }

                    void writeTextToClipboard(text).then((didCopy) => {
                        if (didCopy) {
                            deleteCapturedSelection(view, selection, doc);
                        }
                    });
                    return true;
                }
            },
            handlePaste(view, event) {
                const text = event.clipboardData?.getData('text/plain');
                if (!text) {
                    if (hasSelectedBlocks(view.state) && hasClipboardPayload(event)) {
                        replaceBlockSelectionBeforePaste(view);
                    }
                    return false;
                }
                if (text.length > MAX_MARKDOWN_PASTE_CHARS) {
                    event.preventDefault();
                    return true;
                }

                const fencedPayload = parseStandaloneFencedCodeBlock(text);
                replaceBlockSelectionBeforePaste(view);
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

                const mathBlockNode = parseStandaloneMathBlockPaste(state, text);
                if (mathBlockNode) {
                    dispatchSliceAndKeepCursorAtTail(
                        view,
                        new Slice(Fragment.from(mathBlockNode), 0, 0),
                    );
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

                const plainParagraphNodes = createPlainParagraphNodesFromText(state, text);
                if (plainParagraphNodes && dispatchParagraphPasteFromEmptyTaskItem(view, plainParagraphNodes)) {
                    event.preventDefault();
                    return true;
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
                if (hasOnlyParagraphNodes(normalizedMarkdownNodes)
                    && dispatchParagraphPasteFromEmptyTaskItem(view, normalizedMarkdownNodes)) {
                    event.preventDefault();
                    return true;
                }

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
