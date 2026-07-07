import type { EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
    findLinkElementNearPos,
    hasAdjacentLinkMark,
    resolveLinkMarkRangeAtPos,
} from '../utils/helpers';
import { getBoundedTextBetween } from '../../shared/selectionTextLimits';

export function resolveKeyboardLinkTooltipTarget(
    view: EditorView,
    prevState: EditorState,
): HTMLElement | 'hide' | null {
    if (view.state.selection.eq(prevState.selection)) {
        return null;
    }

    const pos = view.state.selection.$from.pos;
    if (!hasAdjacentLinkMark(view.state, pos)) {
        return 'hide';
    }

    const range = resolveLinkMarkRangeAtPos(view.state, pos);
    if (!range) return null;

    const linkText = getBoundedTextBetween(view.state.doc, range.start, range.end, ' ');
    const trimStart = linkText.search(/\S|$/);
    const trimEnd = linkText.search(/\S\s*$/) + 1;
    const relativePos = pos - range.start;
    const isInsideTrimmed = relativePos > trimStart && relativePos < trimEnd;

    if (!isInsideTrimmed) {
        return 'hide';
    }

    return findLinkElementNearPos(view, pos);
}
