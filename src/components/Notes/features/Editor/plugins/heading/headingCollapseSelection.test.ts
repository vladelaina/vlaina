import { describe, expect, it } from 'vitest';
import {
    findCollapsedSectionAtOrBoundaryPos,
    findCollapsedSectionByBoundaryPos,
    resolveExpandedSectionTailPos,
    resolveTailRedirectPos,
} from './headingCollapseSelection';

describe('headingCollapseSelection', () => {
    const ranges = [
        { headingPos: 10, from: 14, to: 20 },
        { headingPos: 10, from: 20, to: 26 },
        { headingPos: 40, from: 44, to: 50 },
    ];

    it('finds collapsed section by exact boundary position', () => {
        expect(findCollapsedSectionByBoundaryPos(ranges, 26)).toEqual({
            headingPos: 10,
            from: 14,
            to: 26,
        });
        expect(findCollapsedSectionByBoundaryPos(ranges, 25)).toBeNull();
    });

    it('finds collapsed section by inner position or right boundary', () => {
        expect(findCollapsedSectionAtOrBoundaryPos(ranges, 19)).toEqual({
            headingPos: 10,
            from: 14,
            to: 26,
        });
        expect(findCollapsedSectionAtOrBoundaryPos(ranges, 26)).toEqual({
            headingPos: 10,
            from: 14,
            to: 26,
        });
        expect(findCollapsedSectionAtOrBoundaryPos(ranges, 30)).toBeNull();
    });

    it('resolves expanded section tail position', () => {
        expect(resolveExpandedSectionTailPos({ headingPos: 10, from: 14, to: 26 })).toBe(25);
        expect(resolveExpandedSectionTailPos({ headingPos: 10, from: 14, to: 14 })).toBe(14);
    });

    it('resolves fallback tail redirect position', () => {
        const docWithHeading = {
            nodeAt: (pos: number) => (pos === 10 ? { type: { name: 'heading' }, nodeSize: 4 } : null),
        };
        const docWithoutHeading = {
            nodeAt: () => ({ type: { name: 'paragraph' }, nodeSize: 2 }),
        };

        expect(resolveTailRedirectPos(docWithHeading, 10, 14)).toBe(13);
        expect(resolveTailRedirectPos(docWithoutHeading, 10, 14)).toBe(13);
    });
});

