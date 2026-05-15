import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { sanitizeNoteLinkHref } from '@/lib/notes/markdown/urlSecurity';
import {
    findLinkRange,
    resolveLinkMarkRangeAtPos,
} from '../utils/helpers';

export function editExistingLink(
    view: EditorView,
    link: HTMLElement,
    text: string,
    url: string
): number | null {
    const pos = view.posAtDOM(link, 0);
    if (pos < 0) return null;

    const { state, dispatch } = view;
    const linkMarkType = state.schema.marks.link;
    if (!linkMarkType) return null;

    const range = resolveLinkMarkRangeAtPos(state, pos);
    const start = range?.start ?? pos;
    const end = range?.end ?? pos + (link.textContent?.length || 0);
    if (start === end) return null;

    let tr = state.tr;
    if (range) tr = tr.removeMark(start, end, linkMarkType);

    const safeUrl = sanitizeNoteLinkHref(url);
    tr = tr.insertText(text, start, end);
    if (safeUrl) {
        tr = tr.addMark(start, start + text.length, linkMarkType.create({ href: safeUrl }));
    }

    tr.setSelection(TextSelection.create(tr.doc, start + text.length));
    dispatch(tr);
    return tr.mapping.map(start);
}

export function unlinkExistingLink(view: EditorView, link: HTMLElement): boolean {
    const result = findLinkRange(view, link);
    if (!result) return false;

    const tr = view.state.tr.removeMark(result.start, result.end, result.linkMarkType);
    view.dispatch(tr);
    return true;
}

export function removeExistingLink(view: EditorView, link: HTMLElement): boolean {
    const result = findLinkRange(view, link);
    if (!result) return false;

    const tr = view.state.tr.delete(result.start, result.end);
    view.dispatch(tr);
    return true;
}

export function editLinkAtPosition(
    view: EditorView,
    from: number,
    to: number,
    text: string,
    url: string
): number | null {
    const { state, dispatch } = view;
    const linkMarkType = state.schema.marks.link;
    if (!linkMarkType) return null;

    const safeUrl = sanitizeNoteLinkHref(url);
    if (!safeUrl) {
        const tr = state.tr.removeMark(from, to, linkMarkType);
        dispatch(tr);
        return null;
    }

    const tr = state.tr
        .insertText(text, from, to)
        .addMark(from, from + text.length, linkMarkType.create({ href: safeUrl }));

    tr.setSelection(TextSelection.create(tr.doc, from + text.length));
    dispatch(tr);
    return tr.mapping.map(from);
}
