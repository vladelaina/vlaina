import { isTocShortcutText } from '../toc/tocShortcut';
export {
    looksLikePlainTextWithOnlyBackslashHardBreakSignal,
} from '@/lib/notes/markdown/plainTextBackslashHardBreaks';

const STANDALONE_OPENING_FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/;
const THEMATIC_BREAK_PATTERN = /^(\s*)([-*_])(?:\s*\2){2,}\s*$/;
const GENERIC_FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})(.*)$/;

const normalizeLineEnding = (value: string) => value.replace(/\r\n?/g, '\n');

function trimBlankEdgeLines(lines: string[]) {
    let start = 0;
    let end = lines.length;

    while (start < end && lines[start].trim().length === 0) {
        start += 1;
    }

    while (end > start && lines[end - 1].trim().length === 0) {
        end -= 1;
    }

    return lines.slice(start, end);
}

export interface FencedCodePayload {
    language: string | null;
    code: string;
}

export interface AtxHeadingPayload {
    level: number;
    text: string;
}

interface FenceState {
    marker: '`' | '~';
    size: number;
}

function getFenceState(line: string): FenceState | null {
    const match = line.match(GENERIC_FENCE_PATTERN);
    if (!match) return null;

    const fence = match[1];
    return {
        marker: fence[0] as '`' | '~',
        size: fence.length,
    };
}

function isFenceClose(line: string, fence: FenceState): boolean {
    const match = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
    if (!match) return false;

    const markerRun = match[1];
    return markerRun[0] === fence.marker && markerRun.length >= fence.size;
}

function isNonBlankContentLine(line: string | undefined): boolean {
    if (line === undefined || line.trim().length === 0) return false;
    return getFenceState(line) === null;
}

export const parseStandaloneFencedCodeBlock = (value: string): FencedCodePayload | null => {
    const normalized = normalizeLineEnding(value);
    const lines = trimBlankEdgeLines(normalized.split('\n'));
    if (lines.length < 2) return null;

    const openingFence = lines[0];
    const openingMatch = openingFence.match(STANDALONE_OPENING_FENCE_PATTERN);
    if (!openingMatch) {
        return null;
    }

    const openingMarker = openingMatch[1];
    const infoString = openingMatch[2].trim();
    if (openingMarker[0] === '`' && infoString.includes('`')) {
        return null;
    }

    const fence: FenceState = {
        marker: openingMarker[0] as '`' | '~',
        size: openingMarker.length,
    };
    const closingIndex = lines.findIndex((line, index) => index > 0 && isFenceClose(line, fence));
    if (closingIndex !== lines.length - 1) {
        return null;
    }

    const language = infoString.split(/\s+/)[0] || null;
    const code = lines.slice(1, -1).join('\n');

    return {
        language,
        code,
    };
};

export const isStandaloneFencedCodeBlock = (value: string): boolean => {
    return parseStandaloneFencedCodeBlock(value) !== null;
};

const ATX_HEADING_PATTERN = /^ {0,3}(#{1,6})(?:[ \t]+(.+?))?[ \t]*$/;
const ATX_CLOSING_SEQUENCE_PATTERN = /(?:^|[ \t]+)#{1,}[ \t]*$/;
const BLOCK_MARKDOWN_SIGNAL_PATTERN = /(^|\n)\s{0,3}(#{1,6}[ \t]+|[-+*][ \t]+|\d+[.)][ \t]+|>[ \t]+|```|~~~|\$\$[ \t]*$|\\\[|\[\\|\[[ \t]*$|\[[^\]\n]+\]:|[-*_]{3,}[ \t]*$|\|.+\|)/m;
const SETEXT_HEADING_SIGNAL_PATTERN = /(^|\n)[^\n]+\n {0,3}(?:=+|-+)[ \t]*(?:\n|$)/;
const HARD_BREAK_SIGNAL_PATTERN = /(\\| {2,})\n|<br\s*\/?>/i;
const INLINE_MARKDOWN_SIGNAL_PATTERN = /(\[\^[^\]]+\]|\[[^\]]+\]\([^)]+\)|`[^`\n]+`|\$[^$\n]+\$|==[^=\n]+==|\+\+[^+\n]+\+\+|<(?:mark|sup|sub|u)\b[\s\S]*?<\/(?:mark|sup|sub|u)>|<span\b[^>]*style=["'][^"']*(?:color|background-color)\s*:[^"']*["'][\s\S]*?<\/span>|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_)/i;
const MARKDOWN_FENCE_OPEN_PATTERN = /^```(?:markdown|md|mdx)\s*$/i;
const PLAIN_FENCE_CLOSE_PATTERN = /^```$/;
const ORDERED_LIST_MARKER_PATTERN = /^(\s{0,3})(\d+)[.)][ \t]+/;
const ANY_LIST_MARKER_PATTERN = /^\s*(?:[-+*]|\d+[.)])[ \t]+/;
const BLOCK_START_PATTERN = /^\s{0,3}(?:#{1,6}[ \t]+|[-+*][ \t]+|\d+[.)][ \t]+|>[ \t]+|```|~~~|\$\$[ \t]*$|\\\[|\[\\|\[[ \t]*$|\[\^[^\]]+\]:|[-*_]{3,}[ \t]*$|\|.+\|)/;

export const parseStandaloneAtxHeading = (value: string): AtxHeadingPayload | null => {
    const normalized = normalizeLineEnding(value).replace(/\n+$/g, '');
    if (!normalized || normalized.includes('\n')) return null;

    const match = normalized.match(ATX_HEADING_PATTERN);
    if (!match) return null;

    const level = match[1].length;
    const text = (match[2] ?? '').replace(ATX_CLOSING_SEQUENCE_PATTERN, '').trim();
    if (!text) return null;

    return {
        level,
        text,
    };
};

export const normalizeStandaloneThematicBreaksForPaste = (value: string): string => {
    const normalized = normalizeLineEnding(value);
    const lines = normalized.split('\n');

    if (lines.length < 2) return normalized;

    const result: string[] = [];
    let activeFence: FenceState | null = null;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (activeFence) {
            result.push(line);
            if (isFenceClose(line, activeFence)) {
                activeFence = null;
            }
            continue;
        }

        const openingFence = getFenceState(line);
        if (openingFence) {
            activeFence = openingFence;
            result.push(line);
            continue;
        }

        if (!THEMATIC_BREAK_PATTERN.test(line)) {
            result.push(line);
            continue;
        }

        const previousLine = lines[index - 1];
        const nextLine = lines[index + 1];
        const previousIsContent = isNonBlankContentLine(previousLine);
        const nextIsContent = isNonBlankContentLine(nextLine);
        const lastResultLine = result[result.length - 1];

        if (previousIsContent && lastResultLine !== '') {
            result.push('');
        }

        result.push(line);

        if (nextIsContent) {
            result.push('');
        }
    }

    return result.join('\n');
};

