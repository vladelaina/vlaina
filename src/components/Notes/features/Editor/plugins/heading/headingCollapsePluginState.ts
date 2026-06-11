import type { DecorationSet, EditorView } from '@milkdown/kit/prose/view';
import { buildHeadingCollapseDecorations } from './headingCollapseDecorations';
import {
    collectCollapsedRanges,
    collectTopLevelNodes,
    type CollapsedRange,
} from './headingCollapseUtils';
import {
    getTransactionChangedRanges,
    transactionInsertedTextMatches,
    transactionTouchesDecorations,
} from '../shared/transactionStepText';
import { transactionInsertedTextMayAffectHeadingStructure } from './headingStructureChange';

export interface HeadingCollapsePluginState {
    decorations: DecorationSet;
    collapsedHeadings: Set<number>;
    topLevelNodes: ReturnType<typeof collectTopLevelNodes>;
    collapsedRanges: CollapsedRange[];
}

const HEADING_COLLAPSE_MARKER_PATTERN = /#/u;

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

function transactionIsPureInsertion(tr: unknown): boolean {
    const ranges = getTransactionChangedRanges(tr);
    return ranges.length > 0 && ranges.every((range) => range.oldFrom === range.oldTo);
}

function positionTouchesHeadingNode(doc: any, pos: number): boolean {
    try {
        const resolvedPos = Math.max(0, Math.min(pos, doc.content?.size ?? 0));
        const $pos = doc.resolve(resolvedPos);

        for (let depth = $pos.depth; depth > 0; depth -= 1) {
            if ($pos.node(depth).type?.name === 'heading') {
                return true;
            }
        }

        return Boolean(
            $pos.nodeBefore?.type?.name === 'heading'
            || $pos.nodeAfter?.type?.name === 'heading'
            || doc.nodeAt?.(resolvedPos)?.type?.name === 'heading'
        );
    } catch {
        return false;
    }
}

function transactionTouchesHeadingNode(tr: unknown, oldDoc: any, newDoc: any): boolean {
    return getTransactionChangedRanges(tr).some((range) => (
        positionTouchesHeadingNode(oldDoc, range.oldFrom)
        || positionTouchesHeadingNode(oldDoc, range.oldTo)
        || positionTouchesHeadingNode(newDoc, range.newFrom)
        || positionTouchesHeadingNode(newDoc, range.newTo)
    ));
}

export function canMapHeadingCollapsePluginState(
    pluginState: HeadingCollapsePluginState,
    tr: unknown,
    oldDoc?: any,
    newDoc?: any,
): boolean {
    if (pluginState.collapsedHeadings.size > 0) {
        return false;
    }
    if (!transactionIsPureInsertion(tr)) {
        return false;
    }
    const transactionDoc = newDoc ?? (tr as { doc?: unknown }).doc;
    if (transactionInsertedTextMayAffectHeadingStructure(tr, transactionDoc)) {
        return false;
    }
    if (
        transactionInsertedTextMatches(tr, HEADING_COLLAPSE_MARKER_PATTERN)
        && oldDoc
        && transactionDoc
        && transactionTouchesHeadingNode(tr, oldDoc, transactionDoc)
    ) {
        return false;
    }
    if (transactionTouchesDecorations(pluginState.decorations, tr)) {
        return false;
    }

    return true;
}

export function mapHeadingCollapsePluginState(
    pluginState: HeadingCollapsePluginState,
    tr: { mapping: Parameters<DecorationSet['map']>[0] },
    doc: any,
): HeadingCollapsePluginState {
    const topLevelNodes = pluginState.topLevelNodes.map((nodeInfo) => {
        const pos = tr.mapping.map(nodeInfo.pos, -1);
        return {
            ...nodeInfo,
            pos,
            endPos: Math.max(pos, tr.mapping.map(nodeInfo.endPos, 1)),
        };
    });

    return {
        ...pluginState,
        topLevelNodes,
        decorations: pluginState.decorations.map(tr.mapping, doc),
    };
}
