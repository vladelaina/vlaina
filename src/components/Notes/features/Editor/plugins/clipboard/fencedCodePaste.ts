const OPENING_FENCE_PATTERN = /^```[^`]*$/;
const CLOSING_FENCE_PATTERN = /^```+$/;

const normalizeLineEnding = (value: string) => value.replace(/\r\n?/g, '\n');

export interface FencedCodePayload {
    language: string | null;
    code: string;
}

export interface AtxHeadingPayload {
    level: number;
    text: string;
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

export const looksLikeMarkdownForPaste = (value: string): boolean => {
    const normalized = normalizeLineEnding(value);
    if (!normalized.trim()) return false;

    return BLOCK_MARKDOWN_SIGNAL_PATTERN.test(normalized) || INLINE_MARKDOWN_SIGNAL_PATTERN.test(normalized);
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