function isListLikeLine(line: string): boolean {
    return ANY_LIST_MARKER_PATTERN.test(line);
}

function isParagraphContinuationBeforeList(line: string | undefined): boolean {
    if (line === undefined || line.trim().length === 0) return false;
    if (getFenceState(line)) return false;
    if (ANY_LIST_MARKER_PATTERN.test(line)) return false;
    return !BLOCK_START_PATTERN.test(line);
}

function hasFollowingOrderedListRun(lines: string[], startIndex: number): boolean {
    const firstMatch = ORDERED_LIST_MARKER_PATTERN.exec(lines[startIndex]);
    if (!firstMatch) return false;

    const firstIndent = firstMatch[1] ?? '';
    const firstNumber = Number(firstMatch[2]);
    if (!Number.isFinite(firstNumber) || firstNumber <= 1) return false;

    for (let index = startIndex + 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (line.trim().length === 0) continue;
        if (getFenceState(line)) return false;

        const nextMatch = ORDERED_LIST_MARKER_PATTERN.exec(line);
        if (!nextMatch) {
            return isListLikeLine(line);
        }

        return (nextMatch[1] ?? '') === firstIndent;
    }

    return false;
}

export const normalizeInterruptedOrderedListsForPaste = (value: string): string => {
    const normalized = normalizeLineEnding(value);
    const lines = normalized.split('\n');
    if (lines.length < 2) return normalized;

    const result: string[] = [];
    let activeFence: FenceState | null = null;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];

        if (activeFence) {
            result.push(line);
            if (isFenceClose(line, activeFence)) {
                activeFence = null;
            }
            continue;
        }

        const openingFence = getFenceState(line);
        if (openingFence) {
            activeFence = openingFence;
            result.push(line);
            continue;
        }

        const previousLine = result[result.length - 1];
        if (
            previousLine !== ''
            && hasFollowingOrderedListRun(lines, index)
            && isParagraphContinuationBeforeList(previousLine)
        ) {
            result.push('');
        }

        result.push(line);
    }

    return result.join('\n');
};

export const looksLikeMarkdownForPaste = (value: string): boolean => {
    const normalized = normalizeLineEnding(value);
    if (!normalized.trim()) return false;

    return (
        isTocShortcutText(normalized)
        || BLOCK_MARKDOWN_SIGNAL_PATTERN.test(normalized)
        || SETEXT_HEADING_SIGNAL_PATTERN.test(normalized)
        || HARD_BREAK_SIGNAL_PATTERN.test(normalized)
        || INLINE_MARKDOWN_SIGNAL_PATTERN.test(normalized)
    );
};

export const extractLargestMarkdownFenceContent = (value: string): string | null => {
    const normalized = normalizeLineEnding(value);
    if (!normalized.trim()) return null;

    const lines = normalized.split('\n');
    let bestStart = -1;
    let bestEnd = -1;
    let bestSpan = -1;
    let activeStart = -1;

    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = lines[index].trim();
        if (activeStart < 0) {
            if (MARKDOWN_FENCE_OPEN_PATTERN.test(trimmed)) {
                activeStart = index;
            }
            continue;
        }

        if (PLAIN_FENCE_CLOSE_PATTERN.test(trimmed)) {
            const span = index - activeStart;
            if (span > bestSpan) {
                bestStart = activeStart;
                bestEnd = index;
                bestSpan = span;
            }
        }
    }

    if (bestStart < 0 || bestEnd <= bestStart + 1) return null;

    const content = lines.slice(bestStart + 1, bestEnd).join('\n').trim();
    return content || null;
};
