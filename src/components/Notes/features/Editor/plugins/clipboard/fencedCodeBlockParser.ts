const STANDALONE_OPENING_FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/;
const GENERIC_FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})(.*)$/;

export const normalizeLineEnding = (value: string) => value.replace(/\r\n?/g, '\n');

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

export interface FenceState {
    marker: '`' | '~';
    size: number;
}

export function getFenceState(line: string): FenceState | null {
    const match = line.match(GENERIC_FENCE_PATTERN);
    if (!match) return null;

    const fence = match[1];
    return {
        marker: fence[0] as '`' | '~',
        size: fence.length,
    };
}

export function isFenceClose(line: string, fence: FenceState): boolean {
    const match = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
    if (!match) return false;

    const markerRun = match[1];
    return markerRun[0] === fence.marker && markerRun.length >= fence.size;
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
