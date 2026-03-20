export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export const clampHeadingLevel = (rawLevel: number): HeadingLevel => {
    const normalized = Number.isFinite(rawLevel) ? Math.trunc(rawLevel) : 1;
    if (normalized <= 1) return 1;
    if (normalized >= 6) return 6;
    return normalized as HeadingLevel;
};

export const getDefaultHeadingPlaceholderText = (rawLevel: number): string => {
    const level = clampHeadingLevel(rawLevel);
    return `Heading ${level}`;
};
