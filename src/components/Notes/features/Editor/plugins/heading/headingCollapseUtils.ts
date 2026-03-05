export interface TopLevelNodeLike {
    type: { name: string };
    attrs?: { level?: number };
    nodeSize: number;
}

export interface PositionedNode<TNode = TopLevelNodeLike> {
    pos: number;
    node: TNode;
    endPos: number;
}

export interface CollapsedRange {
    headingPos: number;
    from: number;
    to: number;
}

export interface CollapsedSection {
    headingPos: number;
    from: number;
    to: number;
}

type DocLike<TNode = TopLevelNodeLike> = {
    forEach: (f: (node: TNode, offset: number) => void) => void;
};

export function collectTopLevelNodes<TNode extends TopLevelNodeLike>(
    doc: DocLike<TNode>,
): Array<PositionedNode<TNode>> {
    const nodes: Array<PositionedNode<TNode>> = [];
    doc.forEach((node, offset) => {
        nodes.push({
            pos: offset,
            node,
            endPos: offset + node.nodeSize,
        });
    });
    return nodes;
}

export function getCollapsedNodePositions<TNode extends TopLevelNodeLike>(
    nodes: Array<PositionedNode<TNode>>,
    headingIndex: number,
): Array<{ from: number; to: number }> {
    const headingNode = nodes[headingIndex];
    const headingLevel = headingNode.node.attrs?.level || 1;
    const result: Array<{ from: number; to: number }> = [];

    for (let i = headingIndex + 1; i < nodes.length; i += 1) {
        const currentNode = nodes[i];

        if (currentNode.node.type.name === 'heading') {
            const currentLevel = currentNode.node.attrs?.level || 1;
            if (currentLevel <= headingLevel) break;
        }

        result.push({
            from: currentNode.pos,
            to: currentNode.endPos,
        });
    }

    return result;
}

export function collectCollapsedRanges<TNode extends TopLevelNodeLike>(
    nodes: Array<PositionedNode<TNode>>,
    collapsedHeadings: Set<number>,
): CollapsedRange[] {
    const ranges: CollapsedRange[] = [];

    nodes.forEach((nodeInfo, index) => {
        if (nodeInfo.node.type.name !== 'heading') return;
        if (!collapsedHeadings.has(nodeInfo.pos)) return;

        const collapsedRanges = getCollapsedNodePositions(nodes, index);
        collapsedRanges.forEach((range) => {
            ranges.push({
                headingPos: nodeInfo.pos,
                from: range.from,
                to: range.to,
            });
        });
    });

    return ranges;
}

export function findCollapsedRangeContainingPos(
    ranges: CollapsedRange[],
    pos: number,
): CollapsedRange | null {
    for (const range of ranges) {
        if (pos >= range.from && pos < range.to) return range;
    }
    return null;
}

export function findCollapsedRangeIntersectingSelection(
    ranges: CollapsedRange[],
    from: number,
    to: number,
): CollapsedRange | null {
    for (const range of ranges) {
        if (to > range.from && from < range.to) return range;
    }
    return null;
}

export function findFirstCollapsedRangeAfterHeading(
    ranges: CollapsedRange[],
    headingPos: number,
): CollapsedRange | null {
    for (const range of ranges) {
        if (range.headingPos === headingPos) return range;
    }
    return null;
}

export function findCollapsedSectionByHeading(
    ranges: CollapsedRange[],
    headingPos: number,
): CollapsedSection | null {
    let from = Number.POSITIVE_INFINITY;
    let to = Number.NEGATIVE_INFINITY;

    for (const range of ranges) {
        if (range.headingPos !== headingPos) continue;
        if (range.from < from) from = range.from;
        if (range.to > to) to = range.to;
    }

    if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
    return { headingPos, from, to };
}
