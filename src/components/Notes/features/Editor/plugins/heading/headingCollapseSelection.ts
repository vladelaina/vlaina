import { Selection } from '@milkdown/kit/prose/state';
import {
    findCollapsedSectionByHeading,
    type CollapsedRange,
    type CollapsedSection,
} from './headingCollapseUtils';

export interface SelectionSnapshot {
    from: number;
    to: number;
    empty: boolean;
}

const sameSelection = (a: SelectionSnapshot, b: SelectionSnapshot): boolean => {
    return a.from === b.from && a.to === b.to && a.empty === b.empty;
};

export const snapshotSelection = (selection: {
    from: number;
    to: number;
    empty: boolean;
}): SelectionSnapshot => {
    return { from: selection.from, to: selection.to, empty: selection.empty };
};

export const setSelectionAtPos = (
    tr: any,
    pos: number,
    bias: 1 | -1,
): {
    changed: boolean;
    requestedPos: number;
    requestedBias: 1 | -1;
    before: SelectionSnapshot;
    after: SelectionSnapshot;
} => {
    const before = snapshotSelection(tr.selection);
    const docEnd = tr.doc.content.size;
    const safePos = Math.max(0, Math.min(pos, docEnd));
    tr.setSelection(Selection.near(tr.doc.resolve(safePos), bias));
    const after = snapshotSelection(tr.selection);

    return {
        changed: !sameSelection(before, after),
        requestedPos: safePos,
        requestedBias: bias,
        before,
        after,
    };
};

export const resolveTailRedirectPos = (
    doc: { nodeAt: (pos: number) => { nodeSize?: number; type?: { name?: string } } | null },
    headingPos: number,
    collapsedSectionFrom: number,
): number => {
    const headingNode = doc.nodeAt(headingPos);
    if (headingNode?.type?.name === 'heading') {
        const headingEndInside = headingPos + Math.max(1, (headingNode.nodeSize ?? 0) - 1);
        return headingEndInside;
    }
    return Math.max(0, collapsedSectionFrom - 1);
};

export const resolveExpandedSectionTailPos = (section: CollapsedSection): number => {
    return Math.max(section.from, section.to - 1);
};

export const findCollapsedSectionByBoundaryPos = (
    ranges: CollapsedRange[],
    pos: number,
): CollapsedSection | null => {
    for (const range of ranges) {
        if (range.to !== pos) continue;
        const section = findCollapsedSectionByHeading(ranges, range.headingPos);
        if (section) return section;
    }
    return null;
};

export const findCollapsedSectionAtOrBoundaryPos = (
    ranges: CollapsedRange[],
    pos: number,
): CollapsedSection | null => {
    for (const range of ranges) {
        if (pos < range.from || pos > range.to) continue;
        const section = findCollapsedSectionByHeading(ranges, range.headingPos);
        if (section) return section;
    }
    return null;
};
