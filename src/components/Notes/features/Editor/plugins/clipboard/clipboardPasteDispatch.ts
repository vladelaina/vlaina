import { Fragment, Slice, type Node as ProseNode } from '@milkdown/kit/prose/model';
import { Selection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { Parser } from '@milkdown/kit/transformer';

import { normalizeCodeBlockLanguage } from '../code/codeBlockLanguage';
import { createCodeBlockAttrs } from '../code/codeBlockSettings';
import { normalizeMermaidFenceCode } from '../mermaid/mermaidFenceCode';
import { isMermaidFenceLanguage } from '../mermaid/mermaidLanguage';
import { isTocShortcutText } from '../toc/tocShortcut';
import { hasSelectedBlocks } from '../cursor/blockSelectionPluginState';
import { replaceVisibleBlockSelectionWithCursor } from '../cursor/blockSelectionReplacement';
import { markEditorUserInput } from '../shared/userInputEvents';
import {
    extractLargestMarkdownFenceContent,
    looksLikeMarkdownForPaste,
    looksLikePlainTextWithOnlyBackslashHardBreakSignal,
    parseStandaloneAtxHeading,
    parseStandaloneFencedCodeBlock,
} from './fencedCodePaste';
import { createMarkdownPasteSlice, hasOnlyParagraphNodes } from './markdownPasteSlice';
import { createMarkdownTableFromTabSeparatedText } from './tabSeparatedTablePaste';
import { findTailCursorPosInRange, resolvePasteRange } from './pasteCursorUtils';
import { createInlineFootnoteReferenceSlice, replaceInlineFootnoteReferencesInNodes } from './clipboardInlineFootnotes';
import { parseMarkdownNodes, parseStandaloneMathBlockPaste } from './clipboardMarkdownParsing';
import {
    createPlainParagraphNodesFromText,
    createPlainTextBlankLineSlice,
    createPlainTextLineBreakSlice,
    looksLikeMarkdownBeyondPlainTextHtmlBreaks,
    looksLikePlainHtmlLikeTextPaste,
    normalizePlainTextHtmlBreaksForPaste,
} from './clipboardPlainTextPaste';
import { dispatchParagraphPasteFromEmptyTaskItem } from './clipboardTaskItemPaste';
import { clipboardPluginKey } from './clipboardPluginConstants';

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

export function replaceBlockSelectionBeforePaste(view: EditorView): boolean {
    const tr = replaceVisibleBlockSelectionWithCursor(view);
    if (!tr.docChanged) {
        return false;
    }

    tr.setMeta(clipboardPluginKey, true);
    view.dispatch(tr);
    return true;
}

function dispatchSliceAndKeepCursorAtTail(
    view: EditorView,
    slice: Slice,
    options?: {
        preferRangeEnd?: boolean;
    },
): number {
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
    markEditorUserInput(view);

    return safePos;
}

function dispatchPlainTextHtmlBreaks(view: EditorView, plainTextWithHtmlBreaks: string): boolean {
    const { state } = view;
    const blankLineSlice = createPlainTextBlankLineSlice(state, plainTextWithHtmlBreaks);
    if (blankLineSlice) {
        dispatchSliceAndKeepCursorAtTail(view, blankLineSlice);
        return true;
    }

    const lineBreakSlice = createPlainTextLineBreakSlice(state, plainTextWithHtmlBreaks);
    if (lineBreakSlice) {
        dispatchSliceAndKeepCursorAtTail(view, lineBreakSlice);
        return true;
    }
    return false;
}

function dispatchStandaloneNode(view: EditorView, node: ProseNode): boolean {
    dispatchSliceAndKeepCursorAtTail(view, new Slice(Fragment.from(node), 0, 0));
    return true;
}

function dispatchFencedCodePayload(view: EditorView, text: string, parser: Parser | null): boolean {
    const fencedPayload = parseStandaloneFencedCodeBlock(text);
    if (!fencedPayload) return false;

    const { state } = view;
    const fencedLanguage = fencedPayload.language?.toLowerCase() ?? null;
    if (isMermaidFenceLanguage(fencedLanguage)) {
        const mermaidType = state.schema.nodes.mermaid;
        if (mermaidType) {
            const mermaidNode = mermaidType.create({
                code: normalizeMermaidFenceCode(fencedLanguage, fencedPayload.code),
            });
            return dispatchStandaloneNode(view, mermaidNode);
        }
    }

    const fencedMarkdownCandidate = (
        fencedLanguage === 'markdown'
        || fencedLanguage === 'md'
        || fencedLanguage === 'mdx'
    ) ? fencedPayload.code : null;

    if (fencedMarkdownCandidate) {
        const markdownNodes = parseMarkdownNodes(fencedMarkdownCandidate, parser);
        if (markdownNodes) {
            const markdownSlice = createMarkdownPasteSlice(state, markdownNodes);
            dispatchSliceAndKeepCursorAtTail(
                view,
                markdownSlice,
                { preferRangeEnd: hasOnlyParagraphNodes(markdownNodes) },
            );
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

    dispatchStandaloneNode(view, codeBlockNode);
    return true;
}

export function dispatchPlainTextPayload(view: EditorView, text: string, parser: Parser | null): boolean {
    replaceBlockSelectionBeforePaste(view);
    const state = view.state;
    if (state.selection.$from.parent.type.spec.code || state.selection.$to.parent.type.spec.code) {
        return false;
    }

    const tocNode = createStandaloneTocPasteNode(state.schema, text);
    if (tocNode) {
        return dispatchStandaloneNode(view, tocNode);
    }

    const mathBlockNode = parseStandaloneMathBlockPaste(state, text);
    if (mathBlockNode) {
        return dispatchStandaloneNode(view, mathBlockNode);
    }

    const tabSeparatedTableMarkdown = createMarkdownTableFromTabSeparatedText(text);
    if (tabSeparatedTableMarkdown) {
        const tableNodes = parseMarkdownNodes(tabSeparatedTableMarkdown, parser);
        if (tableNodes) {
            const tableSlice = createMarkdownPasteSlice(state, tableNodes);
            dispatchSliceAndKeepCursorAtTail(view, tableSlice);
            return true;
        }
    }

    if (dispatchFencedCodePayload(view, text, parser)) {
        return true;
    }

    const plainTextWithHtmlBreaks = normalizePlainTextHtmlBreaksForPaste(text);
    const shouldHandleHtmlBreaksBeforeMarkdown =
        plainTextWithHtmlBreaks !== text && !looksLikeMarkdownBeyondPlainTextHtmlBreaks(text);
    if (shouldHandleHtmlBreaksBeforeMarkdown && dispatchPlainTextHtmlBreaks(view, plainTextWithHtmlBreaks)) {
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
        return dispatchStandaloneNode(view, headingNode);
    }

    if (looksLikePlainHtmlLikeTextPaste(text) && !looksLikeMarkdownForPaste(text)) {
        const plainTextSlice = createPlainTextLineBreakSlice(state, text);
        if (plainTextSlice) {
            dispatchSliceAndKeepCursorAtTail(view, plainTextSlice);
            return true;
        }
    }

    if (looksLikePlainTextWithOnlyBackslashHardBreakSignal(text)) {
        const plainTextSlice = createPlainTextLineBreakSlice(state, text);
        if (plainTextSlice) {
            dispatchSliceAndKeepCursorAtTail(view, plainTextSlice);
            return true;
        }
    }

    const plainParagraphNodes = createPlainParagraphNodesFromText(state, text);
    if (plainParagraphNodes && dispatchParagraphPasteFromEmptyTaskItem(view, plainParagraphNodes)) {
        return true;
    }

    const markdownFenceCandidate = extractLargestMarkdownFenceContent(text);
    const markdownNodes = parseMarkdownNodes(text, parser) ?? (
        markdownFenceCandidate ? parseMarkdownNodes(markdownFenceCandidate, parser) : null
    );
    if (!markdownNodes) {
        if (!shouldHandleHtmlBreaksBeforeMarkdown
            && plainTextWithHtmlBreaks !== text
            && dispatchPlainTextHtmlBreaks(view, plainTextWithHtmlBreaks)) {
            return true;
        }

        const plainTextBlankLineSlice = createPlainTextBlankLineSlice(state, text);
        if (plainTextBlankLineSlice) {
            dispatchSliceAndKeepCursorAtTail(view, plainTextBlankLineSlice);
            return true;
        }

        const inlineFootnoteSlice = createInlineFootnoteReferenceSlice(state, text);
        if (!inlineFootnoteSlice) return false;

        dispatchSliceAndKeepCursorAtTail(
            view,
            inlineFootnoteSlice,
            { preferRangeEnd: true },
        );
        return true;
    }

    const normalizedMarkdownNodes = replaceInlineFootnoteReferencesInNodes(state, markdownNodes);
    if (hasOnlyParagraphNodes(normalizedMarkdownNodes)
        && dispatchParagraphPasteFromEmptyTaskItem(view, normalizedMarkdownNodes)) {
        return true;
    }

    const markdownSlice = createMarkdownPasteSlice(state, normalizedMarkdownNodes);
    dispatchSliceAndKeepCursorAtTail(
        view,
        markdownSlice,
        { preferRangeEnd: hasOnlyParagraphNodes(normalizedMarkdownNodes) },
    );
    return true;
}

export function moveSelectionToDropPoint(view: EditorView, event: DragEvent): boolean {
    const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (!pos) return false;

    const safePos = Math.max(0, Math.min(pos.pos, view.state.doc.content.size));
    const selection = Selection.near(view.state.doc.resolve(safePos), 1);
    view.dispatch(view.state.tr.setSelection(selection));
    return true;
}

export function shouldReplaceBlockSelectionForEmptyPaste(view: EditorView, event: ClipboardEvent): boolean {
    return hasSelectedBlocks(view.state) && (event.clipboardData?.types?.length ?? 0) > 0;
}
