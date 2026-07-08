interface MarkdownFlowNode {
    type?: string;
    children?: unknown[];
}

interface MarkdownParentNode {
    type?: string;
    children?: MarkdownFlowNode[];
}

interface MarkdownStringifyState {
    indexStack?: number[];
}

function joinAdjacentTightRootBlocks(
    left: MarkdownFlowNode,
    right: MarkdownFlowNode,
    parent: MarkdownParentNode,
    state?: MarkdownStringifyState,
): 0 | undefined {
    if (parent.type !== 'root') return undefined;

    if (
        isNonEmptyTextBlock(left, 'paragraph')
        && isNonEmptyTextBlock(right, 'paragraph')
        && isFollowedByHeading(parent, state)
    ) {
        return 0;
    }

    if (
        isNonEmptyTextBlock(left)
        && isNonEmptyTextBlock(right)
        && (left.type === 'heading' || right.type === 'heading')
    ) {
        return 0;
    }

    if (
        (left.type === 'heading' && right.type === 'list')
        || (left.type === 'list' && right.type === 'heading')
    ) {
        return 0;
    }
    return undefined;
}

function isNonEmptyTextBlock(
    node: MarkdownFlowNode,
    type?: 'heading' | 'paragraph',
): boolean {
    if (type && node.type !== type) return false;

    return (
        node.type === 'heading'
        || (
            node.type === 'paragraph'
            && Array.isArray(node.children)
            && node.children.length > 0
        )
    );
}

function isFollowedByHeading(
    parent: MarkdownParentNode,
    state?: MarkdownStringifyState,
): boolean {
    const currentIndex = state?.indexStack?.[state.indexStack.length - 1];
    if (
        typeof currentIndex !== 'number'
        || !Array.isArray(parent.children)
    ) {
        return false;
    }

    for (let index = currentIndex + 2; index < parent.children.length; index += 1) {
        const next = parent.children[index];
        if (!next || next.type === 'html' || next.type === 'html_block') {
            continue;
        }
        return next.type === 'heading';
    }

    return false;
}

export const notesRemarkStringifyOptions = {
    bullet: '-' as const,
    join: [joinAdjacentTightRootBlocks],
    rule: '-' as const,
    ruleRepetition: 3,
    setext: false,
};

export const notesRemarkGfmOptions = {
    tableCellPadding: false,
    tablePipeAlign: false,
};
