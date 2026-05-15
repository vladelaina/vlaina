import type { EditorState } from '@milkdown/kit/prose/state';
import { EditorView } from '@milkdown/kit/prose/view';

export type LinkRange = {
    start: number;
    end: number;
    linkMarkType: any;
};

export function resolveLinkMarkRangeAtPos(state: EditorState, pos: number): LinkRange | null {
    const linkMarkType = state.schema.marks.link;
    if (!linkMarkType) return null;

    const $pos = state.doc.resolve(pos);
    const hasMark = linkMarkType.isInSet($pos.marks()) ||
        ($pos.nodeAfter && linkMarkType.isInSet($pos.nodeAfter.marks));
    if (!hasMark) return null;

    let scanForwards = pos;
    while (scanForwards < state.doc.content.size) {
        const $scan = state.doc.resolve(scanForwards);
        const marks = $scan.marks().concat($scan.nodeAfter?.marks || []);
        if (!linkMarkType.isInSet(marks)) break;
        scanForwards++;
    }
    let scanBackwards = pos;
    while (scanBackwards > 0) {
        const marksBefore = state.doc.resolve(scanBackwards - 1).marks();
        if (!linkMarkType.isInSet(marksBefore)) break;
        scanBackwards--;
    }

    return {
        start: scanBackwards,
        end: scanForwards,
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
