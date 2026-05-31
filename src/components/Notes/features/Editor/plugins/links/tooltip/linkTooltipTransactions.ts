import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { sanitizeEditorLinkHref } from '../utils/linkHref';
import {
    findLinkRange,
    resolveLinkMarkRangeAtPos,
} from '../utils/helpers';
import { markEditorUserInput } from '../../shared/userInputEvents';

export function sanitizeTooltipLinkHref(value: string): string | null {
    return sanitizeEditorLinkHref(value);
}

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

    const safeUrl = sanitizeTooltipLinkHref(url);
    tr = tr.insertText(text, start, end);
    if (safeUrl) {
        tr = tr.addMark(start, start + text.length, linkMarkType.create({ href: safeUrl }));
    }

    tr.setSelection(TextSelection.create(tr.doc, start + text.length));
    markEditorUserInput(view);
    dispatch(tr);
    return tr.mapping.map(start);
}

export function unlinkExistingLink(view: EditorView, link: HTMLElement): boolean {
    const result = findLinkRange(view, link);
    if (!result) return false;

    const tr = view.state.tr.removeMark(result.start, result.end, result.linkMarkType);
    markEditorUserInput(view);
    view.dispatch(tr);
    return true;
}

export function removeExistingLink(view: EditorView, link: HTMLElement): boolean {
    const result = findLinkRange(view, link);
    if (!result) {
        if (!link.classList.contains('autolink')) return false;

        const start = view.posAtDOM(link, 0);
        const textLength = link.textContent?.length ?? 0;
        const end = start + textLength;
        if (start < 0 || textLength <= 0 || end > view.state.doc.content.size) return false;

        const tr = view.state.tr.delete(start, end);
        markEditorUserInput(view);
        view.dispatch(tr);
        return true;
    }

    const tr = view.state.tr.delete(result.start, result.end);
    markEditorUserInput(view);
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

    const safeUrl = sanitizeTooltipLinkHref(url);
    if (!safeUrl) {
        const tr = state.tr.removeMark(from, to, linkMarkType);
        markEditorUserInput(view);
        dispatch(tr);
        return null;
    }

    const tr = state.tr
        .insertText(text, from, to)
        .addMark(from, from + text.length, linkMarkType.create({ href: safeUrl }));

    tr.setSelection(TextSelection.create(tr.doc, from + text.length));
    markEditorUserInput(view);
    dispatch(tr);
    return tr.mapping.map(from);
}
