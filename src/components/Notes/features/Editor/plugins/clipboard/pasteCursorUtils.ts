import type { Node as ProseNode, Slice } from '@milkdown/kit/prose/model';
import {
    DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT,
    STOP_PROSE_SCAN,
    scanProseDescendants,
} from '../shared/boundedProseNodeScan';

export const MAX_MARKDOWN_STRUCTURAL_RESULT_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
export const MAX_PASTE_CURSOR_TAIL_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;

type TextblockLikeNode = {
    child?: (index: number) => TextblockLikeNode;
    childCount?: number;
    isTextblock: boolean;
    content: {
        size: number;
    };
    nodeSize?: number;
};

type DocLike = {
    content: {
        size: number;
    };
    child?: (index: number) => TextblockLikeNode;
    childCount?: number;
    nodesBetween: (
        from: number,
        to: number,
        f: (node: TextblockLikeNode, pos: number) => boolean | void,
    ) => void;
};

type PasteRangeState = {
    doc: {
        nodeAt: (pos: number) => ProseNode | null;
    };
    selection: {
        $from?: {
            after: (depth?: number) => number;
            before: (depth?: number) => number;
            depth: number;
            parent: ProseNode;
        };
        $to?: {
            parent: ProseNode;
        };
        empty?: boolean;
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

const isEmptyTopLevelParagraphSelection = (selection: PasteRangeState['selection']): boolean =>
    Boolean(
        selection.empty !== false &&
        selection.$from &&
        selection.$to &&
        selection.$from.depth === 1 &&
        selection.$from.parent === selection.$to.parent &&
        isEmptyParagraphNode(selection.$from.parent),
    );

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
        if (!isEmptyTopLevelParagraphSelection(state.selection)) {
            return { from, to };
        }

        if (hasOnlyInlineContent(slice)) {
            return { from, to };
        }

        try {
            return {
                from: state.selection.$from!.before(state.selection.$from!.depth),
                to: state.selection.$from!.after(state.selection.$from!.depth),
            };
        } catch {
            return { from, to };
        }
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

    const visitTextblock = (node: TextblockLikeNode, pos: number) => {
        if (!node.isTextblock) return;
        const textTailPos = pos + node.content.size + 1;
        if (textTailPos < from || textTailPos > doc.content.size) return;
        tailPos = textTailPos;
    };

    if (typeof doc.child === 'function' && typeof doc.childCount === 'number') {
        let scanned = 0;
        const stack: Array<{
            childCount: number;
            contentStart: number;
            index: number;
            node: DocLike | TextblockLikeNode;
            offset: number;
        }> = [{
            childCount: doc.childCount,
            contentStart: 0,
            index: 0,
            node: doc,
            offset: 0,
        }];

        while (stack.length > 0 && scanned < MAX_PASTE_CURSOR_TAIL_SCAN_NODES) {
            const frame = stack[stack.length - 1];
            if (frame.index >= frame.childCount) {
                stack.pop();
                continue;
            }

            const node = frame.node.child?.(frame.index);
            const pos = frame.contentStart + frame.offset;
            frame.index += 1;
            frame.offset += node?.nodeSize ?? 1;
            if (!node) continue;

            const nodeSize = node.nodeSize ?? 1;
            const nodeEnd = pos + nodeSize;
            if (nodeEnd < from) {
                continue;
            }
            if (pos > scanTo) {
                break;
            }

            scanned += 1;
            visitTextblock(node, pos);

            if (typeof node.child === 'function' && typeof node.childCount === 'number' && node.childCount > 0) {
                stack.push({
                    childCount: node.childCount,
                    contentStart: pos + 1,
                    index: 0,
                    node,
                    offset: 0,
                });
            }
        }
    } else {
        let scanned = 0;
        doc.nodesBetween(from, scanTo, (node, pos) => {
            scanned += 1;
            if (scanned > MAX_PASTE_CURSOR_TAIL_SCAN_NODES) return false;
            visitTextblock(node, pos);
            return true;
        });
    }

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
