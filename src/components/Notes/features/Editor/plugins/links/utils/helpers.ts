import type { EditorState } from '@milkdown/kit/prose/state';
import type { Mark, MarkType, Node as ProseNode } from '@milkdown/kit/prose/model';
import { EditorView } from '@milkdown/kit/prose/view';

export type LinkRange = {
    start: number;
    end: number;
    linkMarkType: any;
};

export const MAX_LINK_MARK_RANGE_SCAN_CHARS = 4096;

function marksEqual(left: Mark, right: Mark): boolean {
    if (left === right) return true;
    if (typeof left.eq === 'function') return left.eq(right);
    if (left.type !== right.type) return false;
    return JSON.stringify(left.attrs ?? {}) === JSON.stringify(right.attrs ?? {});
}

function findLinkMark(node: ProseNode | null | undefined, linkMarkType: MarkType): Mark | null {
    return node?.marks.find((mark) => mark.type === linkMarkType) ?? null;
}

function findLinkChildAroundOffset(parent: ProseNode, parentOffset: number, linkMarkType: MarkType): {
    index: number;
    offset: number;
    node: ProseNode;
    mark: Mark;
} | null {
    const after = parent.childAfter(parentOffset);
    const afterMark = findLinkMark(after.node, linkMarkType);
    if (after.node && afterMark) {
        return {
            index: after.index,
            offset: after.offset,
            node: after.node,
            mark: afterMark,
        };
    }

    const before = parent.childBefore(parentOffset);
    const beforeMark = findLinkMark(before.node, linkMarkType);
    if (before.node && beforeMark) {
        return {
            index: before.index,
            offset: before.offset,
            node: before.node,
            mark: beforeMark,
        };
    }

    return null;
}

export function resolveLinkMarkRangeAtPos(state: EditorState, pos: number): LinkRange | null {
    const linkMarkType = state.schema.marks.link;
    if (!linkMarkType) return null;

    const $pos = state.doc.resolve(pos);
    const parent = $pos.parent;
    if (!parent || typeof parent.childAfter !== 'function' || typeof parent.childBefore !== 'function') {
        return null;
    }

    const candidate = findLinkChildAroundOffset(parent, $pos.parentOffset, linkMarkType);
    if (!candidate) return null;

    const targetMark = candidate.mark;
    let startIndex = candidate.index;
    let startOffset = candidate.offset;
    let endIndex = candidate.index;
    let endOffset = candidate.offset + candidate.node.nodeSize;
    let scanned = candidate.node.nodeSize;
    if (scanned > MAX_LINK_MARK_RANGE_SCAN_CHARS) {
        return null;
    }

    while (startIndex > 0) {
        const previousNode = parent.child(startIndex - 1);
        const previousMark = findLinkMark(previousNode, linkMarkType);
        if (!previousMark || !marksEqual(previousMark, targetMark)) break;
        scanned += previousNode.nodeSize;
        if (scanned > MAX_LINK_MARK_RANGE_SCAN_CHARS) return null;
        startIndex -= 1;
        startOffset -= previousNode.nodeSize;
    }

    while (endIndex + 1 < parent.childCount) {
        const nextNode = parent.child(endIndex + 1);
        const nextMark = findLinkMark(nextNode, linkMarkType);
        if (!nextMark || !marksEqual(nextMark, targetMark)) break;
        scanned += nextNode.nodeSize;
        if (scanned > MAX_LINK_MARK_RANGE_SCAN_CHARS) return null;
        endIndex += 1;
        endOffset += nextNode.nodeSize;
    }

    const parentStart = pos - $pos.parentOffset;
    return {
        start: parentStart + startOffset,
        end: parentStart + endOffset,
        linkMarkType
    };
}

export function findLinkRange(view: EditorView, link: HTMLElement): LinkRange | null {
    const pos = view.posAtDOM(link, 0);
    if (pos < 0) return null;
    return resolveLinkMarkRangeAtPos(view.state, pos);
}

export function findLinkElementNearPos(view: EditorView, pos: number): HTMLElement | null {
    const domInfo = view.domAtPos(pos);
    let node = domInfo.node as HTMLElement;
    if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentElement as HTMLElement;
    }
    if (node && node.tagName !== 'A') {
        node = node.closest('a') as HTMLElement;
    }
    return node || null;
}

export function hasAdjacentLinkMark(state: EditorState, pos: number): boolean {
    const $pos = state.doc.resolve(pos);
    return $pos.nodeBefore?.marks?.some(m => m.type.name === 'link') === true ||
        $pos.nodeAfter?.marks?.some(m => m.type.name === 'link') === true;
}

export function hasLinkMarkAroundCursor(state: EditorState, pos: number): boolean {
    const $pos = state.doc.resolve(pos);
    return $pos.nodeBefore?.marks?.some(m => m.type.name === 'link') === true &&
        $pos.nodeAfter?.marks?.some(m => m.type.name === 'link') === true;
}
