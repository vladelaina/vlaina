import { describe, expect, it } from 'vitest';
import {
    collectCollapsedRanges,
    collectTopLevelNodes,
    findCollapsedSectionByHeading,
    findCollapsedRangeContainingPos,
    findCollapsedRangeIntersectingSelection,
    findFirstCollapsedRangeAfterHeading,
    getCollapsedNodePositions,
    type PositionedNode,
    type TopLevelNodeLike,
} from './headingCollapseUtils';

const heading = (level: number, nodeSize = 4): TopLevelNodeLike => ({
    type: { name: 'heading' },
    attrs: { level },
    nodeSize,
});

const paragraph = (nodeSize = 5): TopLevelNodeLike => ({
    type: { name: 'paragraph' },
    nodeSize,
});

function toDocLike(nodes: TopLevelNodeLike[]) {
    return {
        forEach: (f: (node: TopLevelNodeLike, offset: number) => void) => {
            let offset = 0;
            nodes.forEach((node) => {
                f(node, offset);
                offset += node.nodeSize;
            });
        },
    };
}

describe('headingCollapseUtils', () => {
    it('collects top-level nodes with positions', () => {
        const nodes = [heading(1, 4), paragraph(6), heading(1, 5)];
        const positioned = collectTopLevelNodes(toDocLike(nodes));
        expect(positioned.map((n) => n.pos)).toEqual([0, 4, 10]);
        expect(positioned.map((n) => n.endPos)).toEqual([4, 10, 15]);
    });

    it('gets collapsed node ranges until next same-or-higher heading', () => {
        const positioned: Array<PositionedNode<TopLevelNodeLike>> = [
            { pos: 0, node: heading(1, 4), endPos: 4 },
            { pos: 4, node: paragraph(6), endPos: 10 },
            { pos: 10, node: heading(2, 5), endPos: 15 },
            { pos: 15, node: paragraph(5), endPos: 20 },
            { pos: 20, node: heading(1, 4), endPos: 24 },
        ];

        expect(getCollapsedNodePositions(positioned, 0)).toEqual([
            { from: 4, to: 10 },
            { from: 10, to: 15 },
            { from: 15, to: 20 },
        ]);
    });

    it('collects collapsed ranges from collapsed heading set', () => {
        const positioned: Array<PositionedNode<TopLevelNodeLike>> = [
            { pos: 0, node: heading(1, 4), endPos: 4 },
            { pos: 4, node: paragraph(6), endPos: 10 },
            { pos: 10, node: heading(1, 4), endPos: 14 },
        ];
        const ranges = collectCollapsedRanges(positioned, new Set([0]));
        expect(ranges).toEqual([{ headingPos: 0, from: 4, to: 10 }]);
    });

    it('finds containing/intersecting range', () => {
        const ranges = [
            { headingPos: 0, from: 4, to: 10 },
            { headingPos: 12, from: 16, to: 22 },
        ];

        expect(findCollapsedRangeContainingPos(ranges, 4)).toEqual({ headingPos: 0, from: 4, to: 10 });
        expect(findCollapsedRangeContainingPos(ranges, 10)).toBeNull();
        expect(findCollapsedRangeIntersectingSelection(ranges, 8, 11)).toEqual({ headingPos: 0, from: 4, to: 10 });
        expect(findCollapsedRangeIntersectingSelection(ranges, 10, 16)).toBeNull();
    });

    it('finds first range for a heading', () => {
        const ranges = [
            { headingPos: 0, from: 4, to: 10 },
            { headingPos: 0, from: 10, to: 14 },
            { headingPos: 20, from: 24, to: 30 },
        ];

        expect(findFirstCollapsedRangeAfterHeading(ranges, 0)).toEqual({ headingPos: 0, from: 4, to: 10 });
        expect(findFirstCollapsedRangeAfterHeading(ranges, 20)).toEqual({ headingPos: 20, from: 24, to: 30 });
        expect(findFirstCollapsedRangeAfterHeading(ranges, 99)).toBeNull();
    });

    it('finds collapsed section boundary by heading', () => {
        const ranges = [
            { headingPos: 0, from: 4, to: 10 },
            { headingPos: 0, from: 10, to: 14 },
            { headingPos: 20, from: 24, to: 30 },
        ];

        expect(findCollapsedSectionByHeading(ranges, 0)).toEqual({ headingPos: 0, from: 4, to: 14 });
        expect(findCollapsedSectionByHeading(ranges, 20)).toEqual({ headingPos: 20, from: 24, to: 30 });
        expect(findCollapsedSectionByHeading(ranges, 99)).toBeNull();
    });
});
