import { Fragment, Slice, type Node as ProseNode } from '@milkdown/kit/prose/model';

import { looksLikeMarkdownForPaste } from './fencedCodePaste';
import {
    MARKDOWN_BLANK_LINE_COMMENT,
    MAX_PLAIN_TEXT_LINE_BREAK_PASTE_LINES,
    MAX_PLAIN_TEXT_PARAGRAPH_PASTE_BLOCKS,
} from './clipboardPluginConstants';

const BLANK_LINE_PATTERN = /\n[ \t]*\n/;
const PLAIN_EMPTY_PAIRED_HTML_TEXT_PATTERN =
    /<([A-Za-z][A-Za-z0-9-]*)\s*>\s*<\/\1\s*>/i;
const PLAIN_HTML_BLOCK_TAG_TEXT_PATTERN =
    /^(?: {0,3})(?:<\/(?:address|article|aside|basefont|blockquote|body|caption|center|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frameset|h[1-6]|head|header|html|legend|li|main|menu|menuitem|nav|ol|optgroup|option|p|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|ul)\s*>|<(?:address|article|aside|basefont|blockquote|body|caption|center|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frameset|h[1-6]|head|header|html|legend|li|main|menu|menuitem|nav|ol|optgroup|option|p|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|ul)(?:\s[^<>]*)?>[^<]*)$/i;
const PLAIN_TEXT_HTML_BREAK_TAG_PATTERN = /<br\b[^>]*\/?>[ \t]*(?:<\/br>)?/gi;
const STANDALONE_PLAIN_TEXT_HTML_BREAK_LINE_PATTERN = /^\s*<br\b[^>]*\/?>\s*(?:<\/br>)?\s*$/i;

export function looksLikeMarkdownBeyondPlainTextHtmlBreaks(text: string): boolean {
    if (!/<br\b/i.test(text)) {
        return looksLikeMarkdownForPaste(text);
    }

    const withoutPlainTextBreakTags = text
        .replace(/\r\n?/g, '\n')
        .replace(PLAIN_TEXT_HTML_BREAK_TAG_PATTERN, '\n');
    return looksLikeMarkdownForPaste(withoutPlainTextBreakTags);
}

export function looksLikePlainHtmlLikeTextPaste(text: string): boolean {
    if (!text.includes('<')) return false;
    if (looksLikeMarkdownBeyondPlainTextHtmlBreaks(text)) return false;

    return text
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .some((line) => {
            const trimmed = line.trim();
            if (!trimmed) return false;
            return PLAIN_EMPTY_PAIRED_HTML_TEXT_PATTERN.test(trimmed)
                || PLAIN_HTML_BLOCK_TAG_TEXT_PATTERN.test(line);
        });
}

export function normalizePlainTextHtmlBreaksForPaste(text: string): string {
    if (!/<br\b/i.test(text)) return text;

    const normalized = text.replace(/\r\n?/g, '\n');
    if (STANDALONE_PLAIN_TEXT_HTML_BREAK_LINE_PATTERN.test(normalized.trim())) {
        return '\n';
    }

    const breakMatches = Array.from(normalized.matchAll(PLAIN_TEXT_HTML_BREAK_TAG_PATTERN));
    if (breakMatches.length === 0) return text;

    const shouldTreatAsLineBreakMarkup = breakMatches.length >= 2 || breakMatches.some((match) => {
        const index = match.index ?? -1;
        if (index < 0) return false;
        const before = normalized[index - 1] ?? '';
        const after = normalized[index + match[0].length] ?? '';
        return before === '\n'
            || after === '\n'
            || (before.length > 0 && !/\s/.test(before))
            || (after.length > 0 && !/\s/.test(after));
    });

    return shouldTreatAsLineBreakMarkup
        ? normalized.replace(PLAIN_TEXT_HTML_BREAK_TAG_PATTERN, '\n')
        : text;
}

function countLineBreakDelimitedItems(value: string, limit: number): number {
    let count = 1;
    for (let index = 0; index < value.length; index += 1) {
        if (value.charCodeAt(index) === 10) {
            count += 1;
            if (count > limit) {
                return count;
            }
        }
    }
    return count;
}

function countBlankLineDelimitedBlocks(value: string, limit: number): number {
    let count = 1;
    for (let index = 0; index < value.length; index += 1) {
        if (value.charCodeAt(index) !== 10) {
            continue;
        }

        let cursor = index + 1;
        while (cursor < value.length && (value[cursor] === ' ' || value[cursor] === '\t')) {
            cursor += 1;
        }
        if (value.charCodeAt(cursor) !== 10) {
            continue;
        }

        count += 1;
        if (count > limit) {
            return count;
        }
        index = cursor;
    }
    return count;
}

export function createPlainTextLineBreakSlice(state: {
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
    if (countLineBreakDelimitedItems(normalized, MAX_PLAIN_TEXT_LINE_BREAK_PASTE_LINES) > MAX_PLAIN_TEXT_LINE_BREAK_PASTE_LINES) {
        return null;
    }

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

export function joinWrappedPlainTextLines(lines: string[]): string {
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

export function createPlainParagraphNodesFromText(state: {
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
    if (countBlankLineDelimitedBlocks(normalized, MAX_PLAIN_TEXT_PARAGRAPH_PASTE_BLOCKS) > MAX_PLAIN_TEXT_PARAGRAPH_PASTE_BLOCKS) {
        return null;
    }

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

export function createPlainTextBlankLineSlice(state: {
    schema: {
        text: (text: string) => ProseNode;
        nodes: {
            html_block?: { create: (attrs: { value: string }) => ProseNode };
            paragraph?: { create: (attrs?: unknown, content?: Fragment | ProseNode[] | null) => ProseNode };
        };
    };
}, text: string): Slice | null {
    const paragraphType = state.schema.nodes.paragraph;
    if (!paragraphType) return null;
    const htmlBlockType = state.schema.nodes.html_block;

    const normalized = text.replace(/\r\n?/g, '\n').trim();
    if (!BLANK_LINE_PATTERN.test(normalized)) return null;
    if (countBlankLineDelimitedBlocks(normalized, MAX_PLAIN_TEXT_PARAGRAPH_PASTE_BLOCKS) > MAX_PLAIN_TEXT_PARAGRAPH_PASTE_BLOCKS) {
        return null;
    }

    const nodes: ProseNode[] = [];
    let paragraphLines: string[] = [];
    let sawBlankLine = false;

    const flushParagraph = () => {
        if (paragraphLines.length === 0) return;
        const paragraph = joinWrappedPlainTextLines(paragraphLines);
        if (paragraph) {
            nodes.push(paragraphType.create(undefined, [state.schema.text(paragraph)]));
        }
        paragraphLines = [];
    };

    for (const line of normalized.split('\n')) {
        if (line.trim().length === 0) {
            flushParagraph();
            if (nodes.length > 0) {
                nodes.push(htmlBlockType
                    ? htmlBlockType.create({ value: MARKDOWN_BLANK_LINE_COMMENT })
                    : paragraphType.create());
                sawBlankLine = true;
            }
            continue;
        }

        paragraphLines.push(line);
    }

    flushParagraph();

    while (nodes.length > 0 && nodes[nodes.length - 1]?.textContent === '') {
        nodes.pop();
    }

    return sawBlankLine && nodes.length >= 2
        ? new Slice(Fragment.fromArray(nodes), 0, 0)
        : null;
}
