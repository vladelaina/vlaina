import type { DecorationSet, EditorView } from '@milkdown/kit/prose/view';
import { buildHeadingCollapseDecorations } from './headingCollapseDecorations';
import {
    collectCollapsedRanges,
    collectTopLevelNodes,
    type CollapsedRange,
} from './headingCollapseUtils';
import {
    getTransactionChangedRanges,
    transactionTouchesDecorations,
} from '../shared/transactionStepText';
import { transactionInsertedTextMayAffectHeadingStructure } from './headingStructureChange';

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
    const decorations = buildHeadingCollapseDecorations({
        doc,
        nodes: topLevelNodes,
        collapsedHeadings,
        dispatchToggle,
    });

    return {
        collapsedHeadings,
        topLevelNodes,
        collapsedRanges,
        decorations,
    };
}

function getLastHeadingPos(topLevelNodes: HeadingCollapsePluginState['topLevelNodes']): number | null {
    for (let index = topLevelNodes.length - 1; index >= 0; index -= 1) {
        const nodeInfo = topLevelNodes[index];
        if (nodeInfo.node.type.name === 'heading') {
            return nodeInfo.pos;
        }
    }
    return null;
}

function transactionIsPureInsertion(tr: unknown): boolean {
    const ranges = getTransactionChangedRanges(tr);
    return ranges.length > 0 && ranges.every((range) => range.oldFrom === range.oldTo);
}

export function canMapHeadingCollapsePluginState(
    pluginState: HeadingCollapsePluginState,
    tr: unknown,
): boolean {
    if (pluginState.collapsedHeadings.size > 0) {
        return false;
    }
    if (!transactionIsPureInsertion(tr)) {
        return false;
    }
    if (transactionInsertedTextMayAffectHeadingStructure(
        tr,
        (tr as { doc?: unknown }).doc,
    )) {
        return false;
    }
    if (transactionTouchesDecorations(pluginState.decorations, tr)) {
        return false;
    }

    const lastHeadingPos = getLastHeadingPos(pluginState.topLevelNodes);
    if (lastHeadingPos === null) {
        return true;
    }

    return getTransactionChangedRanges(tr).every((range) => range.oldFrom > lastHeadingPos);
}

export function mapHeadingCollapsePluginState(
    pluginState: HeadingCollapsePluginState,
    tr: { mapping: Parameters<DecorationSet['map']>[0] },
    doc: any,
): HeadingCollapsePluginState {
    return {
        ...pluginState,
        decorations: pluginState.decorations.map(tr.mapping, doc),
    };
}
