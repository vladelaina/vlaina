import type { DecorationSet, EditorView } from '@milkdown/kit/prose/view';
import { buildHeadingCollapseDecorations } from './headingCollapseDecorations';
import {
    collectCollapsedRanges,
    collectTopLevelNodes,
    type CollapsedRange,
} from './headingCollapseUtils';

export interface HeadingCollapsePluginState {
    decorations: DecorationSet;
    collapsedHeadings: Set<number>;
    topLevelNodes: ReturnType<typeof collectTopLevelNodes>;
    collapsedRanges: CollapsedRange[];
}

export function buildHeadingCollapsePluginState(
    doc: any,
    collapsedHeadings: Set<number>,
    dispatchToggle: (view: EditorView, headingPos: number, isCollapsed: boolean) => void,
): HeadingCollapsePluginState {
    const topLevelNodes = collectTopLevelNodes(doc);
    const collapsedRanges = collapsedHeadings.size > 0
        ? collectCollapsedRanges(topLevelNodes, collapsedHeadings)
        : [];

    return {
        collapsedHeadings,
        topLevelNodes,
        collapsedRanges,
        decorations: buildHeadingCollapseDecorations({
            doc,
            nodes: topLevelNodes,
            collapsedHeadings,
            dispatchToggle,
        }),
    };
}
