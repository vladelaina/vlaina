import { describe, expect, it } from 'vitest';
import {
    applyCollapseAction,
    parseCollapseMetaAction,
    remapCollapsedHeadings,
} from './headingCollapseState';

describe('headingCollapseState', () => {
    it('parses valid collapse meta action', () => {
        expect(parseCollapseMetaAction({ type: 'toggle', headingPos: 10 })).toEqual({
            type: 'toggle',
            headingPos: 10,
        });
    });

    it('returns null for invalid collapse meta action', () => {
        expect(parseCollapseMetaAction({ type: 'unknown', headingPos: 10 })).toBeNull();
        expect(parseCollapseMetaAction({ type: 'toggle', headingPos: '10' })).toBeNull();
        expect(parseCollapseMetaAction(null)).toBeNull();
    });

    it('applies toggle/expand/collapse actions', () => {
        const initial = new Set<number>([10, 20]);
        const toggled = applyCollapseAction(initial, { type: 'toggle', headingPos: 10 });
        const expanded = applyCollapseAction(toggled, { type: 'expand', headingPos: 20 });
        const collapsed = applyCollapseAction(expanded, { type: 'collapse', headingPos: 30 });

        expect(Array.from(toggled.values())).toEqual([20]);
        expect(Array.from(expanded.values())).toEqual([]);
        expect(Array.from(collapsed.values())).toEqual([30]);
    });

    it('remaps heading positions and drops non-heading targets', () => {
        const current = new Set<number>([10, 20]);
        const tr = {
            docChanged: true,
            mapping: {
                map: (pos: number) => pos + 5,
            },
        };
        const doc = {
            nodeAt: (pos: number) => {
                if (pos === 15) return { type: { name: 'heading' } };
                return { type: { name: 'paragraph' } };
            },
        };

        const remapped = remapCollapsedHeadings(current, tr, doc);
        expect(Array.from(remapped.values())).toEqual([15]);
    });

    it('keeps positions when doc is unchanged', () => {
        const current = new Set<number>([10, 20]);
        const tr = {
            docChanged: false,
            mapping: {
                map: (pos: number) => pos + 1,
            },
        };
        const doc = {
            nodeAt: () => ({ type: { name: 'heading' } }),
        };

        const remapped = remapCollapsedHeadings(current, tr, doc);
        expect(Array.from(remapped.values())).toEqual([10, 20]);
    });
});
