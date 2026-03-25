import { isTocShortcutText } from '../toc/tocShortcut';

const OPENING_FENCE_PATTERN = /^```[^`]*$/;
const CLOSING_FENCE_PATTERN = /^```+$/;
const THEMATIC_BREAK_PATTERN = /^(\s*)([-*_])(?:\s*\2){2,}\s*$/;
const GENERIC_FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})(.*)$/;

const normalizeLineEnding = (value: string) => value.replace(/\r\n?/g, '\n');

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
    const normalized = normalizeLineEnding(value).trim();
    if (!normalized) return null;

    const lines = normalized.split('\n');
    if (lines.length < 2) return null;

    const openingFence = lines[0].trim();
    const closingFence = lines[lines.length - 1].trim();
    if (!OPENING_FENCE_PATTERN.test(openingFence) || !CLOSING_FENCE_PATTERN.test(closingFence)) {
        return null;
    }

    const language = openingFence.slice(3).trim() || null;
    const code = lines.slice(1, -1).join('\n');

    return {
        language,
        code,
    };
};

export const isStandaloneFencedCodeBlock = (value: string): boolean => {
    return parseStandaloneFencedCodeBlock(value) !== null;
};

const ATX_HEADING_PATTERN = /^ {0,3}(#{1,6})[ \t]+(.+?)\s*$/;
const BLOCK_MARKDOWN_SIGNAL_PATTERN = /(^|\n)\s{0,3}(#{1,6}[ \t]+|[-+*][ \t]+|\d+[.)][ \t]+|>[ \t]+|```|~~~|[-*_]{3,}[ \t]*$|\|.+\|)/m;
const INLINE_MARKDOWN_SIGNAL_PATTERN = /(\[[^\]]+\]\([^)]+\)|`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_)/;
const MARKDOWN_FENCE_OPEN_PATTERN = /^```(?:markdown|md|mdx)\s*$/i;
const PLAIN_FENCE_CLOSE_PATTERN = /^```$/;

export const parseStandaloneAtxHeading = (value: string): AtxHeadingPayload | null => {
    const normalized = normalizeLineEnding(value).replace(/\n+$/g, '');
    if (!normalized || normalized.includes('\n')) return null;

    const match = normalized.match(ATX_HEADING_PATTERN);
    if (!match) return null;

    const level = match[1].length;
    const text = match[2].trim();
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

export const looksLikeMarkdownForPaste = (value: string): boolean => {
    const normalized = normalizeLineEnding(value);
    if (!normalized.trim()) return false;

    return (
        isTocShortcutText(normalized)
        || BLOCK_MARKDOWN_SIGNAL_PATTERN.test(normalized)
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

    for (let i = 0; i < lines.length; i += 1) {
        if (!MARKDOWN_FENCE_OPEN_PATTERN.test(lines[i].trim())) continue;

        for (let j = lines.length - 1; j > i; j -= 1) {
            if (!PLAIN_FENCE_CLOSE_PATTERN.test(lines[j].trim())) continue;
            const span = j - i;
            if (span <= bestSpan) break;
            bestStart = i;
            bestEnd = j;
            bestSpan = span;
            break;
        }
    }

    if (bestStart < 0 || bestEnd <= bestStart + 1) return null;

    const content = lines.slice(bestStart + 1, bestEnd).join('\n').trim();
    return content || null;
};
