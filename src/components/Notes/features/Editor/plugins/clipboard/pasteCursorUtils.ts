import type { Node as ProseNode, Slice } from '@milkdown/kit/prose/model';
import {
    DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT,
    STOP_PROSE_SCAN,
    scanProseDescendants,
} from '../shared/boundedProseNodeScan';

export const MAX_MARKDOWN_STRUCTURAL_RESULT_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;

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

type PasteRangeState = {
    doc: {
        nodeAt: (pos: number) => ProseNode | null;
    };
    selection: {
        from: number;
        to: number;
    };
};

type PasteRange = {
    from: number;
    to: number;
};

const isEmptyParagraphNode = (node: ProseNode | null): node is ProseNode =>
    node?.type.name === 'paragraph' && node.content.size === 0;

const hasOnlyInlineContent = (slice: Slice): boolean => {
    let hasContent = false;
    let onlyInline = true;

    slice.content.forEach((node) => {
        hasContent = true;
        if (!node.isInline && !node.isText) {
            onlyInline = false;
        }
    });

    return hasContent && onlyInline;
};

export const resolvePasteRange = (state: PasteRangeState, slice: Slice): PasteRange => {
    const { from, to } = state.selection;
    if (from !== to) {
        return { from, to };
    }

    const nodeAfter = state.doc.nodeAt(from);
    if (!isEmptyParagraphNode(nodeAfter)) {
        return { from, to };
    }

    if (hasOnlyInlineContent(slice)) {
        const insideEmptyParagraph = from + 1;
        return { from: insideEmptyParagraph, to: insideEmptyParagraph };
    }

    return { from, to: from + nodeAfter.nodeSize };
};

export const findTailCursorPosInRange = (doc: DocLike, from: number, to: number): number | null => {
    const scanTo = Math.max(from + 1, to);
    let tailPos: number | null = null;

    doc.nodesBetween(from, scanTo, (node, pos) => {
        if (!node.isTextblock) return;
        const textTailPos = pos + node.content.size + 1;
        if (textTailPos < from || textTailPos > doc.content.size) return;
        tailPos = textTailPos;
    });

    return tailPos;
};

export const isMarkdownStructuralResult = (nodes: ProseNode[]): boolean => {
    if (nodes.length === 0) return false;

    let hasStructure = false;
    let remainingScanNodes = MAX_MARKDOWN_STRUCTURAL_RESULT_SCAN_NODES;
    for (const node of nodes) {
        if (node.type.name !== 'paragraph') {
            hasStructure = true;
            break;
        }
        const completed = scanProseDescendants(node, (child) => {
            remainingScanNodes -= 1;
            if (!child.isText) {
                hasStructure = true;
                return STOP_PROSE_SCAN;
            }
            if ((child.marks?.length ?? 0) > 0) {
                hasStructure = true;
                return STOP_PROSE_SCAN;
            }
            return true;
        }, remainingScanNodes);
        if (hasStructure) break;
        if (!completed || remainingScanNodes <= 0) break;
    }

    return hasStructure;
};
