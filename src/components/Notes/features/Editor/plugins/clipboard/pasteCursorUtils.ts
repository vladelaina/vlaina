import type { Node as ProseNode } from '@milkdown/kit/prose/model';

type TextblockLikeNode = {
    isTextblock: boolean;
    content: {
        size: number;
    };
};

type DocLike = {
    content: {
        size: number;
    };
    nodesBetween: (
        from: number,
        to: number,
        f: (node: TextblockLikeNode, pos: number) => void,
    ) => void;
};

export const findTailCursorPosInRange = (doc: DocLike, from: number, to: number): number | null => {
    const scanTo = Math.max(from + 1, to);
    let tailPos: number | null = null;

    doc.nodesBetween(from, scanTo, (node, pos) => {
        if (!node.isTextblock) return;

        // Cursor after the last character inside a textblock is `pos + content.size + 1`.
        const textTailPos = pos + node.content.size + 1;
        if (textTailPos < from || textTailPos > doc.content.size) return;
        tailPos = textTailPos;
    });

    return tailPos;
};

export const isMarkdownStructuralResult = (nodes: ProseNode[]): boolean => {
    if (nodes.length === 0) return false;

    let hasStructure = false;
    for (const node of nodes) {
        if (node.type.name !== 'paragraph') {
            hasStructure = true;
            break;
        }
        node.descendants((child) => {
            if (child.isText && child.marks.length > 0) {
                hasStructure = true;
                return false;
            }
            return;
        });
        if (hasStructure) break;
    }

    return hasStructure;
};
