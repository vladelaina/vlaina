interface MarkdownFlowNode {
    type?: string;
}

interface MarkdownParentNode {
    type?: string;
}

function joinAdjacentHeadingAndList(
    left: MarkdownFlowNode,
    right: MarkdownFlowNode,
    parent: MarkdownParentNode,
): 0 | undefined {
    if (parent.type !== 'root') return undefined;
    if (
        (left.type === 'heading' && right.type === 'list')
        || (left.type === 'list' && right.type === 'heading')
    ) {
        return 0;
    }
    return undefined;
}

export const notesRemarkStringifyOptions = {
    bullet: '-' as const,
    join: [joinAdjacentHeadingAndList],
    rule: '-' as const,
    ruleRepetition: 3,
    setext: false,
};
