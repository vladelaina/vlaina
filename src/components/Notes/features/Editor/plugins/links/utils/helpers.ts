import { EditorView } from '@milkdown/kit/prose/view';

/**
 * Helper to find the full range of a link mark at a given position within the DOM
 */
export function findLinkRange(view: EditorView, link: HTMLElement): { start: number, end: number, linkMarkType: any } | null {
    const pos = view.posAtDOM(link, 0);
    if (pos < 0) return null;

    const { state } = view;
    const linkMarkType = state.schema.marks.link;
    if (!linkMarkType) return null;

    // Find the link mark range
    // Scan to find the full extent of the link mark
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