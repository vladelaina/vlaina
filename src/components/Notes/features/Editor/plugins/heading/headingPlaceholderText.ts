import { translate } from '@/lib/i18n';
import type { MessageKey } from '@/lib/i18n/messages';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

const headingPlaceholderMessageKeys: Record<HeadingLevel, MessageKey> = {
    1: 'editor.blockType.heading1',
    2: 'editor.blockType.heading2',
    3: 'editor.blockType.heading3',
    4: 'editor.blockType.heading4',
    5: 'editor.blockType.heading5',
    6: 'editor.blockType.heading6',
};

export const clampHeadingLevel = (rawLevel: number): HeadingLevel => {
    const normalized = Number.isFinite(rawLevel) ? Math.trunc(rawLevel) : 1;
    if (normalized <= 1) return 1;
    if (normalized >= 6) return 6;
    return normalized as HeadingLevel;
};

export const getDefaultHeadingPlaceholderText = (rawLevel: number): string => {
    const level = clampHeadingLevel(rawLevel);
    return translate(headingPlaceholderMessageKeys[level]);
};
